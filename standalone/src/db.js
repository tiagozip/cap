import fs from "node:fs";
import { join } from "node:path";
import { SQL } from "bun";

fs.mkdirSync(process.env.DATA_PATH || "./.data", {
  recursive: true,
});

let db;

async function initDb() {
  const dbUrl = process.env.DB_URL || `sqlite://${join(process.env.DATA_PATH || "./.data", "db.sqlite")}`;

  db = new SQL(dbUrl);

  await db`create table if not exists sessions (
    token text primary key not null,
    expires integer not null,
    created integer not null
  )`.simple();

  await db`create table if not exists keys (
    siteKey text primary key not null,
    name text not null,
    secretHash text not null,
    config text not null,
    created integer not null
  )`.simple();

  await db`create table if not exists solutions (
    siteKey text not null,
    bucket integer not null,
    count integer default 0,
    primary key (siteKey, bucket)
  )`.simple();

  await db`create table if not exists challenges (
    siteKey text not null,
    token text not null,
    data text not null,
    expires integer not null,
    primary key (siteKey, token)
  )`.simple();

  await db`create table if not exists tokens (
    siteKey text not null,
    token text not null,
    expires integer not null,
    primary key (siteKey, token)
  )`.simple();

  await db`create table if not exists api_keys (
    id text not null,
    name text not null,
    tokenHash text not null,
    created integer not null,
    primary key (id, tokenHash)
  )`.simple();

  setInterval(async () => {
    const now = Date.now();

    await db`delete from sessions where expires < ${now}`;
    await db`delete from tokens where expires < ${now}`;
    await db`delete from challenges where expires < ${now}`;
  }, 60 * 1000);


  const now = Date.now();

  await db`delete from sessions where expires < ${now}`;
  await db`delete from tokens where expires < ${now}`;
  await db`delete from challenges where expires < ${now}`;

  return db;
}

db = await initDb();

export { db };
