import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { capCheckpoint } from "../../../checkpoints/hono/index";
// import { capCheckpoint } from "@cap.js/checkpoint-hono";

const app = new Hono();

app.use(
  "*",
  capCheckpoint({
    /*
      token_validity_hours: 32, // how long the token is valid for
      tokens_store_path: ".data/tokensList.json",
      token_size: 16, // token size in bytes
      verification_template_path: join(
        dirname(fileURLToPath(import.meta.url)),
        "./index.html"
      )
    */
  })
);
app.get("/", serveStatic({ path: "./success.html" }));

export default app;
