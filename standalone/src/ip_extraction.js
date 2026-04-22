import { getHeaders } from "./settings-cache.js";

const DEFAULT_IP_HEADERS = ["X-Forwarded-For", "X-Real-IP", "CF-Connecting-IP"];

export function getClientIp(request, srv) {
  const cachedHeaders = getHeaders();
  const headerName = cachedHeaders?.ipHeader || process.env.RATELIMIT_IP_HEADER;
  if (headerName) {
    const ip = request.headers.get(headerName) || request.headers.get(headerName.toLowerCase());
    if (ip) {
      const parts = ip.split(",").filter((e) => !!e.trim());
      return parts[0].trim();
    }
  }

  for (const h of DEFAULT_IP_HEADERS) {
    const val = request.headers.get(h);
    if (val) {
      const parts = val.split(",").filter((e) => !!e.trim());
      return parts[0].trim();
    }
  }
  return srv?.requestIP(request)?.address || null;
}