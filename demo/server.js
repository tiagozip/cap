import path from "path";
import Cap from "@cap.js/server";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

const fastify = Fastify();
const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname),
  prefix: "/",
});

fastify.get("/", (req, res) => {
  res.sendFile("index.html");
});

fastify.get("/cap.js", (req, res) => {
  res.sendFile("../widget/src/cap.js");
});

fastify.get("/cap-floating.js", (req, res) => {
  res.sendFile("../widget/src/cap-floating.js");
});

fastify.post("/api/challenge", (req, res) => {
  res.send(
    cap.createChallenge({
      challengeCount: 32,
      challengeDifficulty: 3,
    })
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
