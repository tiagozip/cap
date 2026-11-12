---
description: "Tous les codes d'erreur renvoyés par le widget Cap, capjs-core et capd, avec leur signification et leur origine."
---

# Codes d'erreur

Ce tableau s'adresse aux propriétaires de sites. Le widget place ces codes dans le `code` de son événement `error`, `validateChallenge` les renvoie comme `reason`, et capd les affiche comme motif des événements bloqués et échoués.

| Code | Origine | Signification |
| --- | --- | --- |
| `missing_endpoint` | widget | Le widget n'a ni `data-cap-api-endpoint` ni `CAP_CUSTOM_FETCH`. |
| `network_error` | widget | Le point d'accès de défi a renvoyé une erreur, ou aucun défi n'est arrivé. |
| `challenge_parse_error` | widget | La réponse au défi n'était pas du JSON. |
| `challenge_unsupported` | widget | Le défi utilise un protocole que cette version du widget ne peut pas résoudre, ou HashWX dans un navigateur sans WebAssembly. |
| `solve_failed` | widget | Les workers de résolution ont échoué, une requête n'a pas pu atteindre le serveur, ou une erreur n'avait pas de code propre. |
| `redeem_failed` | widget | La réponse de `/redeem` n'était pas du JSON. |
| `invalid_solution` | widget, serveur | Le serveur a rejeté l'échange. Dans le widget, le `message` de l'événement est l'`error` du serveur. Côté serveur, la preuve de travail est incorrecte. |
| `invalid_expires` | widget | L'expiration du jeton ne se situe pas dans les prochaines 24 heures, ce qui indique une horloge serveur incorrecte. |
| `instr_csp_blocked` | widget, serveur | La Content Security Policy de la page a bloqué le script d'instrumentation. Définissez `CAP_SCRIPT_NONCE`, comme décrit dans [Content Security Policy](./widget.md#content-security-policy). |
| `instr_natives_tampered` | widget, serveur | Les fonctions du navigateur dont dépend le script ont été remplacées avant son exécution, par une extension ou un script de la page. |
| `instr_env_failed` | widget, serveur | Les vérifications de l'environnement ont échoué avant l'exécution du programme. Le script ne s'exécute pas dans une vraie page de navigateur, ou quelque chose a modifié l'iframe. |
| `instr_script_failed` | widget, serveur | Le programme a levé une exception après la réussite des vérifications de l'environnement. |
| `instr_blocked` | widget | Les propres vérifications de navigateur automatisé du script ont échoué. Le serveur enregistre `instr_automated_browser` si la clé bloque les navigateurs automatisés, et `instr_failed` sinon. |
| `instr_timeout` | widget, serveur | Le script n'a pas répondu dans les 20 secondes suivant sa finalisation par le widget. |
| `invalid_body`, `missing_token`, `missing_solutions`, `invalid_solutions` | serveur | La requête `/redeem` est mal formée. |
| `invalid_token` | serveur | Le jeton du défi est falsifié ou mal formé, ou a été signé avec un autre secret. |
| `scope_mismatch` | serveur | Le jeton appartient à une autre clé de site ou à une autre portée. |
| `expired` | serveur | Le défi a expiré avant son échange. |
| `already_redeemed` | serveur | Le défi a déjà été utilisé. Une vérification d'instrumentation échouée le consomme aussi. |
| `nonce_store_error` | serveur | `consumeNonce` a levé une exception. |
| `instr_missing` | serveur | La requête ne contient aucun résultat d'instrumentation. |
| `instr_corrupted` | serveur | Le serveur n'a pas pu déchiffrer les données d'instrumentation du défi, généralement parce que le secret a changé. |
| `instr_expired` | serveur | Le résultat d'instrumentation est arrivé après l'expiration du défi. |
| `instr_stale` | serveur | Le résultat annonce un temps écoulé supérieur à celui autorisé par le défi. |
| `instr_oversized` | serveur | Les données collectées dépassent 65 536 caractères. |
| `id_mismatch` | serveur | Le résultat appartient à un autre défi. |
| `failed_challenge` | serveur | Les nombres du résultat sont incorrects. Le résultat a été modifié, ou le navigateur a mal exécuté les calculs du programme. |
| `invalid_state`, `missing_output`, `missing_meta`, `invalid_meta` | serveur | Le résultat ou les données scellées du défi sont mal formés. |
| `instr_failed` | serveur | Le widget a signalé un échec que le serveur ne reconnaît pas. |
| `instr_automated_browser` | serveur | Les [vérifications de navigateur automatisé](./instrumentation.md#automated-browser-detection) ont échoué. `blockedBy` liste lesquelles. |
| `instr_probe_missing` | serveur | La clé bloque les navigateurs automatisés, mais le résultat ne contient aucune donnée sur le navigateur. |
| `instr_automated_interaction` | serveur | Des scripts ont déclenché au moins trois clics ou pressions de touches. Voir la [détection des interactions](./instrumentation.md#interaction-detection). |
| `instr_host_unreachable` | serveur | Le script n'a pas pu lire la page autour de son iframe, et la politique de la clé en dépend. |
| `instr_isolated` | serveur | La page définit [`CAP_ISOLATE`](./widget.md#pages-with-an-html-injection-bug), et cette clé exige des données sur les interactions, le comportement ou les agents qu'une iframe isolée ne peut pas collecter. Désactivez ces blocages pour cette clé, ou retirez `CAP_ISOLATE`. |
| `instr_wasm_available` | serveur | Le widget a demandé le [repli SHA-256](./hashwx.md#browsers-without-webassembly), mais WebAssembly compile dans le cadre de la vérification du navigateur. |
| `instr_widget_outdated` | serveur | Un [widget d'une version antérieure](./instrumentation.md#widgets-from-earlier-releases) ne peut pas satisfaire les exigences de cette clé. Mettez le widget à jour. |
| `behavior_missing` | serveur | L'évaluation du comportement est activée, et le résultat n'a aucune trace de comportement. |
| `behavior_automated` | serveur | Le [score de comportement](./instrumentation.md#behavior-scoring) a atteint le seuil. |
| `behavior_no_interaction` | serveur | Rien n'a pressé le widget, et la clé exige une interaction. |
| `behavior_agent` | serveur | Un [agent IA](./instrumentation.md#ai-agent-detection) a été détecté, et la clé le bloque. |
| `rate_limited` | capd | Le client a dépassé la limite de débit de la clé. |
| `non_browser_ua`, `missing_header` | capd | La requête de défi a échoué au filtre de requêtes de la clé. |
| `rule:<id>` | capd | Une règle de la clé a bloqué la requête. |
| `signal:<flag>` | capd | La clé est configurée pour bloquer sur cet indicateur de risque. |

La réponse `/redeem` de capd renomme certains de ces codes dans son propre champ `reason` : `instr_automated_browser` devient `automated_browser_detected`, `instr_automated_interaction` devient `automated_interaction_detected`, `instr_corrupted` devient `corrupted_instrumentation_data`, `instr_missing` devient `missing_instrumentation_response`, `instr_expired` devient `expired`, et `instr_timeout` devient `timeout`, envoyé avec un statut `429`.
