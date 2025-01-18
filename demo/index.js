const express = require('express');
const Cap = require('@cap.js/server');

const app = express();

app.use(express.json());
app.use(express.static('public'));
/* app.use("/capsource", express.static('../widget/src/cap.js')); */

const cap = new Cap({
  tokens_store_path: '.data/tokensList.json'
});

app.post('/api/challenge', (req, res) => {
  res.json(cap.createChallenge());
});

app.post('/api/redeem', async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.redeemChallenge({ token, solutions }));
});

app.listen(3000, () => {
  console.log('Listening on port 3000');
})