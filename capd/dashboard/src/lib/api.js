export const url = (p) =>
  new URL(String(p).replace(/^\/+/, ""), document.baseURI).toString();

const authHeader = () => {
  try {
    const auth = JSON.parse(localStorage.getItem("cap_auth"));
    return auth
      ? `Bearer ${btoa(JSON.stringify({ token: auth.token, hash: auth.hash }))}`
      : null;
  } catch {
    return null;
  }
};

export const hasAuth = () => !!authHeader();

export function signOut({ revoke = false } = {}) {
  const authorization = revoke && authHeader();
  if (authorization)
    fetch(url("server/logout"), {
      method: "POST",
      headers: { Authorization: authorization },
      keepalive: true,
    }).catch(() => {});
  localStorage.removeItem("cap_auth");
  document.cookie =
    "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  location.reload();
}

export async function api(method, path, body) {
  try {
    const auth = authHeader();
    if (!auth) throw new Error("Not authenticated");
    const opts = { method, headers: {} };
    if (auth) opts.headers.Authorization = auth;
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url(`server${path}`), opts);
    const data = await res.json();
    if (res.status === 401) signOut();
    return data;
  } catch (e) {
    console.error("capd:", e);
    return { error: e.message };
  }
}

export const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) for (const x of v) sp.append(k, x);
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export function liveEvents(siteKey, onEvents) {
  let socket = null;
  let timer = null;
  let poll = null;
  let closed = false;
  let delay = 1000;
  const polling = (on) => {
    clearInterval(poll);
    poll = on ? setInterval(onEvents, 4000) : null;
  };
  const connect = () => {
    const authorization = authHeader();
    if (!authorization || closed) return;
    socket = new WebSocket(url("server/live").replace(/^http/, "ws"));
    socket.onopen = () =>
      socket.send(JSON.stringify({ authorization, siteKey }));
    socket.onmessage = ({ data }) => {
      let type;
      try {
        ({ type } = JSON.parse(data));
      } catch {
        return;
      }
      if (type === "ready") {
        delay = 1000;
        polling(false);
      }
      if (type === "events" || type === "ready") onEvents();
    };
    socket.onclose = ({ code }) => {
      if (closed || code === 4004) return;
      if (code === 4010) {
        closed = true;
        polling(true);
        return;
      }
      if (code === 4001) {
        closed = true;
        polling(true);
        api("GET", "/about");
        return;
      }
      if (!poll) polling(true);
      timer = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30_000);
    };
  };
  connect();
  return () => {
    closed = true;
    clearTimeout(timer);
    polling(false);
    socket?.close();
  };
}
