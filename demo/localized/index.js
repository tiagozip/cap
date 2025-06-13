// mirrored from /demo/main/index.js

import fs from "fs/promises";
import { Elysia, file } from "elysia";
import Cap from "@cap.js/server";

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

const app = new Elysia();

app.get("/", () => file("./index.html"));

app.get("/cap.js", async ({ set }) => {
  // in the newest version, the worker is injected into the main file
  // by a build script. since we don't have a build script here,
  // we'll need to build it ourselves.

  const main = await fs.readFile("../../widget/src/src/cap.js", "utf-8");
  const worker = await fs.readFile("../../widget/src/src/worker.js", "utf-8");

  const bundle = main.replace("%%workerScript%%", worker);

  set.headers = {
    "Content-Type": "application/javascript",
  };

  return bundle;
});

app.get("/cap-floating.js", () => file("../../widget/src/src/cap-floating.js"));

app.post("/api/challenge", () => cap.createChallenge());

app.post("/api/redeem", async ({ body, set }) => {
  const { token, solutions } = body;
  if (!token || !solutions) {
    set.status = 400;
    return { success: false };
  }

  const answer = await cap.redeemChallenge({ token, solutions });

  console.log("new challenge redeemed", {
    ...answer,
    isValid: (await cap.validateToken(answer.token)).success,
  });

  return answer;
});

app.listen(3000);
console.log("Server is running on http://localhost:3000");
