import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import maxmind from "maxmind";
import { db } from "./db.js";

const DATA_DIR = join(import.meta.dir, "..", "data");
const COUNTRY_PATH = join(DATA_DIR, "dbip-country.mmdb");
const ASN_PATH = join(DATA_DIR, "dbip-asn.mmdb");

let countryReader = null;
let asnReader = null;
let ipdbSettings = null;
let downloadProgress = { active: false, file: "", downloaded: 0, total: 0 };
let lastDownloadError = null;
let reloadTimer = null;
const RELOAD_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

const ipinfoCache = new Map();
const IPINFO_CACHE_TTL = 3600000;
const IPINFO_CACHE_MAX = 10000;

function checkDataDirWritable() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const testPath = join(DATA_DIR, ".write-test");
    writeFileSync(testPath, "");
    unlinkSync(testPath);
    return null;
  } catch (e) {
    return `Cannot write to data directory (${DATA_DIR}): ${e.message}. If you're running in Docker with a bind-mounted volume, ensure the host directory is writable by UID 1000 (the bun user) — e.g. chown 1000:1000 ./data.`;
  }
}

export async function loadIPDB() {
  try {
    const raw = await db.get("settings:ipdb");
    ipdbSettings = raw ? JSON.parse(raw) : null;
  } catch {
    ipdbSettings = null;
  }

  if (!ipdbSettings?.mode || ipdbSettings.mode === "ipinfo") return;

  const filesExist = existsSync(COUNTRY_PATH) || existsSync(ASN_PATH);

  if (!filesExist) {
    const writeError = checkDataDirWritable();
    if (writeError) {
      lastDownloadError = writeError;
      console.warn("[ipdb]", writeError);
      return;
    }
    try {
      await downloadDB(ipdbSettings.mode, {
        maxmindKey: ipdbSettings.maxmindKey || "",
        ipinfoToken: ipdbSettings.ipinfoToken || "",
      });
      return;
    } catch (e) {
      console.warn("[ipdb] Auto re-download failed:", e.message);
      return;
    }
  }

  await openReaders();

  if (reloadTimer) clearInterval(reloadTimer);
  reloadTimer = setInterval(async () => {
    if (ipdbSettings?.mode && ipdbSettings.mode !== "ipinfo") {
      console.log("[ipdb] Periodic reader reload");
      await openReaders();
    }
  }, RELOAD_INTERVAL);
}

async function openReaders() {
  try {
    if (existsSync(COUNTRY_PATH)) {
      countryReader = await maxmind.open(COUNTRY_PATH);
    }
    if (existsSync(ASN_PATH)) {
      asnReader = await maxmind.open(ASN_PATH);
    }
  } catch (e) {
    console.warn("[ipdb] Failed to load IP database:", e.message);
  }
}

