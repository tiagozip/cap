import { Database } from "bun:sqlite";
import fs from "node:fs";
import { join } from "node:path";

fs.mkdirSync(process.env.DATA_PATH || "./.data", {
	recursive: true,
});

const db = new Database(join(process.env.DATA_PATH || "./.data", "db.sqlite"));

db.query(
	`create table if not exists sessions (
    token text primary key not null,
    expires integer not null,
    created integer not null
  )`,
).run();

db.query(
	`create table if not exists keys (
    siteKey text primary key not null,
    name text not null,
    secretHash text not null,
    config text not null,
    created integer not null
  )`,
).run();

db.query(
	`create table if not exists solutions (
    siteKey text not null,
    bucket integer not null,
    count integer default 0,
    primary key (siteKey, bucket)
  )`,
).run();

db.query(
	`create table if not exists challenges (
    siteKey text not null,
    token text not null,
    data text not null,
    expires integer not null,
    primary key (siteKey, token)
  )`,
).run();

db.query(
	`create table if not exists tokens (
    siteKey text not null,
    token text not null,
    expires integer not null,
    primary key (siteKey, token)
  )`,
).run();

db.query(
	`create table if not exists api_keys (
    id text not null,
    name text not null,
    tokenHash text not null,
    created integer not null,
    primary key (id, tokenHash)
  )`,
).run();

setInterval(() => {
	db.query("delete from sessions where expires < ?").run(Date.now());
	db.query("delete from tokens where expires < ?").run(Date.now());
	db.query("delete from challenges where expires < ?").run(Date.now());
}, 60 * 1000);

db.query("delete from sessions where expires < ?").run(Date.now());
db.query("delete from tokens where expires < ?").run(Date.now());
db.query("delete from challenges where expires < ?").run(Date.now());

export { db };
