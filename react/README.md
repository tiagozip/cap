# Cap.js React

A React wrapper component for the Cap.js CAPTCHA widget.

## Motivation

Currently, there are no Proof-of-Work (PoW) CAPTCHA solutions that integrate smoothly with strict TypeScript environments. Existing implementations require manual, complex, boilerplate, like this package has, which should not be written by an end-user, but rather served as a package with a simple API.

Cap.js is one of the best PoW CAPTCHA solutions I've found so far because:

- It is open source!
- It's self-hostable!
- Licensed under Apache 2.0
- Uses Web Worker threads to solve challenges faster than other CAPTCHA libraries, preserving UX while still being effective at reducing spam
- Provides a simple, easy-to-use API

However, the Cap.js widget itself is not provided as a React component, which creates a barrier for people wanting to try it out in their own projects.

This package fills that gap by providing a fully typed React component wrapper around the Cap.js widget, making it easy for new and experienced React developers to try it out, and write clean and maintainable code with it.

## Features

- Full TypeScript support and typings
- Supports all events from `@cap.js/widget`
- Widget controls (`solve`, `reset`) are accessible via ref

## Usage Examples

Basic usage with form submission

```tsx
import { Cap } from "capjs-react";

export function FormComponent() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    console.log(formData.get("name")); // e.g. "John Doe"
    console.log(formData.get("cap-token")); // Captcha token
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="name"
        required
      />
      <Cap apiEndpoint="your-api-endpoint" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

Controlled component example

```tsx
import { Cap } from "capjs-react";
import { useState } from "react";

export function FormComponent() {
  const [token, setToken] = useState<string | null>(null);

  return (
    <form>
      <input
        type="text"
        name="name"
        required
      />
      <Cap
        apiEndpoint="your-api-endpoint"
        onSolve={(e) => setToken(e.detail.token)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

Using the widget via ref for manual control

```tsx
import { Cap } from "capjs-react";
import { useRef } from "react";

export function FormComponent() {
  const capRef = useRef<HTMLCapElement>(null);

  async function handleSolve() {
    const token = await capRef.current?.solve();
    console.log("Captcha token:", token);
  }

  function handleReset() {
    capRef.current?.reset();
  }

  return (
    <form>
      <input
        type="text"
        name="name"
        required
      />
      <Cap
        ref={capRef}
        className="hidden"
        apiEndpoint="your-api-endpoint"
      />
      <button
        type="button"
        onClick={handleSolve}
      >
        Solve Cap
      </button>
      <button
        type="button"
        onClick={handleReset}
      >
        Reset Cap
      </button>
      <button type="submit">Submit</button>
    </form>
  );
}
```

## TODO

- [x] Invisible mode via ref.current.solve() and onSolve event handling
- [ ] Including widget script in the package and not injecting it via `cdn`
- [ ] Floating mode support
- [ ] Further type improvements, especially for ref
- [ ] Compatibility with React versions earlier than 19
- [ ] Adding `tsconfig.json` and `package.json` and make it a package (I've tried doing this but I don't know how to make it work 🥲)
- [ ] Publish to NPM

Note: I've left "TODO:" comments in the code for the parts that I am not sure. Take a look at it if you are interested in shipping this package.