export async function downloadDB(mode, credentials) {
  if (downloadProgress.active) throw new Error("Download already in progress");

  lastDownloadError = null;

  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    lastDownloadError = `Cannot create data directory (${DATA_DIR}): ${e.message}`;
    throw e;
  }

  try {
    if (mode === "ipinfo") {
      ipdbSettings = {
        mode: "ipinfo",
        maxmindKey: "",
        ipinfoToken: credentials?.ipinfoToken || "",
        lastUpdated: new Date().toISOString(),
      };
      await db.set("settings:ipdb", JSON.stringify(ipdbSettings));
      return;
    }

    const now = new Date();
    const dbipMonths = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      dbipMonths.push({
        year: d.getFullYear(),
        month: String(d.getMonth() + 1).padStart(2, "0"),
      });
    }

    let files;
    if (mode === "dbip") {
      files = [
        {
          urls: dbipMonths.map(
            ({ year, month }) =>
              `https://download.db-ip.com/free/dbip-country-lite-${year}-${month}.mmdb.gz`,
          ),
          path: COUNTRY_PATH,
          name: "country",
        },
        {
          urls: dbipMonths.map(
            ({ year, month }) =>
              `https://download.db-ip.com/free/dbip-asn-lite-${year}-${month}.mmdb.gz`,
          ),
          path: ASN_PATH,
          name: "asn",
        },
      ];
    } else if (mode === "maxmind") {
      const key = credentials?.maxmindKey;
      if (!key) throw new Error("MaxMind license key required");
      files = [
        {
          urls: [
            `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${encodeURIComponent(key)}&suffix=tar.gz`,
          ],
          path: COUNTRY_PATH,
          name: "country",
          isTarGz: true,
        },
        {
          urls: [
            `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN&license_key=${encodeURIComponent(key)}&suffix=tar.gz`,
          ],
          path: ASN_PATH,
          name: "asn",
          isTarGz: true,
        },
      ];
    } else {
      throw new Error("Invalid mode");
    }

    for (const file of files) {
      downloadProgress = {
        active: true,
        file: file.name,
        downloaded: 0,
        total: 0,
      };

      let response = null;
      let lastUrlError = null;
      for (const url of file.urls) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            response = r;
            break;
          }
          lastUrlError = `HTTP ${r.status} ${r.statusText || ""}`.trim();
          try { await r.body?.cancel(); } catch {}
        } catch (e) {
          lastUrlError = `Network error (${new URL(url).host}): ${e.message}`;
        }
      }
      if (!response) {
        throw new Error(`Failed to download ${file.name} database: ${lastUrlError || "no URLs succeeded"}`);
      }

      const contentLength = Number(response.headers.get("content-length")) || 0;
      downloadProgress.total = contentLength;

      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.byteLength;
        downloadProgress.downloaded = totalBytes;
      }

      const compressed = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.byteLength;
      }

      const decompressed = Bun.gunzipSync(compressed);

      if (file.isTarGz) {
        const mmdb = extractMMDBFromTar(decompressed);
        if (!mmdb) throw new Error(`No .mmdb file found in ${file.name} tar archive`);
        await Bun.write(file.path, mmdb);
      } else {
        await Bun.write(file.path, decompressed);
      }
    }

    ipdbSettings = {
      mode,
      maxmindKey: credentials?.maxmindKey || "",
      ipinfoToken: credentials?.ipinfoToken || "",
      lastUpdated: new Date().toISOString(),
    };
    await db.set("settings:ipdb", JSON.stringify(ipdbSettings));

    countryReader = null;
    asnReader = null;
    await loadIPDB();
  } catch (e) {
    lastDownloadError = e?.message || String(e);
    throw e;
  } finally {
    downloadProgress = { active: false, file: "", downloaded: 0, total: 0 };
  }
}

function extractMMDBFromTar(tarData) {
  let pos = 0;
  while (pos + 512 <= tarData.length) {
    const header = tarData.subarray(pos, pos + 512);

    let empty = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        empty = false;
        break;
      }
    }
    if (empty) break;

    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    const name = new TextDecoder().decode(header.subarray(0, nameEnd));

    let sizeStr = "";
    for (let i = 124; i < 136; i++) {
      const ch = header[i];
      if (ch === 0 || ch === 32) break;
      sizeStr += String.fromCharCode(ch);
    }
    const fileSize = parseInt(sizeStr, 8) || 0;

    pos += 512;

    if (name.endsWith(".mmdb") && fileSize > 0) {
      return tarData.subarray(pos, pos + fileSize);
    }

    pos += Math.ceil(fileSize / 512) * 512;
  }
  return null;
}

export function getDownloadProgress() {
  return { ...downloadProgress, error: lastDownloadError };
}

export function clearDownloadError() {
  lastDownloadError = null;
}

