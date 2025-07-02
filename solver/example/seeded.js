import solver from "../index.js";

const timeStart = new Date().getTime();
const solutions = await solver(Math.random().toString(), {
  onProgress: (status) => {
    process.stdout.moveCursor(0, -1);
    process.stdout.clearScreenDown();
    console.log(`Progress: ${status.progress}%`);
  },
  c: 50,
  s: 30,
  d: 4,
});

process.stdout.moveCursor(0, -1);
process.stdout.clearScreenDown();

console.log("Solutions:", solutions);
console.log("Time taken:", ((new Date().getTime()) - timeStart).toFixed(2), "ms");