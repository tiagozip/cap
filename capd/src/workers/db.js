import { env } from "cloudflare:workers";

const LIVE = "(exp IS NULL OR exp > ?)";
const decoder = new TextDecoder();
let seq = 0;

const stmt = (query, ...args) => env.DB.prepare(query).bind(...args);
const all = async (query, ...args) =>
  (await stmt(query, ...args).all()).results;
const first = (query, ...args) => stmt(query, ...args).first();

const asText = (v) => {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (v instanceof ArrayBuffer) return decoder.decode(v);
  if (ArrayBuffer.isView(v)) return decoder.decode(v);
  if (Array.isArray(v)) return decoder.decode(new Uint8Array(v));
  return String(v);
};

const asBuffer = (v) => {
  if (v == null) return null;
  if (typeof v === "string") return Buffer.from(v);
  if (Array.isArray(v)) return Buffer.from(v);
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
};

const toStored = (v) =>
  v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? v : String(v);

const flat = (args) => args.flat();

const upsert = (k, f, t, v, exp) =>
  stmt(
    "INSERT INTO kv (k, f, t, v, exp) VALUES (?, ?, ?, ?, ?) ON CONFLICT (k, f) DO UPDATE SET t = excluded.t, v = excluded.v, exp = excluded.exp",
    k,
    f,
    t,
    v,
    exp,
  );

const inheritExp = (t) =>
  `INSERT INTO kv (k, f, t, v, exp) VALUES (?1, ?2, '${t}', ?3, (SELECT exp FROM kv WHERE k = ?1 AND (exp IS NULL OR exp > ?4) LIMIT 1)) ON CONFLICT (k, f) DO UPDATE SET v = excluded.v, exp = CASE WHEN kv.exp IS NOT NULL AND kv.exp <= ?4 THEN excluded.exp ELSE kv.exp END`;

const batch = (statements) =>
  statements.length ? env.DB.batch(statements) : Promise.resolve([]);

async function get(k) {
  const row = await first(
    `SELECT v FROM kv WHERE k = ? AND f = '' AND ${LIVE}`,
    k,
    Date.now(),
  );
  return row ? asText(row.v) : null;
}

async function setCommand(args) {
  const [k, v, ...opts] = args;
  let ttlMs = null;
  let nx = false;
  for (let i = 0; i < opts.length; i++) {
    const o = String(opts[i]).toUpperCase();
    if (o === "NX") nx = true;
    else if (o === "EX") ttlMs = Number(opts[++i]) * 1000;
    else if (o === "PX") ttlMs = Number(opts[++i]);
    else throw new Error(`SET option ${o} isn't supported on D1`);
  }
  const now = Date.now();
  const exp = ttlMs == null ? null : now + ttlMs;
  if (!nx) {
    await upsert(k, "", "s", toStored(v), exp).run();
    return "OK";
  }
  const row = await first(
    "INSERT INTO kv (k, f, t, v, exp) VALUES (?1, '', 's', ?2, ?3) ON CONFLICT (k, f) DO UPDATE SET t = 's', v = excluded.v, exp = excluded.exp WHERE kv.exp IS NOT NULL AND kv.exp <= ?4 RETURNING k",
    k,
    toStored(v),
    exp,
    now,
  );
  return row ? "OK" : null;
}

async function hset(k, pairs) {
  const now = Date.now();
  const statements = [];
  for (let i = 0; i < pairs.length; i += 2)
    statements.push(
      stmt(inheritExp("h"), k, String(pairs[i]), toStored(pairs[i + 1]), now),
    );
  await batch(statements);
  return statements.length;
}

async function hgetallObject(k) {
  const rows = await all(
    `SELECT f, v FROM kv WHERE k = ? AND t = 'h' AND ${LIVE}`,
    k,
    Date.now(),
  );
  return Object.fromEntries(rows.map((r) => [r.f, asText(r.v)]));
}