export function getStatus() {
  const countryExists = existsSync(COUNTRY_PATH);
  const asnExists = existsSync(ASN_PATH);
  return {
    mode: ipdbSettings?.mode || "",
    maxmindKey: ipdbSettings?.maxmindKey ? "••••" + ipdbSettings.maxmindKey.slice(-4) : "",
    ipinfoToken: ipdbSettings?.ipinfoToken ? "••••" + ipdbSettings.ipinfoToken.slice(-4) : "",
    lastUpdated: ipdbSettings?.lastUpdated || "",
    country: countryExists
      ? { exists: true, size: statSync(COUNTRY_PATH).size }
      : { exists: false },
    asn: asnExists ? { exists: true, size: statSync(ASN_PATH).size } : { exists: false },
    loaded: { country: !!countryReader, asn: !!asnReader },
    error: lastDownloadError,
  };
}

export async function deleteDB() {
  countryReader = null;
  asnReader = null;
  ipdbSettings = null;
  ipinfoCache.clear();
  lookupFailures = 0;
  if (reloadTimer) {
    clearInterval(reloadTimer);
    reloadTimer = null;
  }
  try {
    if (existsSync(COUNTRY_PATH)) unlinkSync(COUNTRY_PATH);
  } catch {}
  try {
    if (existsSync(ASN_PATH)) unlinkSync(ASN_PATH);
  } catch {}
  await db.del("settings:ipdb");
}

let lookupFailures = 0;
const FAILURE_RELOAD_THRESHOLD = 20;

export async function lookup(ip) {
  const result = { country: null, asn: null, org: null };
  if (!ip) return result;

  let lookupIp = ip;
  if (lookupIp.startsWith("::ffff:")) lookupIp = lookupIp.slice(7);

  const isPrivate =
    lookupIp.startsWith("10.") ||
    lookupIp.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(lookupIp) ||
    lookupIp === "127.0.0.1" ||
    lookupIp === "::1";

  if (ipdbSettings?.mode === "ipinfo" && ipdbSettings.ipinfoToken) {
    return await ipinfoLookup(lookupIp);
  }

  let gotResult = false;

  if (countryReader) {
    try {
      const c = countryReader.get(lookupIp);
      if (c?.country?.iso_code) {
        result.country = c.country.iso_code;
        gotResult = true;
      }
    } catch {
    }
  }
  if (asnReader) {
    try {
      const a = asnReader.get(lookupIp);
      if (a?.autonomous_system_number) {
        result.asn = `AS${a.autonomous_system_number}`;
        gotResult = true;
      }
      if (a?.autonomous_system_organization) result.org = a.autonomous_system_organization;
    } catch {
    }
  }

  if (!isPrivate && (countryReader || asnReader)) {
    if (gotResult) {
      lookupFailures = 0;
    } else {
      lookupFailures++;
      if (lookupFailures >= FAILURE_RELOAD_THRESHOLD) {
        lookupFailures = 0;
        console.warn("[ipdb] Too many empty lookups, reloading readers");
        openReaders();
      }
    }
  }

  return result;
}

async function ipinfoLookup(ip) {
  const result = { country: null, asn: null, org: null };

  const cached = ipinfoCache.get(ip);
  if (cached && Date.now() - cached.ts < IPINFO_CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `https://ipinfo.io/${encodeURIComponent(ip)}?token=${ipdbSettings.ipinfoToken}`,
    );
    if (!res.ok) return result;
    const data = await res.json();

    if (data.country) result.country = data.country;
    if (data.org) {
      const parts = data.org.split(" ");
      if (parts[0]?.startsWith("AS")) {
        result.asn = parts[0];
        result.org = parts.slice(1).join(" ");
      } else {
        result.org = data.org;
      }
    }

    if (ipinfoCache.size >= IPINFO_CACHE_MAX) {
      let oldest = Infinity, oldestKey = null;
      for (const [k, v] of ipinfoCache) {
        if (v.ts < oldest) { oldest = v.ts; oldestKey = k; }
      }
      if (oldestKey) ipinfoCache.delete(oldestKey);
    }
    ipinfoCache.set(ip, { ts: Date.now(), data: result });
  } catch {
  }

  return result;
}

export function isLoaded() {
  return (
    !!countryReader ||
    !!asnReader ||
    (ipdbSettings?.mode === "ipinfo" && !!ipdbSettings?.ipinfoToken)
  );
}
