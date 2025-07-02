# How does cap work?

> [!NOTE] This is a more technical explanation of how Cap works. If you're looking for a more general overview, check out the [Effectiveness](./effectiveness.md) page.

1. When Cap is initialized, it automatically registers a custom element for the widget in the browser
2. The widget creates a shadow DOM and appends all necessary elements to it

#### Requesting the challenge

3. When a solution is requested, the widget sends a request to the server. The server will return a token and the configuration for the challenges to solve.

4. The widget then generates multiple challenges using a set seed (the challenge token) and the configuration provided by the server.

#### Computing the solution

5. The widget uses WASM and Web Workers to solve the challenges in parallel:
   - Each worker attempts to find a valid nonce by repeatedly:
     - Combining the salt with different nonce values
     - Computing the SHA-256 hash of this combination
     - Checking if the resulting hash begins with the target prefix
   - The WASM increments the nonce until a matching hash is found

#### Redeeming the solution for a token

6. Once a valid solution is found, the widget sends the result back to the server for validation.
7. The server itself then also generates the same challenges using the provided token and configuration, and verifies the solutions submitted by the widget.
8. Upon successful verification, the server redeems the solution and issues a token that can be used to authenticate the request.