async function del(...keys) {
  const list = flat(keys);
  if (!list.length) return 0;
  const now = Date.now();
  const results = await batch(
    list.map((k) =>
      stmt(`SELECT count(*) AS n FROM kv WHERE k = ? AND ${LIVE}`, k, now),
    ),
  );
  await batch(list.map((k) => stmt("DELETE FROM kv WHERE k = ?", k)));
  return results.filter((r) => r.results[0]?.n > 0).length;
}

async function expire(k, seconds) {
  const now = Date.now();
  const res = await stmt(
    `UPDATE kv SET exp = ? WHERE k = ? AND ${LIVE}`,
    now + Number(seconds) * 1000,
    k,
    now,
  ).run();
  return res.meta.changes > 0 ? 1 : 0;
}

async function lpush(k, values) {
  const statements = values.map((v) => {
    seq = (seq + 1) % 1000;
    const f = String(9e15 - Date.now() * 1000 - seq).padStart(16, "0");
    return stmt(inheritExp("l"), k, f, toStored(v), Date.now());
  });
  await batch(statements);
  return statements.length;
}

async function send(cmd, args = []) {
  const now = Date.now();
  switch (String(cmd).toUpperCase()) {
    case "PING":
      await first("SELECT 1 AS ok");
      return "PONG";
    case "SET":
      return setCommand(args);
    case "GET":
      return get(args[0]);
    case "DEL":
      return del(args);
    case "EXPIRE":
      return expire(args[0], args[1]);
    case "HSET":
      return hset(args[0], args.slice(1));
    case "HGETALL":
      return hgetallObject(args[0]);
    case "HDEL":
      return api.hdel(args[0], ...args.slice(1));
    case "HLEN":
      return (
        (
          await first(
            `SELECT count(*) AS n FROM kv WHERE k = ? AND t = 'h' AND ${LIVE}`,
            args[0],
            now,
          )
        )?.n ?? 0
      );
    case "LPUSH":
      return lpush(args[0], args.slice(1));
    case "LRANGE": {
      const start = Number(args[1]);
      const stop = Number(args[2]);
      const limit = stop < 0 ? -1 : stop - start + 1;
      const rows = await all(
        `SELECT v FROM kv WHERE k = ? AND t = 'l' AND ${LIVE} ORDER BY f LIMIT ? OFFSET ?`,
        args[0],
        now,
        limit,
        start,
      );
      return rows.map((r) => asText(r.v));
    }
    case "LTRIM": {
      const start = Number(args[1]);
      const stop = Number(args[2]);
      await stmt(
        `DELETE FROM kv WHERE k = ?1 AND t = 'l' AND f NOT IN (SELECT f FROM kv WHERE k = ?1 AND t = 'l' AND (exp IS NULL OR exp > ?2) ORDER BY f LIMIT ?3 OFFSET ?4)`,
        args[0],
        now,
        stop - start + 1,
        start,
      ).run();
      return "OK";
    }
    case "PUBLISH":
      return 0;
    default:
      throw new Error(`${cmd} isn't supported on D1`);
  }
}

