import { Elysia, file } from "elysia";
import { capMiddleware } from "../../../checkpoints/elysia/index";
// import { capMiddleware } from "@cap.js/middleware-elysia";

new Elysia()
  .use(
    capMiddleware({
      /*
        token_validity_hours: 32, // how long the token is valid for
        tokens_store_path: ".data/tokensList.json",
        token_size: 16, // token size in bytes
        verification_template_path: join(
          dirname(fileURLToPath(import.meta.url)),
          "./index.html"
        ),
        scoping: "scoped", // 'global' | 'scoped'
      */
    })
  )
  .get("/", () => file("success.html"))
  .listen(3000);
