const express = require('express');
const crypto = require('crypto');
const Cap = require('./index.js');

const app = express();
app.use(express.json());

const cap = new Cap({
  tokens_store_path: '.data/tokensList.json'
});

function solveChallenge(salt, target) {
  let nonce = 0;
  while (true) {
    if (crypto.createHash('sha256').update(salt + nonce.toString()).digest('hex').startsWith(target)) {
      return nonce.toString();
    }
    nonce++;
  }
}

app.post('/api/challenge', (req, res) => {
  res.json(cap.createChallenge({
    challengeCount: 2,
    challengeSize: 16,
    challengeDifficulty: 3,
    expiresMs: 300000
  }));
});

app.post('/api/redeem', async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.redeemChallenge({ token, solutions }));
});

app.post('/api/validate', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.validateToken(token));
});

async function test() {
  const { challenge, token } = await fetch('http://localhost:3000/api/challenge', {
    method: 'POST'
  }).then(r => r.json());

  const solutions = challenge.map(([salt, target]) => [salt, target, solveChallenge(salt, target)]);
  const { success, token: verToken } = await fetch('http://localhost:3000/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, solutions })
  }).then(r => r.json());

  if (!success || !verToken) {
    throw new Error('Failed to redeem challenge');
  }

  const validation = await fetch('http://localhost:3000/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: verToken })
  }).then(r => r.json());

  if (!validation.success) {
    throw new Error('Failed to validate token');
  }

  console.log('All tests passed!');
  process.exit(0);
}

app.listen(3000, test);