import { afterAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { RedisClient } from "bun";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch (e) {
  console.warn(
    "[login-background-test] redis not available, skipping:",
    e.message,
  );
}

if (!redisAvailable) {
  test.skip(`login background skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  process.env.REDIS_PREFIX = `test_login_bg_${process.pid}:`;
  process.env.ADMIN_KEY ||= "test-admin-key-login-background-0123456789";
  process.env.HIDE_RATELIMIT_IP_WARNING = "true";
  process.env.DUCKDB_PATH = `${tmpdir()}/cap-login-bg-${process.pid}.duckdb`;

  const { createApp, loadSettingsCaches } = await import("../src/app.js");
  const { db } = await import("../src/db.js");
  await loadSettingsCaches();
  const app = createApp({}, { docs: false });

  const built = await Bun.file("public/dist/login.html").exists();

  const call = (method, path, { body, auth, headers = {} } = {}) => {
    if (auth) headers.Authorization = auth;
    if (body) headers["Content-Type"] = "application/json";
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  };

  const login = await (
    await call("POST", "/auth/login", {
      body: { admin_key: process.env.ADMIN_KEY },
    })
  ).json();
  const admin = `Bearer ${btoa(
    JSON.stringify({ token: login.session_token, hash: login.hashed_token }),
  )}`;

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(64, 7),
  ]);
  const webp = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x20, 0, 0, 0]),
    Buffer.from("WEBPVP8 "),
    Buffer.alloc(24, 1),
  ]);

  const upload = (bytes, auth = admin) =>
    call("PUT", "/server/settings/login-background/image", {
      auth,
      body: { data: Buffer.from(bytes).toString("base64") },
    });

  afterAll(async () => {
    const keys = await db.send("KEYS", ["*"]);
    if (keys.length) await db.send("DEL", keys);
  });

  describe("admin endpoints", () => {
    test("need a session", async () => {
      expect(
        (await call("GET", "/server/settings/login-background")).status,
      ).toBe(401);
      expect(
        (
          await call("PUT", "/server/settings/login-background", {
            body: { mode: "color", color: "#112233" },
          })
        ).status,
      ).toBe(401);
      expect((await upload(png, null)).status).toBe(401);
      expect(
        (await call("DELETE", "/server/settings/login-background/image"))
          .status,
      ).toBe(401);
    });

    test("default is the built-in backdrop", async () => {
      const res = await call("GET", "/server/settings/login-background", {
        auth: admin,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        mode: "default",
        color: null,
        image: null,
      });
    });

    test("saves a solid color", async () => {
      const res = await call("PUT", "/server/settings/login-background", {
        auth: admin,
        body: { mode: "color", color: "#1D3B5A" },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("color");
      expect(json.color).toBe("#1d3b5a");
      const pub = await (await call("GET", "/login-background.json")).json();
      expect(pub).toEqual({ mode: "color", color: "#1d3b5a" });
    });

    test("rejects bad colors", async () => {
      for (const color of ["red", "#12345", "#gggggg", "url(x)"]) {
        const res = await call("PUT", "/server/settings/login-background", {
          auth: admin,
          body: { mode: "color", color },
        });
        expect([400, 422]).toContain(res.status);
      }
    });

    test("image mode needs an image", async () => {
      const res = await call("PUT", "/server/settings/login-background", {
        auth: admin,
        body: { mode: "image" },
      });
      expect(res.status).toBe(400);
    });

    test("rejects files that aren't jpeg, png or webp by their bytes", async () => {
      const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;");
      expect((await upload(gif)).status).toBe(415);
      const html = Buffer.from("<svg onload=alert(1)>");
      expect((await upload(html)).status).toBe(415);
      const res = await call("PUT", "/server/settings/login-background/image", {
        auth: admin,
        body: { data: "not base64!!" },
      });
      expect(res.status).toBe(400);
    });

    test("rejects images over the size cap", async () => {
      const big = Buffer.concat([jpeg, Buffer.alloc(800_000)]);
      expect((await upload(big)).status).toBe(413);
    });

    test("the largest allowed image fits the server's 1 MiB body limit", async () => {
      const largest = Buffer.concat([
        jpeg,
        Buffer.alloc(750_000 - jpeg.length),
      ]);
      const body = JSON.stringify({ data: largest.toString("base64") });
      expect(body.length).toBeLessThan(1024 * 1024);
      expect((await upload(largest)).status).toBe(200);
    });

    test("accepts jpeg, png and webp", async () => {
      for (const [bytes, type] of [
        [jpeg, "image/jpeg"],
        [webp, "image/webp"],
        [png, "image/png"],
      ]) {
        const res = await upload(bytes);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.mode).toBe("image");
        expect(json.image.type).toBe(type);
        expect(json.image.size).toBe(bytes.length);
      }
    });

    test("keeps the color while showing the image", async () => {
      const res = await call("GET", "/server/settings/login-background", {
        auth: admin,
      });
      const json = await res.json();
      expect(json.mode).toBe("image");
      expect(json.color).toBe("#1d3b5a");
    });
  });

  describe("public endpoints", () => {
    test("serve the image with an etag", async () => {
      const meta = await (await call("GET", "/login-background.json")).json();
      expect(meta.mode).toBe("image");
      expect(meta.version).toMatch(/^[0-9a-f]{20}$/);

      const res = await call("GET", "/login-background");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toBe("public, no-cache");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("etag")).toBe(`"${meta.version}"`);
      expect(Buffer.from(await res.arrayBuffer()).equals(png)).toBe(true);

      const versioned = await call(
        "GET",
        `/login-background?v=${meta.version}`,
      );
      expect(versioned.headers.get("cache-control")).toContain("immutable");

      const cached = await call("GET", "/login-background", {
        headers: { "If-None-Match": `"${meta.version}"` },
      });
      expect(cached.status).toBe(304);
    });

    test("keeps a focus point for the image", async () => {
      const set = await call("PUT", "/server/settings/login-background", {
        auth: admin,
        body: { mode: "image", focus: [20, 85] },
      });
      expect(set.status).toBe(200);
      expect((await set.json()).image.focus).toEqual([20, 85]);
      const meta = await (await call("GET", "/login-background.json")).json();
      expect(meta.focus).toEqual([20, 85]);
      for (const focus of [[101, 0], [-1, 50], [50], ["a", 1]]) {
        const bad = await call("PUT", "/server/settings/login-background", {
          auth: admin,
          body: { mode: "image", focus },
        });
        expect([400, 422]).toContain(bad.status);
      }
      await upload(jpeg);
      const fresh = await (await call("GET", "/login-background.json")).json();
      expect(fresh.focus).toEqual([50, 50]);
      await upload(png);
    });

    test.if(built)(
      "the sign-in page carries the background and preloads the image",
      async () => {
        const meta = await (await call("GET", "/login-background.json")).json();
        const html = await (await call("GET", "/")).text();
        expect(html).toContain(`"loginBackground":${JSON.stringify(meta)}`);
        expect(html).toContain(
          `<link rel="preload" as="image" href="./login-background?v=${meta.version}"`,
        );
        const signedIn = await (
          await call("GET", "/", { headers: { cookie: "cap_authed=yes" } })
        ).text();
        expect(signedIn).not.toContain("CAP_PAGE");
      },
    );

    test("switching back to the default hides the image", async () => {
      await call("PUT", "/server/settings/login-background", {
        auth: admin,
        body: { mode: "default" },
      });
      expect(
        await (await call("GET", "/login-background.json")).json(),
      ).toEqual({ mode: "default" });
      expect((await call("GET", "/login-background")).status).toBe(404);

      const back = await call("PUT", "/server/settings/login-background", {
        auth: admin,
        body: { mode: "image" },
      });
      expect(back.status).toBe(200);
      expect((await call("GET", "/login-background")).status).toBe(200);
    });

    test("replacing the image drops the old bytes and old versions stop being immutable", async () => {
      const first = await (await call("GET", "/login-background.json")).json();
      const res = await upload(jpeg);
      expect(res.status).toBe(200);
      const next = await (await call("GET", "/login-background.json")).json();
      expect(next.version).not.toBe(first.version);
      expect(
        await db.getBuffer(`settings:login-background:image:${first.version}`),
      ).toBeNull();
      const stale = await call("GET", `/login-background?v=${first.version}`);
      expect(stale.status).toBe(200);
      expect(stale.headers.get("cache-control")).toBe("public, no-cache");
      expect(stale.headers.get("content-type")).toBe("image/jpeg");
    });

    test("another instance's change shows up without a restart", async () => {
      const raw = JSON.parse(await db.get("settings:login-background"));
      await db.set(
        "settings:login-background",
        JSON.stringify({ ...raw, mode: "color", color: "#0a0b0c" }),
      );
      expect(
        await (await call("GET", "/login-background.json")).json(),
      ).toEqual({ mode: "color", color: "#0a0b0c" });
      expect((await call("GET", "/login-background")).status).toBe(404);
      await db.set("settings:login-background", JSON.stringify(raw));
      expect((await call("GET", "/login-background")).status).toBe(200);
    });

    test("a late remove of an image that was already replaced does nothing", async () => {
      const { version } = await (
        await call("GET", "/login-background.json")
      ).json();
      const res = await call(
        "DELETE",
        "/server/settings/login-background/image?etag=0000000000",
        { auth: admin },
      );
      expect(res.status).toBe(200);
      const meta = await (await call("GET", "/login-background.json")).json();
      expect(meta.version).toBe(version);
      expect((await call("GET", "/login-background")).status).toBe(200);
    });

    test("removing the image falls back to the default", async () => {
      const { version } = await (
        await call("GET", "/login-background.json")
      ).json();
      const res = await call(
        "DELETE",
        "/server/settings/login-background/image",
        {
          auth: admin,
        },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("default");
      expect(json.image).toBeNull();
      expect((await call("GET", "/login-background")).status).toBe(404);
      expect(
        await db.getBuffer(`settings:login-background:image:${version}`),
      ).toBeNull();
    });
  });
}
