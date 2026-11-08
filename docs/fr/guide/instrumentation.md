---
outline: [2, 3]
description: "Les défis d'instrumentation de Cap exécutent un script généré par défi dans une iframe isolée pour confirmer la présence d'un vrai navigateur, en complément de la preuve de travail du CAPTCHA open source auto-hébergé."
---

# Instrumentation

Les défis d'instrumentation vérifient qu'un défi a été résolu dans un vrai navigateur. Ils s'exécutent aux côtés de la preuve de travail, sont activés par défaut pour les nouvelles clés dans capd et s'activent explicitement dans la [bibliothèque core](./capjs-core.md#instrumentation).

<InstrumentationFlow />

## Fonctionnement {#how-it-works}

Chaque défi arrive avec un programme que le serveur n'a encore jamais envoyé. Son arithmétique change à chaque fois, donc un solveur doit analyser et exécuter chaque nouveau programme au lieu de rejouer une ancienne réponse. Tout ce que le programme relève sur la page est haché dans sa réponse, et le serveur recalcule cette réponse. Un client ne peut donc pas modifier ces relevés sans échouer.

L'iframe partage l'origine de la page pour que le programme puisse voir la page qui l'entoure. Les pages avec une Content Security Policy stricte doivent définir `window.CAP_SCRIPT_NONCE`, et les [pages avec une faille d'injection HTML](./widget.md#pages-with-an-html-injection-bug) peuvent isoler l'iframe avec `CAP_ISOLATE`.

## Détection des navigateurs automatisés {#automated-browser-detection}

Avec **Attempt to block headless browsers** activé dans capd, ou `blockAutomatedBrowsers` dans core, le serveur bloque les navigateurs qui présentent des marqueurs d'automatisation : `navigator.webdriver`, des user agents headless, les modifications des plugins stealth, le protocole Firefox de Playwright, ou une page et un Web Worker qui ne s'accordent pas sur l'appareil. Les vérifications cherchent l'automatisation et les altérations, jamais le navigateur utilisé. Les vérifications échouées sont listées dans `blockedBy`, et les indices plus faibles sont ajoutés à `riskFlags` sans bloquer.

## Détection des interactions {#interaction-detection}

Cette fonction est expérimentale et désactivée par défaut. Avec **Block automated clicks and typing** activé, le programme compte les clics et les pressions de touches déclenchés par un script plutôt que par le visiteur, et trois de l'un ou l'autre type font échouer la résolution. Il ne lit jamais les valeurs des champs et ignore les champs de mot de passe, de code à usage unique et de carte de paiement.

## Évaluation du comportement {#behavior-scoring}

L'évaluation du comportement est désactivée par défaut et se règle par clé. Le programme enregistre comment le pointeur a atteint le widget et le rythme des pressions de touches, jamais de quelles touches il s'agit. Le serveur en tire un score de 0 à 1 et un verdict `ok`, `suspicious`, `automated` ou `agent`, et bloque `automated` à partir de 0,75 par défaut. Un trajet du pointeur en ligne droite, une pression déclenchée par un script ou une frappe à un rythme parfaitement régulier font tous monter le score.

Le [mode invisible](./invisible.md) et le [mode flottant](./floating.md) appellent `solve()` sans pression sur le widget. Ils échouent donc avec les clés qui en exigent une.

## Détection des agents IA {#ai-agent-detection}

Cap identifie les agents IA à partir des marques que leurs outils laissent dans la page, des schémas de clics et de frappe, et des en-têtes `User-Agent` et `Signature-Agent` signés. Un agent détecté ajoute `agent:<name>` à `riskFlags`. Les clés peuvent bloquer tous les agents, seulement ceux identifiés avec une confiance élevée, ou laisser passer les agents dont la signature [Web Bot Auth](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/) est vérifiée.

## Ce qu'elle ne peut pas arrêter {#what-it-cant-stop}

Le programme tourne dans le navigateur du visiteur. Les défenses rendent donc sa falsification plus coûteuse que son exécution : fonctions intégrées gelées, hachages sur chaque champ, résultats liés à un seul défi et marqueurs d'échec qui entraînent toujours un échec. Cap ne peut toujours pas distinguer une personne d'un vrai navigateur piloté par une personne. Il n'arrête donc pas les personnes payées pour résoudre les défis, les agents dont les interactions arrivent sous forme d'événements ordinaires du système d'exploitation, ni les navigateurs recompilés depuis les sources pour masquer l'automatisation. La preuve de travail continue d'imposer un coût à chacune de ces résolutions.

Les codes d'échec sont listés dans le [dépannage](./troubleshooting/instrumentation.md#error-codes).

## Widgets de versions antérieures {#widgets-from-earlier-releases}

Les anciens widgets continuent de résoudre les défis d'un nouveau serveur, et leurs résolutions portent l'indicateur de risque `legacy_widget`. Ils échouent avec `instr_widget_outdated` sur les clés qui bloquent les interactions automatisées, évaluent le comportement ou bloquent les agents. Mettre le widget à jour corrige le problème.
