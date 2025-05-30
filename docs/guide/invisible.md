# Invisible mode

You can use `new Cap({ ... })` in your client-side JavaScript to create a new Cap instance and use the `solve()` method to solve the challenge. This is helpful for situations where you don't want the Cap widget to be visible but still want security, e.g. on a social media app when posting something.

```js
const cap = new Cap({
  apiEndpoint: "/api/"
});
const solution = await cap.solve();

console.log(solution.token);
```

You can also set up [event listeners](widget.md#supported-events):

```js
const cap = new Cap({
  apiEndpoint: "/api/"
});

cap.addEventListener("progress", (event) => { // [!code focus]
  console.log(`Solving... ${event.detail.progress}% done`); // [!code focus]
}); // [!code focus]
```

Behind the scenes, Cap creates a hidden `cap-widget` element and uses it to solve the challenge.

## Supported methods and arguments

The following methods are supported:

#### `new Cap({ ... })`
Creates a new Cap instance. If a 2nd argument is provided, it will use that element instead of creating a new one in memory.

**Arguments**
```json
{
  apiEndpoint: ..., // api endpoint, similar to the widget `data-cap-api-endpoint` attribute
  workers: navigator.hardwareConcurrency || 8 // number of worker threads to use
}
```

#### `cap.solve()`
Requests and solves a challenge.

**Output:** `{ token }`

#### `cap.token`
Returns the token from the latest solve

#### `cap.reset()`
Resets `cap.token`

#### `cap.addEventListener(..., function () { ... })`
Listens for an event for the cap widget. See [supported events](widget.md#supported-events)