import { readFileSync } from "node:fs";
import { Value } from "@sinclair/typebox/value";
import { db } from "#db";
import { SECTIONS } from "./settings-sections.js";

// Declarative instance settings from a JSON file (CAP_CONFIG) or inline JSON (CAP_CONFIG_JSON).
// Every section in it is written to Valkey on each start and is read-only in the API and dashboard.
// Sections left out stay editable.

export class ConfigError extends Error {
  name = "ConfigError";
}

// The applied config, { source, instance }, or null when there is none.
let applied = null;

const isManaged = (section) =>
  !!applied && Object.hasOwn(applied.instance, section);

export const managedSettings = () => ({
  source: applied?.source ?? null,
  sections: Object.keys(applied?.instance ?? {}),
});

const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

export function parseConfig(raw, name = "config") {
  const fail = (message) => {
    throw new ConfigError(`${name}: ${message}`);
  };
  if (!isObject(raw)) fail("must be a JSON object");
  for (const key of Object.keys(raw)) {
    if (key === "$schema" || key === "instance") continue;
    if (key === "sites")
      fail(
        "sites isn't supported yet, only instance. Manage site keys in the dashboard for now.",
      );
    fail(`unknown key "${key}", expected "instance"`);
  }
  const instance = raw.instance ?? {};
  if (!isObject(instance)) fail("instance must be an object");

  const parsed = {};
  for (const [section, value] of Object.entries(instance)) {
    const def = SECTIONS[section];
    if (!def)
      fail(
        `unknown section instance.${section}, expected one of ${Object.keys(SECTIONS).join(", ")}`,
      );
    if (!Value.Check(def.strict, value)) {
      const error = Value.Errors(def.strict, value).First();
      const path = (error?.path ?? "").split("/").filter(Boolean).join(".");
      fail(
        `instance.${section}${path ? `.${path}` : ""}: ${error?.message ?? "invalid value"}`,
      );
    }
    const normalized = def.normalize(value);
    const problem = def.check?.(normalized);
    if (problem) fail(`instance.${section}: ${problem}`);
    parsed[section] = normalized;
  }
  return parsed;
}

export function readConfig(env = process.env) {
  const path = env.CAP_CONFIG;
  const inline = env.CAP_CONFIG_JSON;
  if (path && inline)
    throw new ConfigError("Set CAP_CONFIG or CAP_CONFIG_JSON, not both.");
  if (!path && !inline) return null;

  const name = path ? "CAP_CONFIG" : "CAP_CONFIG_JSON";
  let text = inline;
  if (path) {
    try {
      text = readFileSync(path, "utf8");
    } catch (e) {
      throw new ConfigError(
        `CAP_CONFIG points at ${path}, which Cap can't read: ${e.message}`,
      );
    }
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ConfigError(`${name} isn't valid JSON: ${e.message}`);
  }
  return { source: name, instance: parseConfig(raw, name) };
}

// Writes the config's sections to Valkey. Run it before anything loads those
// keys (initEvents, startAssets, loadSettingsCaches) so they pick it up.
export async function applyManagedConfig(env = process.env) {
  applied = null;
  const config = readConfig(env);
  if (!config) return;
  const sections = Object.keys(config.instance);
  await Promise.all(
    sections.map((section) =>
      db.set(SECTIONS[section].key, JSON.stringify(config.instance[section])),
    ),
  );
  applied = config;
  console.log(
    sections.length
      ? `[cap] ${config.source} sets ${sections.join(", ")}, so they're read-only in the dashboard and API.`
      : `[cap] ${config.source} has no instance settings, so everything stays editable in the dashboard.`,
  );
}

// beforeHandle for the PUT route of a section the config file may own.
export const managedGuard =
  (section) =>
  ({ set }) => {
    if (!isManaged(section)) return;
    set.status = 409;
    return {
      success: false,
      error: `${SECTIONS[section].label} is set by ${applied.source}, so change it there and restart Cap.`,
    };
  };

// Route options for a section's PUT: the read-only guard and the body schema,
// so the two can't be wired to different sections.
export const sectionRoute = (section) => ({
  beforeHandle: managedGuard(section),
  body: SECTIONS[section].body,
  detail: { tags: ["Settings"] },
});

// Handler for a section whose save is normalize, store, then update the cache.
export const saveSection =
  (section) =>
  async ({ body }) => {
    const { key, normalize, apply } = SECTIONS[section];
    const value = normalize(body);
    await db.set(key, JSON.stringify(value));
    apply(value);
    return { success: true };
  };
