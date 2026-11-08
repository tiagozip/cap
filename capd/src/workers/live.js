import { Elysia } from "elysia";

export const startLive = async () => {};
export const stopLive = () => {};
export const liveServer = new Elysia();

export const liveUnavailable = (request) => {
  if (request.headers.get("upgrade") !== "websocket") return null;
  if (new URL(request.url).pathname !== "/server/live") return null;
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(4010, "Live updates aren't available on Workers");
  return new Response(null, { status: 101, webSocket: client });
};
