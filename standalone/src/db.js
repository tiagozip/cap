import fs from "node:fs";
import { join } from "node:path";
import { SQL, sql } from "bun";

fs.mkdirSync(process.env.DATA_PATH || "./.data", {
  recursive: true,
});

let db;

async function initDb() {
  const dbUrl = process.env.DB_URL || `sqlite://${join(process.env.DATA_PATH || "./.data", "db.sqlite")}`;

  db = new SQL({
    url: dbUrl,
    bigint: true,
  });

  const isSqlite = db.options.adapter === "sqlite";
  const isPostgres = db.options.adapter === "postgres";
  const changeIntToBigInt = async (tbl, col) => {
    if (isSqlite) return; // Irrelevant in SQLite.
    if (isPostgres) {
      await db`alter table ${sql(tbl)} alter column ${sql(col)} type bigint`.simple();
    } else {
      await db`alter table ${sql(tbl)} modify column ${sql(col)} bigint`.simple();
    }
  };
  // MySQL requires a prefix-length for indexing text. 4096 is an arbitrarily chosen number.
  const indexableTextColType = isPostgres || isSqlite ? sql`text` : sql`varchar(4096)`;

  await db`create table if not exists sessions (
    token ${indexableTextColType} primary key not null,
    expires bigint not null,
    created bigint not null
  )`.simple();
  await changeIntToBigInt("sessions", "expires");
  await changeIntToBigInt("sessions", "created");

  await db`create table if not exists keys (
    siteKey ${indexableTextColType} primary key not null,
    name text not null,
    secretHash text not null,
    config text not null,
    created bigint not null
  )`.simple();
  await changeIntToBigInt("keys", "created");

  await db`create table if not exists solutions (
    siteKey ${indexableTextColType} not null,
    bucket bigint not null,
    count integer default 0,
    primary key (siteKey, bucket)
  )`.simple();
  await changeIntToBigInt("solutions", "bucket");

  await db`create table if not exists challenges (
    siteKey ${indexableTextColType} not null,
    token ${indexableTextColType} not null,
    data text not null,
    expires bigint not null,
    primary key (siteKey, token)
  )`.simple();
  await changeIntToBigInt("challenges", "expires");

  await db`create table if not exists tokens (
    siteKey ${indexableTextColType} not null,
    token ${indexableTextColType} not null,
    expires bigint not null,
    primary key (siteKey, token)
  )`.simple();
  await changeIntToBigInt("tokens", "expires");

  await db`create table if not exists api_keys (
    id ${indexableTextColType} not null,
    name text not null,
    tokenHash ${indexableTextColType} not null,
    created bigint not null,
    primary key (id, tokenHash)
  )`.simple();
  await changeIntToBigInt("api_keys", "created");

  setInterval(periodicCleanup, 60 * 1000);
  await periodicCleanup();

  return db;
}

async function periodicCleanup() {
  const now = Date.now();

  await db`delete from sessions where expires < ${now}`;
  await db`delete from tokens where expires < ${now}`;
  await db`delete from challenges where expires < ${now}`;
}

db = await initDb();

const maxSafeIntegerBigInt = BigInt(Number.MAX_SAFE_INTEGER);
const minSafeIntegerBigInt = BigInt(Number.MIN_SAFE_INTEGER);
const dateFromDb = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "bigint" && value <= maxSafeIntegerBigInt && value >= minSafeIntegerBigInt) {
    return new Date(Number(value));
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return new Date(Number(value));
  }
  return new Date(value);
};

export { db, dateFromDb };
