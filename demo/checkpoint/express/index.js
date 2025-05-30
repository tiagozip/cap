import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { capCheckpoint } from "../../../checkpoints/express/index";
// import { capCheckpoint } from "@cap.js/checkpoint-express";

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(cookieParser());

app.use(
  capCheckpoint({
    /*
      token_validity_hours: 32,
      tokens_store_path: ".data/tokensList.json",
      token_size: 16,
      verification_template_path: join(__dirname, "./index.html"),
    */
  })
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "success.html"));
});

app.listen(3000, () => {
  console.log(`Server running on http://localhost:3000`);
});
