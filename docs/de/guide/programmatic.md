---
description: "Programmatischer Modus für Cap: new Cap() und solve() aufrufen, um das quelloffene CAPTCHA aus eigenem JavaScript heraus laufen zu lassen, mit Proof-of-Work und ohne sichtbares Widget."
---

# Programmatischer Modus

Du kannst `new Cap({ ... })` in deinem clientseitigen JavaScript verwenden, um eine neue Cap-Instanz zu erzeugen, und die Methode `solve()` aufrufen, um die Challenge zu lösen.

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // oder: apiEndpoint: "/api/",
});
const solution = await cap.solve();

console.log(solution.token);
```

Du kannst auch [Event-Listener](widget.md#unterstutzte-events) einrichten:

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // oder: apiEndpoint: "/api/",
});

cap.addEventListener("progress", (event) => {
  console.log(`Wird gelöst... ${event.detail.progress}% fertig`);
});
```

Im Hintergrund erzeugt Cap ein verstecktes `cap-widget`-Element und löst die Challenge damit.

## Unterstützte Methoden und Argumente

Die folgenden Methoden werden unterstützt:

#### `new Cap({ ... })`

Erzeugt eine neue Cap-Instanz. Wird ein zweites Argument übergeben, verwendet Cap dieses Element, statt ein neues im Speicher anzulegen.

**Argumente**

```json
{
  apiEndpoint: ..., // API-Endpunkt, analog zum Widget-Attribut `data-cap-api-endpoint`
  workers: navigator.hardwareConcurrency || 8 // Anzahl der zu nutzenden Worker-Threads
}
```

#### `cap.solve()`

Fordert eine Challenge an und löst sie.

**Ausgabe:** `{ token }`

#### `cap.token`

Gibt das Token des letzten Lösungsvorgangs zurück.

#### `cap.reset()`

Setzt `cap.token` zurück.

#### `cap.addEventListener(..., function () { ... })`

Lauscht auf ein Event des Cap-Widgets. Siehe [unterstützte Events](widget.md#unterstutzte-events).
