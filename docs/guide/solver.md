# @cap.js/solver

`@cap.js/solver` is a standalone library that can be used to solve Cap challenges from the server. It's extremely simple (no dependencies, one single file) yet very fast and efficient. Note that it can only be used with Bun.

## Installation

```bash
bun add @cap.js/solver
```

## Usage

```js
import solver from "@cap.js/solver";

const CHALLENGES = [
  ["a5b6fda4aaed97cf61d7dd9259f733b5", "d455"],
  ["286bcc39249f9ee698314b600c32e40f", "f0ff"],
  ["501350aa7c46573cb604284554045703", "4971"],
  ["a55c02f3b9b4cd088a5a7ee3d4941c14", "eab7"],
  ["5f3362c12e2779f56f4ef75b4494f5e6", "999f"],
  /* ... */
];

console.log(await solver(CHALLENGES));
```

**Output:**

```json
[
  ["a5b6fda4aaed97cf61d7dd9259f733b5", "d455", 67302],
  ["286bcc39249f9ee698314b600c32e40f", "f0ff", 64511],
  ["501350aa7c46573cb604284554045703", "4971", 40440],
  ["a55c02f3b9b4cd088a5a7ee3d4941c14", "eab7", 27959],
  ["5f3362c12e2779f56f4ef75b4494f5e6", "999f", 71259],
  ...
]
```

## FAQ

### Why is this needed?
Mainly for M2M interactions, where you want to solve Cap challenges on the server without user interaction.

### Doesn't this defeat the purpose of Cap?
Not really. Server-side solving is a core use case of proof-of-work CAPTCHAs like Cap or altcha. It's about proving effort, not necessarily involving a human. [Learn more](./effectiveness.md)