import { resolveRange } from "./analytics.js";
import { getQueries, getStore } from "./index.js";
import { COLUMN_NAMES } from "./schema.js";

const PAGE = 1000;
const MAX_ROWS = 100_000;
const D1_MAX_ROWS = 20_000;

const csvCell = (v) => {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join(" ") : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

const HEADER = ["time", ...COLUMN_NAMES.filter((c) => c !== "site_key")];

const csvRow = (e) =>
  HEADER.map((c) =>
    csvCell(c === "time" ? new Date(e.ts).toISOString() : e[c]),
  ).join(",");

export function exportEvents(siteKey, { format, range, from, to, filters, q }) {
  const r = resolveRange({ range, from, to });
  const limit = getStore()?.kind === "d1" ? D1_MAX_ROWS : MAX_ROWS;
  const ctx = { siteKey, from: r.from, to: r.to, filters, q };
  const csv = format !== "ndjson";
  const encoder = new TextEncoder();
  let cursor = null;
  let sent = 0;
  let started = false;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          if (csv) controller.enqueue(encoder.encode(`${HEADER.join(",")}\n`));
        }
        const page = await getQueries().list(ctx, {
          cursor,
          limit: Math.min(PAGE, limit - sent),
        });
        if (page.events.length) {
          const body = page.events
            .map((e) => (csv ? csvRow(e) : JSON.stringify(e)))
            .join("\n");
          controller.enqueue(encoder.encode(`${body}\n`));
          sent += page.events.length;
        }
        if (!page.next || sent >= limit) {
          controller.close();
          return;
        }
        const i = page.next.indexOf(".");
        cursor = {
          ts: Number(page.next.slice(0, i)),
          id: page.next.slice(i + 1),
        };
      } catch (e) {
        controller.error(e);
      }
    },
  });
  const stamp = new Date(r.from).toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "content-type": csv
        ? "text/csv; charset=utf-8"
        : "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="cap-${siteKey}-events-${stamp}.${csv ? "csv" : "ndjson"}"`,
      "cache-control": "no-store",
      "x-export-limit": String(limit),
    },
  });
}
