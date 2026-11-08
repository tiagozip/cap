---
outline: [2, 3]
description: "capjs-core ist Caps zustandslose Server-Bibliothek zum Erzeugen und Verifizieren von Proof-of-Work-Challenges mit signierten JWTs. Betreibe das quelloffene CAPTCHA auf Workers, Lambda oder in deinem eigenen Backend."
---

# Core-Bibliothek

`capjs-core` erzeugt und verifiziert Challenges in deinem eigenen Server. Die Bibliothek ist zustandslos. Eine Challenge ist ein signiertes JWT, braucht also keine Datenbank, kein Dateisystem und keinen Zustand im Arbeitsspeicher. Sie läuft auf Cloudflare Workers, Lambda und anderen Edge-Laufzeiten. capd baut darauf auf.

Den meisten Nutzern empfehlen wir stattdessen [capd](./capd/index.md), Caps Server, der ein Dashboard, Statistiken, Rate Limiting und Token-Speicherung ergänzt. Nutze die Bibliothek, wenn du keinen Container betreiben kannst oder Challenges in einen bestehenden Dienst einbetten willst.

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

## Erste Schritte

Du brauchst zwei Routen, eine zum Erzeugen einer Challenge und eine zum Prüfen der Lösung. Richte `data-cap-api-endpoint` des Widgets auf ihr gemeinsames Präfix. Das Widget ruft dann `<prefix>challenge` und `<prefix>redeem` auf.

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;

app.post("/cap/challenge", async () => {
  return await generateChallenge(SECRET, { instrumentation: true });
});

