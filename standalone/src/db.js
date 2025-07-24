import { Database } from "bun:sqlite";
import fs from "node:fs";

fs.mkdirSync("./.data", {
	recursive: true,
});

const db = new Database("./.data/db.sqlite");

db.query(
	`create table if not exists sessions (
    token string primary key not null,
    expires integer not null,
    created integer not null
  )`,
).run();

db.query(
	`create table if not exists keys (
    siteKey string primary key not null,
    name string not null,
    secretHash string not null,
    config string not null,
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
    siteKey string not null,
    token string not null,
    data string not null,
    expires integer not null,
    primary key (siteKey, token)
  )`,
).run();

db.query(
	`create table if not exists tokens (
    siteKey string not null,
    token string not null,
    expires integer not null,
    primary key (siteKey, token)
  )`,
).run();

db.query(
	`create table if not exists api_keys (
    id string not null,
    name string not null,
    tokenHash string not null,
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
