# M2M

`@cap.js/solver` is a standalone library that can be used to solve Cap challenges from the server. It's extremely simple (no dependencies, one single file) yet as fast and efficient as the widget. Note that it can **only be used with Bun**.

This package does not bypass any actual proof-of-work. **It does not support instrumentation challenges.**

## Installation

```bash
bun add @cap.js/solver
```

## Usage

#### From seeded challenges

```js
import solver from "@cap.js/solver";

console.log(
  await solver("challenge token", {
    c: 50, // challenge count
    s: 32, // salt size
    d: 4, // difficulty
  }),
);
```

#### From challenge list

```js
import solver from "@cap.js/solver";

const challenges = [
  ["a5b6fda4aaed97cf61d7dd9259f733b5", "d455"],
  ["286bcc39249f9ee698314b600c32e40f", "f0ff"],
  ["501350aa7c46573cb604284554045703", "4971"],
  ["a55c02f3b9b4cd088a5a7ee3d4941c14", "eab7"],
  ["5f3362c12e2779f56f4ef75b4494f5e6", "999f"],
  /* ... */
];

console.log(await solver(challenges));
```

**Output:**

```json
[67302, 64511, 40440, 27959, 71259 /* ... */]
```

The 2nd argument is optional but can always be provided. It's always an object.

- For **all challenge types**, `workerCount` indicates the number of workers to use (default is the number of CPU cores).

- For **all challenge types**, `onProgress` can also be used to provide a callback for progress updates.

- For **seeded challenges only**, it is used to specify the number of solutions to generate, the size of the challenges, and the difficulty