app.post("/cap/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```

`SECRET` signiert jede Challenge. Mach es lang und zufällig, mindestens 16 Bytes, und nutze in jedem Prozess dasselbe.

`consumeNonce` verhindert, dass eine gelöste Challenge zweimal eingelöst wird. Du stellst es über deinen eigenen Speicher bereit. Siehe [Replay-Schutz](#replay-prevention).

## Tokens verifizieren {#verifying-tokens}

Ein erfolgreicher Aufruf von `validateChallenge` liefert ein `token` für den Besucher und einen `tokenKey` für dich. Die Bibliothek speichert keines davon. Speichere deshalb `tokenKey` mit seinem `expires`:

```js
const result = await validateChallenge(SECRET, req.body, { consumeNonce });
if (result.success) {
  await store.set(`cap-token:${result.tokenKey}`, result.expires);
}
return result;
```

Das Widget übergibt `token` an dein Formular. Wenn das Formular ankommt, leite den Key aus dem eingereichten Token ab und schlage ihn nach:

```js
import { createHash } from "node:crypto";

const [id, secret] = req.body["cap-token"].split(":");
const tokenKey = `${id}:${createHash("sha256").update(secret).digest("hex")}`;
const expires = await store.get(`cap-token:${tokenKey}`);

if (!expires || Number(expires) < Date.now()) {
  return new Response("invalid captcha", { status: 403 });
}
await store.delete(`cap-token:${tokenKey}`);
```

Durch das Löschen des Keys ist jedes Token nur einmal nutzbar.

## HashWX {#format-2-hashwx}

`generateChallenge` stellt standardmäßig [HashWX](./hashwx.md)-Proof-of-Work aus, dasselbe Format, das capd für neue Keys nutzt. Es ist gegen GPUs weit resistenter als SHA-256. `instrumentation: true` und `behavior` fügen eine Instrumentation-Challenge hinzu.

Um die Protokolle selbst anzugeben, übergib sie mit `format: 2`:

```js
return await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
});
```

`format: 1` wechselt zurück zu SHA-256-Proof-of-Work, ebenso `challengeCount`, `challengeSize` oder `challengeDifficulty` ohne `format`. Das Widget erkennt das Format automatisch, und `validateChallenge` verarbeitet beide. HashWX braucht Widget 0.1.58 oder neuer, aktualisiere also ein fest gepinntes Widget vor der Bibliothek.

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `hashwxDifficulty` | `1_000_000` | Erwartete Hashes pro Lösung, über alle Teil-Challenges hinweg. |
| `hashwxChallengeCount` | `4` | Teil-Challenges, auf die sich die Schwierigkeit verteilt. Mehr davon machen die Lösungszeiten weniger zufällig. Siehe [Kosten auf dem Client](./hashwx.md#cost). |
| `hashwxNoncesPerHash` | `65_536` | Nonces, die jede erzeugte Hash-Funktion abdeckt. |

HashWX braucht keine Keys und keine Vorbereitung. Die erste Verifizierung kompiliert ein kleines WebAssembly-Modul. Mit `await hashwxReady()` beim Start kannst du das vorziehen.

Manche Laufzeiten erlauben es nicht, WebAssembly zur Laufzeit zu kompilieren. Cloudflare Workers erhalten automatisch ein vorkompiliertes Modul. Anderswo importierst du es auf die von deiner Plattform unterstützte Weise und übergibst es vor der ersten Verifizierung:

```js
import { setHashwxModule } from "capjs-core";
import hashwxModule from "capjs-core/hashwx.wasm";

setHashwxModule(hashwxModule);
```

## Replay-Schutz {#replay-prevention}

`validateChallenge` ruft `consumeNonce(signature, ttlMs)` auf, sobald der Proof-of-Work stimmt und bevor es die Instrumentation prüft. Speichere die Signatur, wenn sie neu ist, und gib `true` zurück. Gib `false` zurück, wenn sie schon verwendet wurde. Eine Anfrage mit falschem Proof-of-Work erreicht diesen Schritt nie und kann die Challenge eines echten Besuchers deshalb nicht verbrauchen. Eine Anfrage mit gültigem Proof-of-Work und fehlgeschlagenem Instrumentation-Ergebnis verbraucht sie dagegen. So kann ein Bot die Instrumentation-Prüfung nicht mit demselben Proof-of-Work wiederholen.

::: code-group

```js [Redis]
const consumeNonce = async (sig, ttlMs) =>
  (await redis.set(`cap:${sig}`, "1", "NX", "PX", ttlMs)) === "OK";
```

```js [Workers KV]
const consumeNonce = async (sig, ttlMs) => {
  if (await env.NONCES.get(`cap:${sig}`)) return false;
  await env.NONCES.put(`cap:${sig}`, "1", { expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)) });
  return true;
};
```

```js [Postgres]
const consumeNonce = async (sig, ttlMs) => {
  try {
    await sql`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sig}, ${new Date(Date.now() + ttlMs)})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false;
    throw e;
  }
};
```

:::

Workers KV ist nicht atomar. Zwei gleichzeitig eintreffende Anfragen können deshalb beide durchkommen. Nutze ein Durable Object, wenn das relevant ist.

## Instrumentation

`instrumentation: true` ergänzt Format-1-Challenges um eine [Instrumentation-Challenge](./instrumentation.md). Bei Format 2 fügst du `"instrumentation"` zu `protocols` hinzu. In beiden Fällen kannst du statt `true` ein Objekt übergeben:

```js
instrumentation: {
  blockAutomatedBrowsers: true,
  obfuscationLevel: 3,
}
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `blockAutomatedBrowsers` | `false` | Lehnt Lösungen aus [automatisierten Browsern](./instrumentation.md#automated-browser-detection) mit `instr_automated_browser` ab. |
| `detectAutomatedInteractions` | `false` | Fügt `interaction_synthetic_clicks` und `interaction_synthetic_keydowns` zu `riskFlags` hinzu. Siehe [Interaktionserkennung](./instrumentation.md#interaction-detection). |
| `blockAutomatedInteractions` | `false` | Lehnt diese Lösungen mit `instr_automated_interaction` ab. Aktiviert auch die Erkennung. |
| `obfuscationLevel` | `5` | Von 1 bis 10. Die Stufen 1 bis 3 entfernen Whitespace, 4 bis 7 kodieren außerdem Strings und minifizieren, und 8 bis 10 nutzen `javascript-obfuscator`, wenn es installiert ist. Höhere Stufen brauchen länger zum Erzeugen. |

Die Stufen 8 bis 10 benötigen das optionale Paket `javascript-obfuscator` und blockieren die Event-Loop pro Challenge um mehrere zehn Millisekunden. Nutze sie deshalb nur für Routen mit wenig Traffic oder erzeuge Skripte mit `instrumentationGenerator` in einem Worker-Pool. Die Funktion erhält die Instrumentation-Optionen und muss ein Promise mit dem Rückgabewert von `generateInstrumentation` liefern.

## Verhalten und Agenten {#behavior-and-agents}

`behavior` aktiviert [Verhaltensbewertung](./instrumentation.md#behavior-scoring) und [Agentenblockierung](./instrumentation.md#ai-agent-detection). Es ergänzt eine Instrumentation-Challenge, falls noch keine vorhanden ist. Die Richtlinie wird ins Challenge-Token signiert, damit der Client sie nicht deaktivieren kann.

```js
await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
  behavior: { block: true, blockAgents: "identified" },
});
```

`behavior: true` bewertet, ohne zu blockieren. Das Objekt akzeptiert:

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `block` | `false` | Lehnt das Urteil `automated` mit `behavior_automated` und das Urteil `no_interaction` mit `behavior_no_interaction` ab. |
| `threshold` | `0.75` | Score von 0,1 bis 1, ab dem das Urteil `automated` lautet. |
| `strict` | `false` | Hebt die Grenze von 0,6 für Scores auf, die nur aus schwachen Flags bestehen. |
| `requireInteraction` | `true` | Setze es für den unsichtbaren Modus und den Floating-Modus auf `false`, um `no_interaction` bei aktiviertem `block` durchzulassen. |
| `blockAgents` | `false` | `"identified"` lehnt mit hoher Konfidenz erkannte Agenten ab, `"all"` jeden erkannten Agenten, jeweils mit `behavior_agent`. |
| `allowVerifiedAgents` | `false` | Lässt Agenten mit verifizierter Web Bot Auth-Signatur durch `blockAgents`. |

Eine Lösung ohne Verhaltensaufzeichnung schlägt unabhängig von der Richtlinie immer mit `behavior_missing` fehl.

Um Anfrage-Header als Hinweise auf Agenten zu nutzen, übergib die `/redeem`-Anfrage an `validateChallenge`:

```js
const result = await validateChallenge(SECRET, body, {
  consumeNonce,
  request: { method: req.method, url: fullUrl, headers: req.headers },
  verifyWebBotAuth: true,
});
```

`url` muss die vollständige URL sein, da Web Bot Auth sie signiert. Mit `verifyWebBotAuth: true` wird eine Anfrage mit `Signature-Agent`-Header gegen das Schlüsselverzeichnis des Agenten geprüft. `validateChallenge` ruft es über HTTPS ab und hält es eine Stunde im Cache. Es vertraut nur den Cap bekannten Unterzeichnern und den Origins in `trustedSignatureAgents`. Übergib `webBotAuthNonceCheck(nonce, ttlMs)`, um wiederverwendete Signaturen abzulehnen. Es funktioniert wie `consumeNonce`.

`behaviorReplayCheck(digest, ttlMs)` funktioniert genauso für Verhaltensaufzeichnungen. Gib `true` zurück, wenn der Digest schon gesehen wurde. Die Aufzeichnung erhält dann `bh_replayed`. Nur Aufzeichnungen mit mindestens 8 Zeigerbewegungen und Tastendrücken haben einen Digest.

Bei aktivierter Verhaltensbewertung enthält ein erfolgreiches Ergebnis `behavior: { score, verdict, flags, signals, agent }`. Ist sie deaktiviert, wird `agent` bei vorhandenen Hinweisen auf oberster Ebene zurückgegeben, nur aus Seitenmarkierungen und Headern gebildet und nie blockiert. In beiden Fällen ergänzt ein erkannter Agent `riskFlags` um `agent:<name>`. `agent` sieht so aus:

```js
{
  detected: true,
  name: "claude-in-chrome",
  confidence: "high",
  verified: false,
  evidence: ["artifact:cic_active"],
}
```

## API

### `generateChallenge(secret, options?)`

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `challengeCount` | `50` | SHA-256-Puzzles pro Challenge. |
| `challengeSize` | `32` | Salt-Länge in Hex-Zeichen. |
| `challengeDifficulty` | `4` | Erforderliche Länge des Hash-Präfixes in Hex-Zeichen. |
| `expiresMs` | `600_000` | Zeit, die der Besucher zum Lösen hat. |
| `scope` | keiner | Ein an die Challenge gebundener String. Die Validierung muss denselben übergeben. |
| `extra` | keine | Im JWT eingebettete Daten. Jeder mit dem Token kann sie lesen. |
| `instrumentation` | `false` | Siehe [Instrumentation](#instrumentation). |
| `instrumentationGenerator` | `generateInstrumentation` | Asynchrone Funktion, die das Instrumentation-Skript erzeugt. |
| `behavior` | `false` | Siehe [Verhalten und Agenten](#behavior-and-agents). |
| `format`, `protocols` | Format 2 mit HashWX | Siehe [HashWX](#format-2-hashwx). `keypair` oder `rsw` ohne `protocols` wählt das abgekündigte RSW-Protokoll. |
| `hashwxDifficulty`, `hashwxChallengeCount`, `hashwxNoncesPerHash` | siehe [HashWX](#format-2-hashwx) | HashWX-Einstellungen für Format 2. |
| `keypair`, `t`, `rsw` | keine | Einstellungen für das abgekündigte RSW-Protokoll. |

Format 1 liefert `{ challenge, token, expires, instrumentation? }`, Format 2 liefert `{ token, format: 2, challenges, expires }`. Beide ergänzen `behavior: true`, wenn die Verhaltensbewertung aktiv ist. Schicke das gesamte Objekt an das Widget.

### `validateChallenge(secret, body, options?)`

`body` ist das, was das Widget an `/redeem` sendet. Die Optionen sind:

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `consumeNonce` | keiner | Siehe [Replay-Schutz](#replay-prevention). |
| `scope` | keiner | Muss zum Scope der Challenge passen. |
| `tokenTtlMs` | `1_200_000` | Gültigkeitsdauer des Besucher-Tokens. |
| `signToken` | `id:secret` | Funktion, die `{ scope, expires, iat }` erhält und dein eigenes Token liefert. `tokenKey` entfällt. |
| `request` | keine | Die `/redeem`-Anfrage als `{ method, url, headers }`. Siehe [Verhalten und Agenten](#behavior-and-agents). |
| `verifyWebBotAuth` | `false` | Verifiziert Web Bot Auth-Signaturen auf `request`. |
| `fetch` | globales `fetch` | Wird zum Herunterladen der Web Bot Auth-Schlüsselverzeichnisse verwendet. |
| `trustedSignatureAgents` | keine | Weitere vertrauenswürdige Unterzeichner-Origins, etwa `"https://agent.example.com"`. |
| `webBotAuthNonceCheck` | keiner | Lehnt wiederverwendete Web Bot Auth-Signaturen ab. |
| `behaviorReplayCheck` | keiner | Markiert wiederverwendete Verhaltensaufzeichnungen. |

Bei Erfolg liefert es `{ success: true, token, tokenKey, expires, scope, iat, riskFlags }` sowie `behavior` oder `agent`, wie unter [Verhalten und Agenten](#behavior-and-agents) beschrieben. `riskFlags` enthält Signale, die allein nicht blockieren, etwa `native_tamper` oder `legacy_widget`. Damit kannst du die Schwierigkeit für diesen Besucher erhöhen. Die Instrumentation-Seite listet die [Flags der Browser-Prüfungen](./instrumentation.md#automated-browser-detection) und die [Verhaltens-Flags](./instrumentation.md#behavior-scoring) auf.

Bei einem Fehler liefert es `{ success: false, reason }`. Instrumentation-Fehler enthalten außerdem `instr_error: true`. `instr_automated_browser` und `instr_automated_interaction` haben eine `blockedBy`-Liste, und Verhaltensfehler haben `behavior`. Jeder `reason` steht in der [Fehlercode-Tabelle](./error-codes.md).

### Exporte auf niedrigerer Ebene

capd und die Tests nutzen diese Exporte. Du brauchst sie nur, wenn du deine eigene Pipeline baust.

| Export | Beschreibung |
| --- | --- |
| `generateInstrumentation(opts?)` | Erzeugt ein Instrumentation-Skript und die Metadaten zu dessen Prüfung. |
| `verifyInstrumentationResult(meta, payload, now?)` | Prüft ein Ergebnis gegen diese Metadaten. Liefert `{ valid, reason?, riskFlags?, blockedBy?, checks?, agent?, trace? }`. |
| `serializeBound(data)`, `canonicalize(value)` | Serialisieren gesammelte Daten genauso wie das Skript. |
| `boundValues(binding, serialized)` | Die Zahlen, die ein Ergebnis für diese Daten enthalten muss. |
| `MAX_BOUND_DATA` | Maximale akzeptierte Länge serialisierter Daten, 65.536 Zeichen. |
| `detectAutomation(vector)` | Führt die Prüfungen auf automatisierte Browser mit selbst gesammelten Browserdaten aus. Liefert `{ pass, checks, blockedBy, riskFlags }`. |
| `analyzeBehavior(trace, ctx?)` | Bewertet eine Verhaltensaufzeichnung. `ctx` akzeptiert `{ replayed, strict, threshold }`. Liefert `{ score, verdict, flags, signals, digest }`. |
| `BEHAVIOR_WEIGHTS`, `DEFAULT_BEHAVIOR_THRESHOLD`, `WEAK_CAP` | Die Flag-Gewichte, `0.75` und `0.6`. |
| `agentFromHeaders(headers)` | Hinweise auf Agenten aus `User-Agent`, `Signature-Agent` und `Sec-CH-UA-Platform`. |
| `agentFromTrace(trace)` | Hinweise auf Agenten aus dem Timing von Klicks und Tastatureingaben einer Verhaltensaufzeichnung. Übergib nur Aufzeichnungen, die `analyzeBehavior` nicht als `bh_malformed` markiert hat. |
| `summarizeAgent(evidence, verification?)` | Fasst Hinweise und ein optionales `verifyWebBotAuth`-Ergebnis im `agent`-Objekt zusammen oder liefert `null`, wenn keine Hinweise vorliegen. |
| `verifyWebBotAuth(req, opts?)` | Verifiziert eine Web Bot Auth-Signatur. Das Promise liefert `{ verified, agent?, origin?, keyid?, reason? }`. |
| `parseSignatureAgent(value)` | Zerlegt einen `Signature-Agent`-Header in `{ label, url }`-Einträge. |
| `hashwxReady()`, `setHashwxModule(module)` | Kompilieren das HashWX-Modul vorab oder stellen eines bereit. Siehe [HashWX](#format-2-hashwx). |
| `hashwxTarget(difficulty)`, `hashwxSeed(challenge, block)`, `hashwxHash(state, seed, nonce)` | HashWX-Grundfunktionen. `state` stammt von `hashwxReady()`. |
| `DEFAULT_HASHWX_DIFFICULTY`, `DEFAULT_HASHWX_CHALLENGE_COUNT`, `DEFAULT_HASHWX_NONCES_PER_HASH` | `1_000_000`, `4` und `65_536`. |
| `generateRswKeypair(bits?)`, `serializeRswKeypair(kp)`, `deserializeRswKeypair(s)`, `buildRswMinter(args, opts?)` | Keys und Minter für das abgekündigte RSW-Protokoll. |

## Migration von `@cap.js/server` {#how-it-differs-from-cap-js-server}

`@cap.js/server` ist die ältere Bibliothek, die diese hier ablöst. Sie hielt Challenges und Tokens in einem von dir konfigurierten Speicher vor. `capjs-core` speichert nichts. Challenges sind signierte JWTs, der Replay-Schutz läuft über `consumeNonce`, und `tokenKey` speicherst du selbst, wie unter [Tokens verifizieren](#verifying-tokens) gezeigt. Die Bibliothek greift nie auf das Dateisystem zu und läuft deshalb auf Workers und Lambda.
