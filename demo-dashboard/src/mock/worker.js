let handlers;

self.onmessage = async ({ data }) => {
  if (data.init) {
    globalThis.demoSaved = data.saved;
    handlers = await import("./handlers.js");
    postMessage({ ready: true });
    return;
  }
  const { id, method, path, body } = data;
  postMessage({ id, result: await handlers.handle(method, path, body) });
};
