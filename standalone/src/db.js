import fs from "node:fs";
import { join } from "node:path";

fs.mkdirSync(process.env.DATA_PATH || "./.data", {
  recursive: true,
});

let db;

async function initDb() {
  const connector = process.env.DB_CONNECTOR;

  if (!connector || connector === "bun-sqlite") {
    const { Database } = await import("bun:sqlite");

    db = new Database(join(process.env.DATA_PATH || "./.data", "db.sqlite"));
  } else if (connector === "turso") {
    const { connect } = await import("@tursodatabase/database");

    db = await connect(join(process.env.DATA_PATH || "./.data", "db.sqlite"));
  } else {
    throw new Error(`Unsupported DB connector "${connector}"`);
  }

  await db.exec(
    `create table if not exists sessions (
		    token text primary key not null,
		    expires integer not null,
		    created integer not null
		  )`
  );

  await db.exec(
    `create table if not exists keys (
		    siteKey text primary key not null,
		    name text not null,
		    secretHash text not null,
		    config text not null,
		    created integer not null
		  )`
  );

  await db.exec(
    `create table if not exists solutions (
		    siteKey text not null,
		    bucket integer not null,
		    count integer default 0,
		    primary key (siteKey, bucket)
		  )`
  );

  await db.exec(
    `create table if not exists challenges (
		    siteKey text not null,
		    token text not null,
		    data text not null,
		    expires integer not null,
		    primary key (siteKey, token)
		  )`
  );

  await db.exec(
    `create table if not exists tokens (
		    siteKey text not null,
		    token text not null,
		    expires integer not null,
		    primary key (siteKey, token)
		  )`
  );

  await db.exec(
    `create table if not exists api_keys (
		    id text not null,
		    name text not null,
		    tokenHash text not null,
		    created integer not null,
		    primary key (id, tokenHash)
		  )`
  );

  setInterval(() => {
    db.prepare("delete from sessions where expires < ?").run(Date.now());
    db.prepare("delete from tokens where expires < ?").run(Date.now());
    db.prepare("delete from challenges where expires < ?").run(Date.now());
  }, 60 * 1000);

  db.prepare("delete from sessions where expires < ?").run(Date.now());
  db.prepare("delete from tokens where expires < ?").run(Date.now());
  db.prepare("delete from challenges where expires < ?").run(Date.now());

  return db;
}

db = await initDb();

export { db };
