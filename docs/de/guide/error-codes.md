---
description: "Alle Fehlercodes, die das Cap-Widget, capjs-core und capd liefern, mit ihrer Bedeutung und Herkunft."
---

# Fehlercodes

Diese Tabelle ist für Website-Betreiber. Das Widget setzt diese Codes als `code` seines `error`-Events, `validateChallenge` liefert sie als `reason`, und capd zeigt sie als Grund bei blockierten und fehlgeschlagenen Ereignissen an.

| Code | Herkunft | Bedeutung |
| --- | --- | --- |
| `missing_endpoint` | Widget | Das Widget hat weder `data-cap-api-endpoint` noch `CAP_CUSTOM_FETCH`. |
| `network_error` | Widget | Der Challenge-Endpunkt lieferte einen Fehler, oder es kam keine Challenge an. |
| `challenge_parse_error` | Widget | Die Challenge-Antwort war kein JSON. |
| `challenge_unsupported` | Widget | Die Challenge nutzt ein Protokoll, das diese Widget-Version nicht lösen kann, oder HashWX in einem Browser ohne WebAssembly. |
| `solve_failed` | Widget | Die Solver-Worker sind fehlgeschlagen, eine Anfrage konnte den Server nicht erreichen, oder ein Fehler hatte keinen eigenen Code. |
| `redeem_failed` | Widget | Die `/redeem`-Antwort war kein JSON. |
| `invalid_solution` | Widget, Server | Der Server lehnte das Einlösen ab. Im Widget ist `message` des Events der `error` des Servers. Vom Server bedeutet es, dass der Proof-of-Work falsch ist. |
| `invalid_expires` | Widget | Das Ablaufdatum des Tokens liegt nicht innerhalb der nächsten 24 Stunden. Das weist auf eine falsche Serveruhr hin. |
| `instr_csp_blocked` | Widget, Server | Die Content Security Policy der Seite hat das Instrumentation-Skript blockiert. Setze `CAP_SCRIPT_NONCE`, wie unter [Content Security Policy](./widget.md#content-security-policy) beschrieben. |
| `instr_natives_tampered` | Widget, Server | Eine Erweiterung oder ein Seitenskript hat benötigte Browserfunktionen vor der Ausführung des Skripts ersetzt. |
| `instr_env_failed` | Widget, Server | Die Umgebungsprüfungen schlugen vor der Programmausführung fehl. Das Skript läuft nicht in einer echten Browserseite, oder etwas hat den Frame verändert. |
| `instr_script_failed` | Widget, Server | Das Programm warf einen Fehler, nachdem die Umgebungsprüfungen erfolgreich waren. |
| `instr_blocked` | Widget | Die eigenen Prüfungen des Skripts auf automatisierte Browser schlugen fehl. Der Server erfasst `instr_automated_browser`, wenn der Key automatisierte Browser blockiert, andernfalls `instr_failed`. |
| `instr_timeout` | Widget, Server | Das Skript antwortete nicht innerhalb von 20 Sekunden nach dem Abschlusssignal des Widgets. |
| `invalid_body`, `missing_token`, `missing_solutions`, `invalid_solutions` | Server | Die `/redeem`-Anfrage ist fehlerhaft. |
| `invalid_token` | Server | Das Challenge-Token ist gefälscht oder fehlerhaft oder wurde mit einem anderen Secret signiert. |
| `scope_mismatch` | Server | Das Token gehört zu einem anderen Site-Key oder Scope. |
| `expired` | Server | Die Challenge ist vor dem Einlösen abgelaufen. |
| `already_redeemed` | Server | Die Challenge wurde bereits verwendet. Auch eine fehlgeschlagene Instrumentation-Prüfung verbraucht sie. |
| `nonce_store_error` | Server | `consumeNonce` hat einen Fehler geworfen. |
| `instr_missing` | Server | Die Anfrage hat kein Instrumentation-Ergebnis. |
| `instr_corrupted` | Server | Der Server konnte die Instrumentation-Daten der Challenge nicht entschlüsseln, meist weil sich das Secret geändert hat. |
| `instr_expired` | Server | Das Instrumentation-Ergebnis kam nach Ablauf der Challenge an. |
| `instr_stale` | Server | Das Ergebnis behauptet eine längere Laufzeit, als die Challenge erlaubt. |
| `instr_oversized` | Server | Die gesammelten Daten sind länger als 65.536 Zeichen. |
| `id_mismatch` | Server | Das Ergebnis gehört zu einer anderen Challenge. |
| `failed_challenge` | Server | Die Zahlen im Ergebnis sind falsch. Entweder wurde das Ergebnis verändert, oder der Browser hat das Programm falsch berechnet. |
| `invalid_state`, `missing_output`, `missing_meta`, `invalid_meta` | Server | Das Ergebnis oder die versiegelten Challenge-Daten sind fehlerhaft. |
| `instr_failed` | Server | Das Widget meldete einen Fehler, den der Server nicht erkennt. |
| `instr_automated_browser` | Server | Die [Prüfungen auf automatisierte Browser](./instrumentation.md#automated-browser-detection) schlugen fehl. `blockedBy` listet sie auf. |
| `instr_probe_missing` | Server | Der Key blockiert automatisierte Browser, aber das Ergebnis enthält keine Browserdaten. |
| `instr_automated_interaction` | Server | Skripte lösten mindestens drei Klicks oder Tastendrücke aus. Siehe [Interaktionserkennung](./instrumentation.md#interaction-detection). |
| `instr_host_unreachable` | Server | Das Skript konnte die Seite um seinen Frame nicht lesen, und die Richtlinie des Keys hängt davon ab. |
| `instr_isolated` | Server | Die Seite setzt [`CAP_ISOLATE`](./widget.md#pages-with-an-html-injection-bug), und dieser Key benötigt Interaktions-, Verhaltens- oder Agentendaten, die ein isolierter Frame nicht erfassen kann. Deaktiviere diese Blockierungen für den Key oder entferne `CAP_ISOLATE`. |
| `instr_widget_outdated` | Server | Ein [Widget aus einer früheren Version](./instrumentation.md#widgets-from-earlier-releases) kann die Anforderungen dieses Keys nicht erfüllen. Aktualisiere das Widget. |
| `behavior_missing` | Server | Die Verhaltensbewertung ist aktiv, aber das Ergebnis enthält keine Verhaltensaufzeichnung. |
| `behavior_automated` | Server | Der [Verhaltens-Score](./instrumentation.md#behavior-scoring) hat den Schwellenwert erreicht. |
| `behavior_no_interaction` | Server | Nichts hat das Widget betätigt, und der Key verlangt eine Interaktion. |
| `behavior_agent` | Server | Ein [KI-Agent](./instrumentation.md#ai-agent-detection) wurde erkannt, und der Key blockiert ihn. |
| `rate_limited` | capd | Der Client hat das Rate Limit des Keys überschritten. |
| `non_browser_ua`, `missing_header` | capd | Die Challenge-Anfrage hat den Anfragefilter des Keys nicht bestanden. |
| `rule:<id>` | capd | Eine Regel des Keys hat die Anfrage blockiert. |
| `signal:<flag>` | capd | Der Key ist so eingestellt, dass er bei diesem Risiko-Flag blockiert. |

Die `/redeem`-Antwort von capd benennt einige davon in ihrem eigenen `reason`-Feld um. `instr_automated_browser` wird zu `automated_browser_detected`, `instr_automated_interaction` zu `automated_interaction_detected`, `instr_corrupted` zu `corrupted_instrumentation_data`, `instr_missing` zu `missing_instrumentation_response`, `instr_expired` zu `expired` und `instr_timeout` zu `timeout`, gesendet mit Status `429`.
