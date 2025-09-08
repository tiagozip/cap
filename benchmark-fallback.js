/**
 * Temporary benchmark to verify JavaScript fallback performance improvement
 * Run with: node --expose-gc benchmark-fallback.js
 */
const crypto = require('crypto');

// Current approach (string concatenation)
function benchmarkStringConcat(salt, iterations) {
  const encoder = new TextEncoder();
  const start = performance.now();
  
  for (let nonce = 0; nonce < iterations; nonce++) {
    const inputString = salt + nonce;
    const inputBytes = encoder.encode(inputString);
    crypto.createHash('sha256').update(inputBytes).digest();
  }
  
  return performance.now() - start;
}

// Optimized approach (buffer reuse)
function benchmarkBufferReuse(salt, iterations) {
  const encoder = new TextEncoder();
  const saltBytes = encoder.encode(salt);
  const MAX_NONCE_BYTES = 20;
  const inputBuffer = new Uint8Array(saltBytes.length + MAX_NONCE_BYTES);
  inputBuffer.set(saltBytes);
  
  const start = performance.now();
  
  for (let nonce = 0; nonce < iterations; nonce++) {
    const nonceStr = nonce.toString();
    const nonceBytes = encoder.encode(nonceStr);
    inputBuffer.set(nonceBytes, saltBytes.length);
    const inputView = inputBuffer.subarray(0, saltBytes.length + nonceBytes.length);
    crypto.createHash('sha256').update(inputView).digest();
  }
  
  return performance.now() - start;
}

function warmup(fn, salt, iterations) {
  // Warm up V8 JIT compilation
  for (let i = 0; i < 3; i++) {
    fn(salt, Math.min(iterations, 1000));
  }
}

function runBenchmark() {
  const salt = "benchmark_salt_" + Date.now();
  const iterations = 50000;
  const runs = 10;
  
  console.log('=== JavaScript Fallback Performance Comparison ===');
  console.log(`Salt: ${salt}`);
  console.log(`Iterations per run: ${iterations.toLocaleString()}`);
  console.log(`Benchmark runs: ${runs}`);
  console.log('');
  
  // Warmup both approaches
  console.log('Warming up...');
  warmup(benchmarkStringConcat, salt, iterations);
  warmup(benchmarkBufferReuse, salt, iterations);
  
  let stringTimes = [];
  let bufferTimes = [];
  
  console.log('Running benchmarks...');
  
  for (let run = 0; run < runs; run++) {
    if (global.gc) global.gc();
    const stringTime = benchmarkStringConcat(salt, iterations);
    stringTimes.push(stringTime);
    
    if (global.gc) global.gc();
    const bufferTime = benchmarkBufferReuse(salt, iterations);
    bufferTimes.push(bufferTime);
    
    process.stdout.write('.');
  }
  
  console.log(' Done.\n');
  
  const stringAvg = stringTimes.reduce((a, b) => a + b) / stringTimes.length;
  const bufferAvg = bufferTimes.reduce((a, b) => a + b) / bufferTimes.length;
  const improvement = ((stringAvg - bufferAvg) / stringAvg * 100);
  
  console.log('Results:');
  console.log(`String Concatenation: ${stringAvg.toFixed(2)}ms (avg)`);
  console.log(`Buffer Reuse:         ${bufferAvg.toFixed(2)}ms (avg)`);
  console.log(`Improvement:          ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
  console.log('');
  
  if (improvement > 2) {
    console.log('✅ Buffer reuse optimization shows meaningful improvement');
  } else if (improvement > 0) {
    console.log('⚠️  Buffer reuse shows marginal improvement');
  } else {
    console.log('❌ No improvement detected');
  }
}

runBenchmark();