import { randomBytes } from "node:crypto";

function bigintFromBuf(buf) {
  let x = 0n;
  for (const b of buf) x = (x << 8n) | BigInt(b);
  return x;
}

function modpow(b, e, m) {
  let r = 1n;
  b %= m;
  if (b < 0n) b += m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    e >>= 1n;
    b = (b * b) % m;
  }
  return r;
}

// Fixed-base windowed exponentiation. mint() raises the same four bases (g, h mod p and
// mod q) to a fresh 256-bit exponent on every challenge, so precompute
// table[j][d] = base^(d * 2^(W*j)): each power then costs ~EXP_BITS/W modular
// multiplications and no squarings (vs ~1.5*EXP_BITS for square-and-multiply).
// W=8: 32 rows x 256 entries x 4 bases of 1024-bit ints (~4 MB), built once per minter.
const FB_W = 8;
const FB_EXP_BITS = 256;
const FB_MASK = (1n << BigInt(FB_W)) - 1n;

function fixedBaseTable(base, m) {
  const rows = [];
  let bj = base % m;
  for (let j = 0; j < FB_EXP_BITS / FB_W; j++) {
    const row = new Array(1 << FB_W);
    row[0] = 1n;
    row[1] = bj;
    for (let d = 2; d < 1 << FB_W; d++) row[d] = (row[d - 1] * bj) % m;
    rows.push(row);
    bj = (row[(1 << FB_W) - 1] * bj) % m;
  }
  return { rows, base, m };
}

function fixedBasePow(t, e) {
  if (e >> BigInt(FB_EXP_BITS)) return modpow(t.base, e, t.m); // outside the table's range
  let r = 1n;
  for (let j = 0; e > 0n; j++, e >>= BigInt(FB_W)) {
    const d = Number(e & FB_MASK);
    if (d) r = (r * t.rows[j][d]) % t.m;
  }
  return r;
}

function modinv(a, m) {
  let [old_r, r] = [a % m, m];
  let [old_s, s] = [1n, 0n];
  if (old_r < 0n) old_r += m;
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function isProbablePrime(n, k = 4) {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let r = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r++;
  }
  const bits = n.toString(2).length;
  const byteLen = (bits + 7) >> 3;
  outer: for (let i = 0; i < k; i++) {
    let a = 0n;
    do {
      a = bigintFromBuf(randomBytes(byteLen)) % (n - 3n);
    } while (a < 2n);
    let x = modpow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let j = 0n; j < r - 1n; j++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

function randomPrime(bits) {
  const byteLen = (bits + 7) >> 3;
  for (;;) {
    let x = bigintFromBuf(randomBytes(byteLen));
    x |= 1n;
    x |= 1n << BigInt(bits - 1);
    x |= 1n << BigInt(bits - 2);
    x &= (1n << BigInt(bits)) - 1n;
    if (isProbablePrime(x, 4)) return x;
  }
}

function hexOf(bi, byteLen) {
  let s = bi.toString(16);
  if (byteLen != null) {
    const target = byteLen * 2;
    if (s.length < target) s = "0".repeat(target - s.length) + s;
  }
  return s;
}

// generation is expensive (~700 ms for 2048-bit on a modern CPU); persist the result.
export function generateRswKeypair(bits = 2048) {
  if (bits % 2 !== 0) throw new Error("rsw bits must be even");
  const p = randomPrime(bits >> 1);
  let q = randomPrime(bits >> 1);
  while (q === p) q = randomPrime(bits >> 1);
  const N = p * q;
  return { N, p, q, bits };
}

export function serializeRswKeypair(kp) {
  return { N: kp.N.toString(), p: kp.p.toString(), q: kp.q.toString(), bits: kp.bits ?? null };
}
export function deserializeRswKeypair(s) {
  if (!s || typeof s !== "object") throw new Error("invalid serialized rsw keypair");
  const N = typeof s.N === "string" ? BigInt(s.N) : s.N;
  const p = typeof s.p === "string" ? BigInt(s.p) : s.p;
  const q = typeof s.q === "string" ? BigInt(s.q) : s.q;
  if (typeof N !== "bigint" || typeof p !== "bigint" || typeof q !== "bigint") {
    throw new Error("rsw keypair fields must be bigint or string-encoded bigint");
  }
  return { N, p, q, bits: s.bits ?? N.toString(2).length };
}

export function buildRswMinter({ N, p, q, t, g }, opts = {}) {
  if (!N || !p || !q || !t) throw new Error("rsw minter needs {N, p, q, t}");
  const bits = opts.bits ?? N.toString(2).length;
  const modulusBytes = Math.ceil(bits / 8);
  const G = g ?? (bigintFromBuf(randomBytes(modulusBytes)) % (N - 3n)) + 2n;

  const pm1 = p - 1n;
  const qm1 = q - 1n;
  const e_p = modpow(2n, BigInt(t), pm1);
  const e_q = modpow(2n, BigInt(t), qm1);

  const hp = modpow(G % p, e_p, p);
  const hq = modpow(G % q, e_q, q);
  const qinv_p = modinv(q % p, p);
  const crtCombine = (ap, aq) => {
    let s = (((ap - aq) % p) + p) % p;
    s = (s * qinv_p) % p;
    return aq + q * s;
  };
  const h = crtCombine(hp, hq);

  const gp = G % p;
  const gq = G % q;
  const tgp = fixedBaseTable(gp, p);
  const tgq = fixedBaseTable(gq, q);
  const thp = fixedBaseTable(hp, p);
  const thq = fixedBaseTable(hq, q);

  function mintFromR(r) {
    const rp = r % pm1;
    const rq = r % qm1;
    const xp = fixedBasePow(tgp, rp);
    const xq = fixedBasePow(tgq, rq);
    const yp = fixedBasePow(thp, rp);
    const yq = fixedBasePow(thq, rq);
    return { x: crtCombine(xp, xq), y: crtCombine(yp, yq) };
  }

  return {
    N,
    t,
    g: G,
    h,
    modulusBytes,
    N_hex: hexOf(N, modulusBytes),
    g_hex: hexOf(G, modulusBytes),
    h_hex: hexOf(h, modulusBytes),

    mint() {
      const r = bigintFromBuf(randomBytes(32));
      const { x, y } = mintFromR(r);
      return {
        x_hex: hexOf(x, modulusBytes),
        y_hex: hexOf(y, modulusBytes),
      };
    },
  };
}

export function verifyRswSolution(expectedYHex, claimedYHex) {
  if (typeof claimedYHex !== "string" || typeof expectedYHex !== "string") return false;
  const norm = (s) => s.replace(/^0x/, "").toLowerCase().replace(/^0+/, "");
  return norm(expectedYHex) === norm(claimedYHex);
}
