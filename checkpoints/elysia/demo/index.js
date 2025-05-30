import { Elysia, file } from "elysia";
// import { capMiddleware } from "@cap.js/elysia-middleware";
import { capMiddleware } from "../plugin/index";

new Elysia()
  .use(
    capMiddleware({
      /*

          token_validity_hours: 32,
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
