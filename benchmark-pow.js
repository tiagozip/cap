/**
 * Cap PoW benchmark using actual challenge format and difficulty
 * Run with: node --expose-gc benchmark-pow.js
 */
const crypto = require('crypto');

// Actual Cap PRNG implementation (from cap.js)
function prng(seed, length) {
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  let state = fnv1a(seed);
  let result = "";

  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }

  while (result.length < length) {
    const rnd = next();
    result += rnd.toString(16).padStart(8, "0");
  }

  return result.substring(0, length);
}

// Generate realistic Cap challenges
function generateCapChallenges(token, count = 5, challengeSize = 32, difficulty = 4) {
  const challenges = [];
  for (let i = 1; i <= count; i++) {
    const salt = prng(`${token}${i}`, challengeSize);
    const target = prng(`${token}${i}d`, difficulty);
    challenges.push([salt, target]);
  }
  return challenges;
}

// Convert hex target to bytes for comparison
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Current implementation (string concatenation)
async function solveCapChallengeStringConcat(salt, target, maxAttempts = 200000) {
  const encoder = new TextEncoder();
  const targetBytes = hexToBytes(target);
  
  let nonce = 0;
  const start = performance.now();
  
  while (nonce < maxAttempts) {
    const inputString = salt + nonce;
    const inputBytes = encoder.encode(inputString);
    
    const hashBuffer = await crypto.subtle.digest("SHA-256", inputBytes);
    const hashBytes = new Uint8Array(hashBuffer);
    
    // Check if first difficulty/2 bytes match target
    let matches = true;
    for (let i = 0; i < targetBytes.length; i++) {
      if (hashBytes[i] !== targetBytes[i]) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      return {
        nonce,
        time: performance.now() - start,
        attempts: nonce + 1,
        found: true
      };
    }
    
    nonce++;
  }
  
  return {
    nonce: null,
    time: performance.now() - start,
    attempts: maxAttempts,
    found: false
  };
}

// Optimized implementation (buffer reuse)
async function solveCapChallengeBufferReuse(salt, target, maxAttempts = 200000) {
  const encoder = new TextEncoder();
  const targetBytes = hexToBytes(target);
  const saltBytes = encoder.encode(salt);
  const MAX_NONCE_BYTES = 20;
  const inputBuffer = new Uint8Array(saltBytes.length + MAX_NONCE_BYTES);
  inputBuffer.set(saltBytes);
  
  let nonce = 0;
  const start = performance.now();
  
  while (nonce < maxAttempts) {
    const nonceStr = nonce.toString();
    const nonceBytes = encoder.encode(nonceStr);
    
    inputBuffer.set(nonceBytes, saltBytes.length);
    const inputView = inputBuffer.subarray(0, saltBytes.length + nonceBytes.length);
    
    const hashBuffer = await crypto.subtle.digest("SHA-256", inputView);
    const hashBytes = new Uint8Array(hashBuffer);
    
    // Check if first difficulty/2 bytes match target  
    let matches = true;
    for (let i = 0; i < targetBytes.length; i++) {
      if (hashBytes[i] !== targetBytes[i]) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      return {
        nonce,
        time: performance.now() - start,
        attempts: nonce + 1,
        found: true
      };
    }
    
    nonce++;
  }
  
  return {
    nonce: null,
    time: performance.now() - start,
    attempts: maxAttempts,
    found: false
  };
}

async function benchmarkCapPoW() {
  console.log('=== Cap Proof-of-Work Benchmark ===');
  console.log('Using actual Cap challenge format and default difficulty\n');
  
  const token = "benchmark_" + Date.now();
  const challenges = generateCapChallenges(token, 3, 32, 4); // Default Cap parameters
  
  console.log(`Generated ${challenges.length} challenges with difficulty 4 (2 bytes):`);
  challenges.forEach(([salt, target], i) => {
    console.log(`  Challenge ${i+1}: ${target} (target) from salt ${salt.substring(0,16)}...`);
  });
  console.log('');
  
  let stringTotalTime = 0;
  let bufferTotalTime = 0;
  let stringTotalAttempts = 0;
  let bufferTotalAttempts = 0;
  let solvedCount = 0;
  
  for (let i = 0; i < challenges.length; i++) {
    const [salt, target] = challenges[i];
    console.log(`Solving challenge ${i+1}/${challenges.length} (target: ${target})...`);
    
    // Test string concatenation approach
    if (global.gc) global.gc();
    const stringResult = await solveCapChallengeStringConcat(salt, target);
    stringTotalTime += stringResult.time;
    stringTotalAttempts += stringResult.attempts;
    
    // Test buffer reuse approach  
    if (global.gc) global.gc();
    const bufferResult = await solveCapChallengeBufferReuse(salt, target);
    bufferTotalTime += bufferResult.time;
    bufferTotalAttempts += bufferResult.attempts;
    
    if (stringResult.found && bufferResult.found) {
      solvedCount++;
      console.log(`  Solved in ${stringResult.attempts}/${bufferResult.attempts} attempts`);
    } else {
      console.log(`  Not solved within attempt limit`);
    }
  }
  
  console.log('\n=== Results ===');
  console.log(`Challenges solved: ${solvedCount}/${challenges.length}`);
  console.log(`String Concatenation: ${stringTotalTime.toFixed(0)}ms total, ${stringTotalAttempts.toLocaleString()} attempts`);
  console.log(`Buffer Reuse:         ${bufferTotalTime.toFixed(0)}ms total, ${bufferTotalAttempts.toLocaleString()} attempts`);
  
  if (solvedCount > 0) {
    const avgStringTime = stringTotalTime / solvedCount;
    const avgBufferTime = bufferTotalTime / solvedCount;
    const improvement = ((avgStringTime - avgBufferTime) / avgStringTime * 100);
    
    console.log(`\nAverage per solved challenge:`);
    console.log(`String Concatenation: ${avgStringTime.toFixed(0)}ms`);
    console.log(`Buffer Reuse:         ${avgBufferTime.toFixed(0)}ms`);
    console.log(`Improvement:          ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    
    if (improvement > 5) {
      console.log('\nMeaningful improvement in real Cap PoW scenarios');
    } else if (improvement > 0) {
      console.log('\nMarginal improvement');  
    } else {
      console.log('\nNo improvement or slower');
    }
  }
  
  console.log('\nNote: This benchmarks the actual Cap JavaScript fallback path');
  console.log('with realistic challenge parameters (default: 50 challenges, difficulty 4).');
}

benchmarkCapPoW().catch(console.error);