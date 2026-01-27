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
      await db`alter table ${db(tbl)} alter column ${db(col)} type bigint`.simple();
    } else { // Mysql needs modify column syntax...
      await db`alter table ${db(tbl)} modify column ${db(col)} bigint`.simple();
    }
  };

  let siteKeyColType, tokenColType, apiTokenIdColType, apiTokenHashColType;
  if (isSqlite || isPostgres) {
    siteKeyColType = tokenColType = apiTokenIdColType = apiTokenHashColType = sql`text`;
  } else {
    // MySQL requires a prefix length for indices, thus cannot index `text`.
    // The maximum size for an index, however, is 3072 bytes (or 767 characters using utf8mb4).
    // However, combined keys also count towards this limit.

    siteKeyColType = sql`varchar(31)`; // Site keys are quite short. Generated as 5 bytes hex (10 chars).
    tokenColType = sql`varchar(255)`; // Used in combination with site keys. Generated as 25 bytes hex.
    apiTokenIdColType = sql`varchar(63)`; // IDs are generated as 16 bytes hex (32 chars).
    apiTokenHashColType = sql`varchar(255)`; // Tokens are 32 bytes base64 encoded, then hashed using Bun's algorithm.

    // Combinations:
    // - solutions (siteKey + bucket): siteKey (31 chars => 124 bytes) + bucket (bigint => 8 bytes) = 132 bytes
    // - challenges (siteKey + token): siteKey (31 chars => 124 bytes) + token (255 chars => 1020 bytes) = 1144 bytes
    // - tokens (siteKey + token): siteKey (31 chars => 124 bytes) + token (255 chars => 1020 bytes) = 1144 bytes
    // - api_keys (id + tokenHash): id (63 chars => 252 bytes) + tokenHash (255 chars => 1020 bytes) = 1272 bytes
  }

  // Note: table names are encoded using db("tableName") to avoid conflicts with reserved keywords,
  // which is currently a problem on mysql.

  await db`create table if not exists ${db("sessions")} (
    token ${tokenColType} primary key not null,
    expires bigint not null,
    created bigint not null
  )`.simple();
  await changeIntToBigInt("sessions", "expires");
  await changeIntToBigInt("sessions", "created");

  await db`create table if not exists ${db("keys")} (
    siteKey ${siteKeyColType} primary key not null,
    name text not null,
    secretHash text not null,
    config text not null,
    created bigint not null
  )`.simple();
  await changeIntToBigInt("keys", "created");

  await db`create table if not exists ${db("solutions")} (
    siteKey ${siteKeyColType} not null,
    bucket bigint not null,
    count integer default 0,
    primary key (siteKey, bucket)
  )`.simple();
  await changeIntToBigInt("solutions", "bucket");

  await db`create table if not exists ${db("challenges")} (
    siteKey ${siteKeyColType} not null,
    token ${tokenColType} not null,
    data text not null,
    expires bigint not null,
    primary key (siteKey, token)
  )`.simple();
  await changeIntToBigInt("challenges", "expires");

  await db`create table if not exists ${db("tokens")} (
    siteKey ${siteKeyColType} not null,
    token ${tokenColType} not null,
    expires bigint not null,
    primary key (siteKey, token)
  )`.simple();
  await changeIntToBigInt("tokens", "expires");

  await db`create table if not exists ${db("api_keys")} (
    id ${apiTokenIdColType} not null,
    name text not null,
    tokenHash ${apiTokenHashColType} not null,
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
const numberFromDb = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const bigIntValue = BigInt(value);
    if (bigIntValue <= maxSafeIntegerBigInt && bigIntValue >= minSafeIntegerBigInt) {
      return Number(bigIntValue);
    }
  }
  return Number(value);
}
const dateFromDb = (value) => {
  if (value instanceof Date) return value;
  return new Date(numberFromDb(value));
};

export { db, numberFromDb, dateFromDb };