const api = {
  send,
  get,
  async getBuffer(k) {
    const row = await first(
      `SELECT v FROM kv WHERE k = ? AND f = '' AND ${LIVE}`,
      k,
      Date.now(),
    );
    return row ? asBuffer(row.v) : null;
  },
  async getdel(k) {
    const row = await first(
      "DELETE FROM kv WHERE k = ? AND f = '' RETURNING v, exp",
      k,
    );
    if (!row || (row.exp != null && row.exp <= Date.now())) return null;
    return asText(row.v);
  },
  set: (k, v) => setCommand([k, v]),
  del,
  async exists(...keys) {
    const now = Date.now();
    let n = 0;
    for (const k of flat(keys)) {
      const row = await first(
        `SELECT 1 AS x FROM kv WHERE k = ? AND ${LIVE} LIMIT 1`,
        k,
        now,
      );
      if (row) n++;
    }
    return n > 0;
  },
  async incr(k) {
    const now = Date.now();
    const row = await first(
      "INSERT INTO kv (k, f, t, v, exp) VALUES (?1, '', 's', '1', NULL) ON CONFLICT (k, f) DO UPDATE SET v = CASE WHEN kv.exp IS NOT NULL AND kv.exp <= ?2 THEN '1' ELSE CAST(CAST(kv.v AS INTEGER) + 1 AS TEXT) END, exp = CASE WHEN kv.exp IS NOT NULL AND kv.exp <= ?2 THEN NULL ELSE kv.exp END RETURNING v",
      k,
      now,
    );
    return Number(asText(row?.v)) || 0;
  },
  expire,
  async mget(...keys) {
    const list = flat(keys);
    const now = Date.now();
    const rows = await all(
      `SELECT k, v FROM kv WHERE f = '' AND ${LIVE} AND k IN (${list.map(() => "?").join(", ")})`,
      now,
      ...list,
    );
    const found = new Map(rows.map((r) => [r.k, asText(r.v)]));
    return list.map((k) => found.get(k) ?? null);
  },
  async sadd(k, ...members) {
    const now = Date.now();
    await batch(
      flat(members).map((m) => stmt(inheritExp("z"), k, String(m), "", now)),
    );
    return flat(members).length;
  },
  async srem(k, ...members) {
    const list = flat(members);
    await batch(
      list.map((m) =>
        stmt("DELETE FROM kv WHERE k = ? AND f = ? AND t = 'z'", k, String(m)),
      ),
    );
    return list.length;
  },
  async smembers(k) {
    const rows = await all(
      `SELECT f FROM kv WHERE k = ? AND t = 'z' AND ${LIVE}`,
      k,
      Date.now(),
    );
    return rows.map((r) => r.f);
  },
  async sismember(k, m) {
    return !!(await first(
      `SELECT 1 AS x FROM kv WHERE k = ? AND f = ? AND t = 'z' AND ${LIVE}`,
      k,
      String(m),
      Date.now(),
    ));
  },
  async hget(k, f) {
    const row = await first(
      `SELECT v FROM kv WHERE k = ? AND f = ? AND t = 'h' AND ${LIVE}`,
      k,
      String(f),
      Date.now(),
    );
    return row ? asText(row.v) : null;
  },
  async hmget(k, fields) {
    const list = flat([fields]);
    const values = await hgetallObject(k);
    return list.map((f) => values[f] ?? null);
  },
  hmset: (k, pairs) =>
    hset(
      k,
      Array.isArray(pairs) ? pairs : Object.entries(pairs ?? {}).flat(),
    ).then(() => "OK"),
  async hdel(k, ...fields) {
    const list = flat(fields);
    await batch(
      list.map((f) =>
        stmt("DELETE FROM kv WHERE k = ? AND f = ? AND t = 'h'", k, String(f)),
      ),
    );
    return list.length;
  },
  close() {},
};

export const db = api;
export const hgetall = hgetallObject;

export async function incrWithTtl(k, seconds) {
  const now = Date.now();
  const row = await first(
    "INSERT INTO kv (k, f, t, v, exp) VALUES (?1, '', 's', '1', ?3) ON CONFLICT (k, f) DO UPDATE SET v = CASE WHEN kv.exp IS NOT NULL AND kv.exp <= ?2 THEN '1' ELSE CAST(CAST(kv.v AS INTEGER) + 1 AS TEXT) END, exp = CASE WHEN kv.exp IS NULL OR kv.exp <= ?2 THEN ?3 ELSE kv.exp END RETURNING v",
    k,
    now,
    now + seconds * 1000,
  );
  return Number(asText(row?.v)) || 0;
}

export const sweep = () =>
  stmt("DELETE FROM kv WHERE exp IS NOT NULL AND exp <= ?", Date.now()).run();
