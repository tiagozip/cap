const hostPattern = (pattern) => {
  const labels = pattern.split(".");
  const valid =
    labels.length >= 3 &&
    labels.every((l) => /^[a-z0-9*-]+$/.test(l)) &&
    !labels.slice(-2).some((l) => l.includes("*")) &&
    labels.slice(1).every((l) => l !== "*");
  if (!valid) return null;
  return new RegExp(
    `^${labels
      .map((l, i) =>
        i === 0 && l === "*"
          ? "(?:[a-z0-9-]+\\.)+"
          : `${l.replaceAll("*", "[a-z0-9-]+")}${i < labels.length - 1 ? "\\." : ""}`,
      )
      .join("")}$`,
  );
};

const wildcard = (entry, url) => {
  const m = /^(https?):\/\/([^/]+)\/?$/.exec(entry);
  if (m && `${m[1]}:` !== url.protocol) return false;
  const hostPort = m ? m[2] : entry;
  const colon = hostPort.lastIndexOf(":");
  const host = colon < 0 ? hostPort : hostPort.slice(0, colon);
  const port = colon < 0 ? "" : hostPort.slice(colon + 1);
  if (port !== url.port) return false;
  return !!hostPattern(host)?.test(url.hostname);
};

export const matchOrigin = (origins, raw) => {
  const text = raw.trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`,
    );
  } catch {
    return { ok: false, invalid: true };
  }
  if (
    !/^(\[[\da-f:.]+\]|[\w.-]+)$/i.test(url.hostname) ||
    !["http:", "https:"].includes(url.protocol)
  )
    return { ok: false, invalid: true };
  const hit = origins.find(
    (entry) =>
      entry === url.origin ||
      entry === url.host ||
      (entry.includes("*") && wildcard(entry.toLowerCase(), url)),
  );
  return { ok: !!hit, match: hit, origin: url.origin };
};
