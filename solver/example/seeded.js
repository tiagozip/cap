import solver from "../index.js";

const timeStart = Date.now();
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

console.log(solutions, "solutions");
console.log("took", (Date.now() - timeStart).toFixed(2), "ms");
