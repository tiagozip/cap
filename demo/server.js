const express = require("express");
const Cap = require("@cap.js/server");

const app = express();

app.use(express.json());

// app.use("/cap.js", express.static('../widget/src/cap.js'));
// app.use("/cap-floating.js", express.static('../widget/src/cap-floating.js'));

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

app.post("/api/challenge", (req, res) => {
  res.json(
    cap.createChallenge({
      challengeCount: 32,
      challengeDifficulty: 3,
    })
  );
});

app.post("/api/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  
  res.json(await cap.redeemChallenge({ token, solutions }));
});

app.listen(3000, () => {
  console.log("Listening on http://localhost:3000");
});
