import fs from "fs";
import path from "path";
import Cap from "@cap.js/server";
import Fastify from "fastify";

const fastify = Fastify();
const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

fastify.get("/", (req, res) => {
  res.header("Content-Type", "text/html");
  res.send(fs.createReadStream(path.join(__dirname, "index.html")));
});

fastify.get("/cap.js", (req, res) => {
  res.header("Content-Type", "application/javascript");
  res.send(fs.createReadStream(path.join(__dirname, "../widget/src/cap.js")));
});

fastify.get("/cap-floating.js", (req, res) => {
  res.header("Content-Type", "application/javascript");
  res.send(fs.createReadStream(path.join(__dirname, "../widget/src/cap-floating.js")));
});

fastify.post("/api/challenge", (req, res) => {
  res.send(
    cap.createChallenge()
  );
});

fastify.post("/api/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.code(400).send({ success: false });
  }

  res.send(await cap.redeemChallenge({ token, solutions }));
});

fastify.listen({ port: 3000, host: "0.0.0.0" }).then(() => {
  console.log("Server is running on http://localhost:3000");
});
