---
description: "Every error code the Cap widget, capjs-core and capd return, with what each one means and where it comes from."
---

# Error codes

This table is for site owners. The widget puts these codes in the `code` of its `error` event, `validateChallenge` returns them as `reason`, and capd shows them as the reason on blocked and failed events.

| Code | From | Meaning |
| --- | --- | --- |
| `missing_endpoint` | widget | The widget has no `data-cap-api-endpoint` and no `CAP_CUSTOM_FETCH`. |
| `network_error` | widget | The challenge endpoint returned an error, or no challenge arrived. |
| `challenge_parse_error` | widget | The challenge response wasn't JSON. |
| `challenge_unsupported` | widget | The challenge uses a protocol this widget version can't solve, or HashWX in a browser without WebAssembly. |
| `solve_failed` | widget | The solver workers failed, a request couldn't reach the server, or an error had no code of its own. |
| `redeem_failed` | widget | The `/redeem` response wasn't JSON. |
| `invalid_solution` | widget, server | The server rejected the redeem. In the widget, the event's `message` is the server's `error`. From the server, the proof of work is wrong. |
| `invalid_expires` | widget | The token's expiry isn't within the next 24 hours, which points at a wrong server clock. |
| `instr_csp_blocked` | widget, server | The page's Content Security Policy blocked the instrumentation script. Set `CAP_SCRIPT_NONCE`, as described in [Content Security Policy](./widget.md#content-security-policy). |
| `instr_natives_tampered` | widget, server | Browser functions the script relies on were replaced before it ran, by an extension or a page script. |
| `instr_env_failed` | widget, server | The environment checks failed before the program ran. The script isn't running in a real browser page, or something changed the frame. |
| `instr_script_failed` | widget, server | The program threw after the environment checks passed. |
| `instr_blocked` | widget | The script's own automated browser checks failed. The server records `instr_automated_browser` if the key blocks automated browsers, and `instr_failed` if it doesn't. |
| `instr_timeout` | widget, server | The script didn't answer within 20 seconds of the widget finalizing it. |
| `invalid_body`, `missing_token`, `missing_solutions`, `invalid_solutions` | server | The `/redeem` request is malformed. |
| `invalid_token` | server | The challenge token is forged or malformed, or it was signed with another secret. |
| `scope_mismatch` | server | The token belongs to another site key or scope. |
| `expired` | server | The challenge expired before it was redeemed. |
| `already_redeemed` | server | The challenge was already used. A failed instrumentation check also uses it up. |
| `nonce_store_error` | server | `consumeNonce` threw. |
| `instr_missing` | server | The request has no instrumentation result. |
| `instr_corrupted` | server | The server couldn't decrypt the challenge's instrumentation data, usually because the secret changed. |
| `instr_expired` | server | The instrumentation result arrived after the challenge expired. |
| `instr_stale` | server | The result claims more elapsed time than the challenge allows. |
| `instr_oversized` | server | The collected data is over 65,536 characters. |
| `id_mismatch` | server | The result belongs to another challenge. |
| `failed_challenge` | server | The numbers in the result are wrong. Either the result was edited, or the browser computed the program incorrectly. |
| `invalid_state`, `missing_output`, `missing_meta`, `invalid_meta` | server | The result or the sealed challenge data is malformed. |
| `instr_failed` | server | The widget reported a failure the server doesn't recognize. |
| `instr_automated_browser` | server | The [automated browser checks](./instrumentation.md#automated-browser-detection) failed. `blockedBy` lists which ones. |
| `instr_probe_missing` | server | The key blocks automated browsers, but the result has no browser facts. |
| `instr_automated_interaction` | server | Scripts dispatched three or more clicks or key presses. See [interaction detection](./instrumentation.md#interaction-detection). |
| `instr_host_unreachable` | server | The script couldn't read the page around its frame, and the key's policy depends on it. |
| `instr_isolated` | server | The page sets [`CAP_ISOLATE`](./widget.md#pages-with-an-html-injection-bug), and this key needs interaction, behavior or agent data that an isolated frame can't collect. Turn those blocks off for this key, or remove `CAP_ISOLATE`. |
| `instr_wasm_available` | server | The widget asked for the [SHA-256 fallback](./hashwx.md#browsers-without-webassembly), but WebAssembly compiled in the browser check's frame. |
| `instr_widget_outdated` | server | A [widget from an earlier release](./instrumentation.md#widgets-from-earlier-releases) can't satisfy this key. Update the widget. |
| `behavior_missing` | server | Behavior scoring is on, and the result has no behavior trace. |
| `behavior_automated` | server | The [behavior score](./instrumentation.md#behavior-scoring) reached the threshold. |
| `behavior_no_interaction` | server | Nothing pressed the widget, and the key requires an interaction. |
| `behavior_agent` | server | An [AI agent](./instrumentation.md#ai-agent-detection) was detected, and the key blocks it. |
| `rate_limited` | capd | The client went over the key's rate limit. |
| `non_browser_ua`, `missing_header` | capd | The challenge request failed the key's request filter. |
| `rule:<id>` | capd | A rule on the key blocked the request. |
| `signal:<flag>` | capd | The key is set to block on that risk flag. |

capd's `/redeem` response renames some of these in its own `reason` field: `instr_automated_browser` is `automated_browser_detected`, `instr_automated_interaction` is `automated_interaction_detected`, `instr_corrupted` is `corrupted_instrumentation_data`, `instr_missing` is `missing_instrumentation_response`, `instr_expired` is `expired`, and `instr_timeout` is `timeout`, sent with a `429` status.
