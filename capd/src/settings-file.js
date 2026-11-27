import { readFileSync } from "node:fs";
import { getSchemaValidator } from "elysia";
import { db } from "#db";
import { loadAssetSettings, saveAssetSettings } from "./assets.js";
import { updateSettings } from "./events/index.js";
import {
  setCorsDefault,
  setFiltering,
  setHeaders,
  setRatelimit,
} from "./settings-cache.js";
import { settingsSchemas } from "./settings-schemas.js";
import { setUpdateCheck } from "./update-check.js";

const stored = async (key, fallback) => {
  const raw = await db.get(key);
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveCached = (key, set, defaults) => async (patch) => {
  const next = { ...(await stored(key, defaults)), ...patch };
  await db.set(key, JSON.stringify(next));
  set(next);
};

const appliers = {
  ratelimit: saveCached("settings:ratelimit", setRatelimit, {
    max: 30,
    duration: 5000,
  }),
  cors: async ({ origins }) => {
    const next = { origins: origins?.length ? origins : null };
    await db.set("settings:cors", JSON.stringify(next));
    setCorsDefault(next);
  },
  filtering: saveCached("settings:filtering", setFiltering, {
    blockNonBrowserUA: false,
    requiredHeaders: [],
  }),
  headers: saveCached("settings:headers", setHeaders, {
    ipHeader: "",
    countryHeader: "",
    asnHeader: "",
  }),
  analytics: updateSettings,
  assets: async (patch) => {
    await loadAssetSettings();
    const r = await saveAssetSettings(patch);
    if (r.error) throw new Error(`assets: ${r.error}`);
  },
  updateCheck: setUpdateCheck,
};

export function readSettingsFile(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(
      `CAP_SETTINGS_FILE points at ${path}, which Cap can't read as JSON: ${e.message}`,
    );
  }
  if (parsed?.cap !== "settings" || typeof parsed.settings !== "object")
    throw new Error(
      `${path} isn't a Cap settings file. Export one from Settings > Backup to see the format.`,
    );
  const problems = [];
  for (const [group, value] of Object.entries(parsed.settings)) {
    const schema = settingsSchemas[group];
    if (!schema) {
      problems.push(`unknown section "${group}"`);
      continue;
    }
    const check = getSchemaValidator(schema);
    if (!check.Check(value))
      for (const err of check.Errors(value))
        problems.push(
          `${group}${err.path.replaceAll("/", ".")}: ${err.message}`,
        );
  }
  if (problems.length)
    throw new Error(
      `${path} has invalid settings:\n  ${problems.join("\n  ")}`,
    );
  return parsed.settings;
}

export async function applySettingsFile(path = process.env.CAP_SETTINGS_FILE) {
  if (!path) return [];
  const settings = readSettingsFile(path);
  for (const [group, value] of Object.entries(settings))
    await appliers[group](value);
  const groups = Object.keys(settings);
  console.log(
    `[cap] Applied ${path} (${groups.join(", ") || "no sections"}). Changes made in the dashboard to these settings go back to the file's values on restart.`,
  );
  return groups;
}
