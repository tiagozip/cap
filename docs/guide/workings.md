# How does Cap work?

By the way, this is a more technical explanation of how Cap works. If you're looking for a more general overview, check out the [Effectiveness](./effectiveness.md) page.

---

1. When Cap is initialized, it automatically registers a custom element for the widget in the browser
2. The widget creates a shadow DOM and appends all necessary elements to it

#### Requesting the challenge

3. When a solution is requested, the widget sends a request to the server. The server will return a token, the configuration for the challenges to solve and optionally compressed instrumentation data.

4. The widget then generates multiple challenges using a set seed (the challenge token) and the configuration provided by the server. If instrumentation data is provided, it's decompressed and solved in a sandboxed iframe.

#### Computing the solution

5. The widget uses a C-based WASM solver and Web Workers to solve the challenges in parallel:
   - Each worker attempts to find a valid nonce by repeatedly:
     - Combining the salt with different nonce values
     - Computing the SHA-256 hash of this combination
     - Checking if the resulting hash begins with the target prefix
   - The WASM increments the nonce until a matching hash is found

6. Instrumentation challenges are decompressed and executed, if present.

#### Redeeming the solution for a token

7. Once a valid solution is found, the widget sends the result back to the server for validation.
8. The server itself then also generates the same challenges using the provided token and configuration, and verifies the solutions submitted by the widget.
9. Upon successful verification, the server redeems the solution and issues a token that can be used to authenticate the request.
