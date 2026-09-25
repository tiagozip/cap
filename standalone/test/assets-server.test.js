import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { RedisClient } from "bun";

setDefaultTimeout(30_000);

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
const probeClient = new RedisClient(REDIS_URL);
try {
  await probeClient.send("PING", []);
  redisAvailable = true;
} catch (e) {
  console.warn(
    "[assets-server-test] redis not available, skipping asset server tests:",
    e.message,
  );
}

if (!redisAvailable) {
  test.skip(`assets server skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;

  const { db } = await import("../src/db.js");

  const ASSET_KEYS = [
    "asset:cache-config",
    "asset:widget.js",
    "asset:floating.js",
    "asset:cap_wasm_bg.wasm",
    "asset:cap_wasm.js",
    "asset:hashwx.wasm",
  ];

  const COMMIT = "0123456789abcdef0123456789abcdef01234567";
  const KNOWN_REFS = new Set(["main", "v1.2.3", COMMIT]);

  const cdnHits = [];
  let cdnFailure = null; // null | "500" | "empty"
  // Makes the fake CDN answer slowly, so a refresh stays in flight long enough
  // for a concurrent request to observe it (single-flight test).
  let cdnDelayMs = 0;

  // Fake jsDelivr for the fork's GitHub channel. A ref that does not exist is
  // a real 404 here, the way the real CDN behaves (task 005's fake CDN always
  // answered 200, which is how the npm-version regression slipped through).
  const cdnServer = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const { pathname } = new URL(request.url);
      cdnHits.push(pathname);
      if (cdnDelayMs) await Bun.sleep(cdnDelayMs);

      const gh = pathname.match(
        /^\/gh\/KurisuRakko\/priestess-verification@([^/]+)\/widget\/src\/(cap\.min\.js|cap-floating\.min\.js)$/,
      );
      if (gh) {
        const [, ref, file] = gh;
        if (!KNOWN_REFS.has(ref)) {
          return new Response("Couldn't find the requested file", {
            status: 404,
          });
        }
        if (cdnFailure === "500") return new Response("boom", { status: 500 });
        if (cdnFailure === "empty") return new Response("");
        const body =
          file === "cap-floating.min.js"
            ? `/*FLOATING ref=${ref}*/`
            : `/*WIDGET ref=${ref}*/`;
        return new Response(body, {
          headers: { "content-type": "application/javascript" },
        });
      }
      if (pathname.startsWith("/npm/@cap.js/wasm@")) {
        return new Response(`WASM:${pathname}`, {
          headers: { "content-type": "application/octet-stream" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  });

  // A port that is known to be closed, to simulate a network error.
  const deadServer = Bun.serve({ port: 0, fetch: () => new Response("x") });
  const deadPort = deadServer.port;
  deadServer.stop(true);

  const savedEnv = {
    ENABLE_ASSETS_SERVER: process.env.ENABLE_ASSETS_SERVER,
    WIDGET_VERSION: process.env.WIDGET_VERSION,
    WASM_VERSION: process.env.WASM_VERSION,
    CACHE_HOST: process.env.CACHE_HOST,
  };

  const withEnv = async (env, run) => {
    const previous = new Map();
    for (const [key, value] of Object.entries(env)) {
      previous.set(key, process.env[key]);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      return await run();
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };

  const cdnEnv = (extra = {}) => ({
    ENABLE_ASSETS_SERVER: "true",
    CACHE_HOST: `http://127.0.0.1:${cdnServer.port}`,
    WIDGET_VERSION: undefined,
    WASM_VERSION: undefined,
    ...extra,
  });

  const clearAssets = () => db.del(...ASSET_KEYS);

  const seedLegacyCache = async (widgetVersion) => {
    await db.set(
      "asset:cache-config",
      JSON.stringify({
        lastUpdate: 111,
        versions: { widget: widgetVersion, wasm: "latest" },
      }),
    );
    await db.set("asset:widget.js", "STALE-UPSTREAM-NPM-WIDGET");
    await db.set("asset:floating.js", "STALE-UPSTREAM-NPM-FLOATING");
  };

  let caseId = 0;
  const freshAssetsServer = async () => {
    caseId += 1;
    const { assetsServer } = await import(`../src/assets.js?case=${caseId}`);
    return assetsServer;
  };

  const getAsset = (app, path) =>
    app.handle(new Request(`http://localhost/assets${path}`));

  const waitFor = async (read, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await read();
      if (value) return value;
      if (Date.now() >= deadline) return null;
      await Bun.sleep(50);
    }
  };

  const captureConsole = (method) => {
    const original = console[method];
    const lines = [];
    console[method] = (...args) =>
      lines.push(
        args
          .map((arg) => (arg instanceof Error ? arg.message : String(arg)))
          .join(" "),
      );
    return {
      lines,
      restore: () => {
        console[method] = original;
      },
    };
  };

  afterAll(async () => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await clearAssets().catch(() => {});
    cdnServer.stop(true);
    probeClient.close();
  });

  describe("assets server widget source", () => {
    test("unset and 'latest' both track the fork's main branch", async () => {
      for (const version of [undefined, "latest"]) {
        await withEnv(cdnEnv({ WIDGET_VERSION: version }), async () => {
          await clearAssets();
          cdnHits.length = 0;
          const app = await freshAssetsServer();

          const cached = await waitFor(() => db.get("asset:widget.js"));
          expect(cached).toBe("/*WIDGET ref=main*/");
          expect(cdnHits).toContain(
            "/gh/KurisuRakko/priestess-verification@main/widget/src/cap.min.js",
          );

          const res = await getAsset(app, "/widget.js");
          expect(res.status).toBe(200);
          expect(await res.text()).toBe("/*WIDGET ref=main*/");

          const config = JSON.parse(await db.get("asset:cache-config"));
          expect(config.versions.widget).toBe("gh:main");
        });
      }
    });

    test("v-tags and commit shas are used as git refs verbatim", async () => {
      for (const ref of ["v1.2.3", COMMIT]) {
        await withEnv(cdnEnv({ WIDGET_VERSION: ref }), async () => {
          await clearAssets();
          cdnHits.length = 0;
          const app = await freshAssetsServer();

          const cached = await waitFor(() => db.get("asset:widget.js"));
          expect(cached).toBe(`/*WIDGET ref=${ref}*/`);
          expect(cdnHits).toContain(
            `/gh/KurisuRakko/priestess-verification@${ref}/widget/src/cap.min.js`,
          );

          const config = JSON.parse(await db.get("asset:cache-config"));
          expect(config.versions.widget).toBe(`gh:${ref}`);

          const res = await getAsset(app, "/widget.js");
          expect(res.status).toBe(200);
          expect(await res.text()).toBe(`/*WIDGET ref=${ref}*/`);
        });
      }
    });

    test("a bare npm version is ignored in favor of main, with a warning", async () => {
      await withEnv(cdnEnv({ WIDGET_VERSION: "0.1.58" }), async () => {
        await clearAssets();
        cdnHits.length = 0;

        const warnings = captureConsole("warn");
        let app;
        try {
          app = await freshAssetsServer();
        } finally {
          warnings.restore();
        }

        const logged = warnings.lines.join("\n");
        expect(logged).toContain(
          'WIDGET_VERSION="0.1.58" looks like an upstream npm version',
        );
        expect(logged).toContain('using "main" instead');

        const cached = await waitFor(() => db.get("asset:widget.js"));
        expect(cached).toBe("/*WIDGET ref=main*/");
        expect(cdnHits.some((path) => path.includes("@0.1.58"))).toBe(false);

        const res = await getAsset(app, "/widget.js");
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("/*WIDGET ref=main*/");
      });
    });

    test("a warm npm-era cache is replaced with the fork build", async () => {
      await withEnv(cdnEnv({ WIDGET_VERSION: "0.1.58" }), async () => {
        await clearAssets();
        await seedLegacyCache("0.1.58");
        cdnHits.length = 0;
        const app = await freshAssetsServer();

        const cached = await waitFor(async () => {
          const value = await db.get("asset:widget.js");
          return value === "/*WIDGET ref=main*/" ? value : null;
        });
        expect(cached).toBe("/*WIDGET ref=main*/");

        const res = await getAsset(app, "/widget.js");
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("/*WIDGET ref=main*/");

        const config = JSON.parse(await db.get("asset:cache-config"));
        expect(config.versions.widget).toBe("gh:main");
        expect(config.lastUpdate).toBeGreaterThan(111);
      });
    });

    test("a warm fork cache for the same ref is served without refetching", async () => {
      await withEnv(cdnEnv(), async () => {
        await clearAssets();
        await db.set(
          "asset:cache-config",
          JSON.stringify({
            lastUpdate: Date.now(),
            versions: { widget: "gh:main", wasm: "latest" },
          }),
        );
        await db.set("asset:widget.js", "CACHED-FORK-WIDGET");
        cdnHits.length = 0;
        const app = await freshAssetsServer();
        await Bun.sleep(200);

        expect(
          cdnHits.filter((path) => path.endsWith("cap.min.js")),
        ).toHaveLength(0);

        const res = await getAsset(app, "/widget.js");
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("CACHED-FORK-WIDGET");
      });
    });

    test("a warm fork cache for another ref is refreshed", async () => {
      await withEnv(cdnEnv(), async () => {
        await clearAssets();
        await db.set(
          "asset:cache-config",
          JSON.stringify({
            lastUpdate: Date.now(),
            versions: { widget: "gh:v1.2.3", wasm: "latest" },
          }),
        );
        await db.set("asset:widget.js", "CACHED-FORK-WIDGET-V123");
        cdnHits.length = 0;
        const app = await freshAssetsServer();

        const cached = await waitFor(async () => {
          const value = await db.get("asset:widget.js");
          return value === "/*WIDGET ref=main*/" ? value : null;
        });
        expect(cached).toBe("/*WIDGET ref=main*/");

        const res = await getAsset(app, "/widget.js");
        expect(await res.text()).toBe("/*WIDGET ref=main*/");
      });
    });

    test("a 404 drops a non-fork cache instead of serving it", async () => {
      await withEnv(cdnEnv({ WIDGET_VERSION: "no-such-ref" }), async () => {
        await clearAssets();
        await seedLegacyCache("0.1.58");
        const errors = captureConsole("error");
        try {
          const app = await freshAssetsServer();

          // The failing refresh drops the npm-era widget ...
          const dropped = await waitFor(
            async () => !(await db.get("asset:widget.js")),
          );
          expect(dropped).toBe(true);
          expect(await db.get("asset:floating.js")).toBeFalsy();

          // ... and does not mark the cache as fresh or write a version.
          const config = JSON.parse(await db.get("asset:cache-config"));
          expect(config.versions.widget).toBe("0.1.58");
          expect(config.lastUpdate).toBe(111);

          const res = await getAsset(app, "/widget.js");
          expect(res.status).toBe(503);
          expect(await res.text()).not.toContain("STALE");

          const logged = errors.lines.join("\n");
          expect(logged).toContain("failed to update assets cache");
          expect(logged).toContain("responded with 404");
        } finally {
          errors.restore();
        }
      });
    });

    test("a failing refresh keeps a warm fork cache", async () => {
      await withEnv(cdnEnv({ WIDGET_VERSION: "no-such-ref" }), async () => {
        await clearAssets();
        await db.set(
          "asset:cache-config",
          JSON.stringify({
            lastUpdate: 111,
            versions: { widget: "gh:main", wasm: "latest" },
          }),
        );
        await db.set("asset:widget.js", "CACHED-FORK-WIDGET");
        const errors = captureConsole("error");
        try {
          const app = await freshAssetsServer();
          await waitFor(() => errors.lines.length > 0);

          expect(await db.get("asset:widget.js")).toBe("CACHED-FORK-WIDGET");
          const res = await getAsset(app, "/widget.js");
          expect(res.status).toBe(200);
          expect(await res.text()).toBe("CACHED-FORK-WIDGET");
        } finally {
          errors.restore();
        }
      });
    });

    test("5xx and empty bodies are never cached", async () => {
      try {
        for (const failure of ["500", "empty"]) {
          await withEnv(cdnEnv(), async () => {
            await clearAssets();
            cdnFailure = failure;
            cdnHits.length = 0;
            const errors = captureConsole("error");
            try {
              const app = await freshAssetsServer();
              await waitFor(() => errors.lines.length > 0);

              expect(await db.get("asset:cache-config")).toBeFalsy();
              expect(await db.get("asset:widget.js")).toBeFalsy();

              const res = await getAsset(app, "/widget.js");
              expect(res.status).toBe(503);
              expect(await res.text()).not.toContain("boom");
            } finally {
              errors.restore();
            }
          });
        }
      } finally {
        cdnFailure = null;
      }
    });

    test("a network error recovers on a later request", async () => {
      await withEnv(
        { ...cdnEnv(), CACHE_HOST: `http://127.0.0.1:${deadPort}` },
        async () => {
          await clearAssets();
          const errors = captureConsole("error");
          try {
            const app = await freshAssetsServer();
            await waitFor(() => errors.lines.length > 0);
            expect(await db.get("asset:widget.js")).toBeFalsy();

            let res = await getAsset(app, "/widget.js");
            expect(res.status).toBe(503);

            // CACHE_HOST comes back; a later request triggers the retry.
            process.env.CACHE_HOST = `http://127.0.0.1:${cdnServer.port}`;
            const cached = await waitFor(async () => {
              await getAsset(app, "/widget.js");
              return db.get("asset:widget.js");
            }, 15_000);
            expect(cached).toBe("/*WIDGET ref=main*/");

            res = await getAsset(app, "/widget.js");
            expect(res.status).toBe(200);
            expect(await res.text()).toBe("/*WIDGET ref=main*/");

            expect(errors.lines.join("\n")).toContain("could not be fetched");
          } finally {
            errors.restore();
          }
        },
      );
    });

    test("a current config with a missing asset key is refetched, not 503ing for a day", async () => {
      await withEnv(cdnEnv(), async () => {
        await clearAssets();
        // The partial-write state S1 describes: the config claims a successful
        // recent update, but the asset key it describes is not there (a
        // partial write from an older release, an evicted or deleted key).
        await db.set(
          "asset:cache-config",
          JSON.stringify({
            lastUpdate: Date.now(),
            versions: { widget: "gh:main", wasm: "latest" },
          }),
        );
        cdnHits.length = 0;
        const warnings = captureConsole("warn");
        try {
          const app = await freshAssetsServer();
          await Bun.sleep(200); // let the import-time updateCache() settle
          expect(await db.get("asset:widget.js")).toBeFalsy();

          const res = await getAsset(app, "/widget.js");
          expect(res.status).toBe(503);

          // The missing key must count as "needs refresh" even though the
          // config says otherwise: the CDN is hit and the asset comes back.
          const cached = await waitFor(() => db.get("asset:widget.js"), 10_000);
          expect(cached).toBe("/*WIDGET ref=main*/");
          expect(
            cdnHits.filter((path) => path.endsWith("cap.min.js")),
          ).toHaveLength(1);

          const logged = warnings.lines.join("\n");
          expect(logged).toContain(
            "asset:widget.js is missing while asset:cache-config says the cache is current",
          );

          const config = JSON.parse(await db.get("asset:cache-config"));
          expect(config.assets).toContain("asset:widget.js");

          const recovered = await getAsset(app, "/widget.js");
          expect(recovered.status).toBe(200);
          expect(await recovered.text()).toBe("/*WIDGET ref=main*/");
        } finally {
          warnings.restore();
        }
      });
    });

    test("a 503 is not cacheable", async () => {
      await withEnv(
        { ...cdnEnv(), CACHE_HOST: `http://127.0.0.1:${deadPort}` },
        async () => {
          await clearAssets();
          const errors = captureConsole("error");
          try {
            const app = await freshAssetsServer();
            const res = await getAsset(app, "/widget.js");
            expect(res.status).toBe(503);
            expect(res.headers.get("cache-control")).toBe("no-store");
          } finally {
            errors.restore();
          }
        },
      );
    });

    test("a served asset keeps the immutable cache header", async () => {
      await withEnv(cdnEnv(), async () => {
        await clearAssets();
        const app = await freshAssetsServer();
        const cached = await waitFor(() => db.get("asset:widget.js"));
        expect(cached).toBe("/*WIDGET ref=main*/");

        const res = await getAsset(app, "/widget.js");
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe(
          "max-age=31536000, immutable",
        );
      });
    });

    test("concurrent requests share a single refresh", async () => {
      await withEnv(cdnEnv(), async () => {
        await clearAssets();
        await db.set(
          "asset:cache-config",
          JSON.stringify({
            lastUpdate: Date.now(),
            versions: { widget: "gh:main", wasm: "latest" },
          }),
        );
        cdnHits.length = 0;
        cdnDelayMs = 300;
        const warnings = captureConsole("warn");
        try {
          const app = await freshAssetsServer();
          await Bun.sleep(200); // let the import-time updateCache() settle
          expect(await db.get("asset:widget.js")).toBeFalsy();

          // Both requests find the key missing and ask for a refresh; only one
          // refresh (and therefore one CDN request) may be started.
          const [first, second] = await Promise.all([
            getAsset(app, "/widget.js"),
            getAsset(app, "/widget.js"),
          ]);
          expect(first.status).toBe(503);
          expect(second.status).toBe(503);

          const cached = await waitFor(() => db.get("asset:widget.js"), 10_000);
          expect(cached).toBe("/*WIDGET ref=main*/");
          expect(
            cdnHits.filter((path) => path.endsWith("cap.min.js")),
          ).toHaveLength(1);

          const config = JSON.parse(await db.get("asset:cache-config"));
          expect(config.versions.widget).toBe("gh:main");
        } finally {
          cdnDelayMs = 0;
          warnings.restore();
        }
      });
    });

    test("asset fetches are bounded by the 30s abort timeout", async () => {
      await withEnv(cdnEnv(), async () => {
        await clearAssets();
        const timeouts = [];
        const signals = [];
        const originalTimeout = AbortSignal.timeout;
        const originalFetch = globalThis.fetch;
        // Replace AbortSignal.timeout with a recorder that hands out a plain,
        // timer-free signal: the point is that every fetch is guarded and with
        // which value, not to actually wait 30 seconds for a timeout.
        AbortSignal.timeout = (ms) => {
          timeouts.push(ms);
          return new AbortController().signal;
        };
        globalThis.fetch = async (_url, options = {}) => {
          signals.push(options.signal);
          return new Response("/*STUB*/");
        };
        try {
          await freshAssetsServer();
          const cached = await waitFor(() => db.get("asset:widget.js"));
          expect(cached).toBe("/*STUB*/");

          expect(timeouts.length).toBeGreaterThanOrEqual(5);
          expect(timeouts.every((ms) => ms === 30_000)).toBe(true);
          expect(signals.length).toBeGreaterThanOrEqual(5);
          expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(
            true,
          );
        } finally {
          AbortSignal.timeout = originalTimeout;
          globalThis.fetch = originalFetch;
        }
      });
    });
  });
}
