# @cap.js/cli

`cli` is a simple command-line interface for solving CAPTCHAs made with Cap. It's mainly designed for testing and when you need to solve these CAPTCHAs in a browser without JavaScript support.

If you're on Windows, you might need to use `bunx '@cap.js/cli'` (with quotes) instead of `bunx @cap.js/cli` to avoid issues with the `@` symbol.

Note that `cli` is not meant to be used in production environments, you should use the solver instead. It's primarily for testing purposes and should not be used in a real application.

It's also not being as actively developed as the rest of the Cap ecosystem, so it may not support all features.

## Usage

To use `cli`, you need to pass the challenges to solve in the format `salt:target`, separated by a space. For example:

```bash
❯ bunx '@cap.js/cli' e455cea65e98b:dceb fb8d25f6abac:93f1 ...
```

```
@cap.js/cli 2 challenges

e455cea65e98b:dceb:9100
fb8d25f6abac:93f1:76570
...
```

The output format is `salt:target:nonce`, where `nonce` is the solution nonce. You can then turn this into JSON to send to the Cap server helper:

```js
const input = "e455cea65e98b:dceb:9100\nfb8d25f6abac:93f1:76570";

console.log(input.split("\n").map((l) => l.split(":")));
```

```json
[
  ["e455cea65e98b", "dceb", "9100"],
  ["fb8d25f6abac", "93f1", "76570"]
]
```

## Generating the command

You can generate code to call `cap.js/cli` from the challenges using this:

```js
const response = {
  "challenge": [
    [ "e455cea65e98b", "dceb" ],
    [ "fb8d25f6abac", "93f1" ],
    ...
  ],
  "token": "...",
  "expires": 1745343553913
};

const challenges = response.challenge.map((c) => c.join(":")).join(" ");
const command = `bunx '@cap.js/cli' ${challenges}`;

console.log(command); // bunx '@cap.js/cli' e455cea65e98b:dceb fb8d25f6abac:93f1 ...
```

::: warning   
The code above doesn't validate if the challenges are valid and not potentially malicious. If you're getting the challenge list from an untrusted source, make sure to validate it before giving them to the user.    
:::