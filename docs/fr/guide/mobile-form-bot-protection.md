---
title: "Un CAPTCHA pour formulaires mobiles, sans les puzzles"
description: "Comment arrêter les bots sur les formulaires mobiles sans puzzles d'images : ce qu'exige un CAPTCHA adapté au mobile et comment la preuve de travail en un tap de Cap s'y prête. Essayez la démo."
faq:
  - q: Quel est le meilleur CAPTCHA pour les formulaires mobiles ?
    a: "Un CAPTCHA qui ne peut jamais afficher de puzzle et ne se trompe jamais de classification. Le modèle de Cap, case à cocher plus preuve de travail, est déterministe, pèse environ 20 Ko et est pensé pour le tactile."
  - q: Comment arrêter le spam sur les formulaires mobiles ?
    a: "Imposez un coût au lieu de poser des questions. La preuve de travail rend chaque envoi coûteux en calcul pour les bots à grande échelle, tout en restant un simple tap pour les humains."
  - q: Un CAPTCHA invisible est-il meilleur sur mobile ?
    a: "Seulement si son taux d'erreur tient, et le mobile est précisément l'endroit où les signaux d'empreinte et de comportement sont les plus faibles. Les mécanismes déterministes n'ont pas ce mode de défaillance."
  - q: Cap fonctionne-t-il sur mobile ?
    a: "Oui : Safari mobile, Chrome, Firefox et webviews intégrées aux applications. La difficulté est réglable, pour que le temps de résolution reste court sur les appareils plus lents."
  - q: Quel CAPTCHA génère le moins de friction ?
    a: "Les options sans puzzles : Cap, Turnstile, FriendlyCaptcha, ALTCHA, SilentShield. Cap est celle qui est open source et auto-hébergée, où la faible friction vient de la conception du mécanisme plutôt que du verdict d'un classifieur."
---

# CAPTCHA pour formulaires mobiles : protéger sans puzzles

**Réponse courte :** la meilleure protection anti-bot pour les formulaires mobiles évite totalement les puzzles d'images, livre un petit bundle, fonctionne dans les webviews et les navigateurs axés sur la vie privée, et ne punit jamais les utilisateurs pour des signaux d'empreinte faibles. Cap est une alternative aux CAPTCHA, gratuite, open source et auto-hébergée, bâtie exactement sur ce principe : une case à cocher en un tap, adossée à la preuve de travail et à des [défis d'instrumentation](./instrumentation.md) plutôt qu'à des puzzles ou à du profilage.

## Pourquoi les CAPTCHA sont-ils pires sur mobile ?

C'est sur mobile que les CAPTCHA font le plus de dégâts à la conversion :

- **Les grilles d'images ne tiennent pas.** « Sélectionnez tous les feux tricolores » sur un écran de 6 pouces, c'est plisser les yeux, zoomer et rater ses taps. Les boucles de nouvelle tentative, agaçantes sur ordinateur, deviennent enrageantes sur mobile.
- **Le clavier et le remplissage automatique sont interrompus.** Un défi qui apparaît au milieu du formulaire referme le clavier, casse le remplissage automatique et fait perdre sa place à l'utilisateur.
- **Des signaux plus faibles pour les systèmes « invisibles ».** Les systèmes fondés sur les empreintes ou le comportement s'appuient sur les mouvements de souris et une identité réseau stable. Sur mobile, il n'y a pas de souris, mais beaucoup de NAT opérateur (des milliers d'utilisateurs derrière une même IP) et une prévention du pistage agressive dans Safari. Moins de signal, c'est plus d'erreurs, et les erreurs deviennent des puzzles ou des blocages.
- **Les webviews.** Une part énorme du trafic mobile vient de navigateurs intégrés aux applications (Instagram, TikTok, Gmail), qui paraissent « suspects » aux systèmes fondés sur les empreintes.
- **Bande passante et batterie.** Un script de CAPTCHA de plus de 500 Ko sur un téléphone de milieu de gamme en réseau cellulaire, c'est un vrai coût avant même que l'utilisateur ait tapé quoi que ce soit.

## Ce qu'exige une protection anti-bot adaptée au mobile

1. **Aucun puzzle visuel**, en aucune circonstance de repli. Si le système *peut* servir une grille, les utilisateurs mobiles finiront par en voir une.
2. **Un passage déterministe pour les humains.** Pas de scores de risque qui se dégradent sur les IP opérateur ou dans les webviews.
3. **Un petit bundle.** La protection ne doit pas coûter plus cher que le formulaire.
4. **Une expérience pensée pour le tactile.** Un tap au maximum, un retour de progression clair, aucune interruption du clavier.
5. **Un coût réglable.** Le temps de résolution doit être un curseur que vous contrôlez, pour que les appareils modestes n'attendent pas.

## Comment Cap se comporte sur les formulaires mobiles

- **Un tap, puis la progression.** L'utilisateur tape sur une case ; un pourcentage se remplit pendant que la preuve de travail s'exécute dans le navigateur. Pas d'images, pas de saisie, pas de clavier qui se referme. En mode [flottant](./floating.md) ou [programmatique](./programmatic.md), rien n'est visible avant l'envoi.
- **Widget d'environ 20 Ko.** Un simple composant web, sans dépendance à un framework, peu coûteux en cellulaire. Voir le [benchmark](./benchmark.md).
- **Aucune pénalité liée aux empreintes.** Peu importe à Cap que le visiteur soit derrière un NAT opérateur, dans une webview Instagram ou sur Safari iOS avec la prévention du pistage. La preuve de travail est le même calcul pour tout le monde.
- **La difficulté vous appartient.** Réglez-la par clé de site sur le [serveur standalone](./standalone/options.md) : plus légère pour le trafic de paiement grand public sur des Android de milieu de gamme, plus lourde pour des points d'inscription exposés aux abus.
- **L'instrumentation s'applique toujours.** Les [défis d'instrumentation](./instrumentation.md) vérifient un véritable environnement navigateur et attrapent l'automatisation headless que la seule preuve de travail laisserait passer, sans profiler l'humain.

Une contrepartie honnête : la preuve de travail consomme du temps CPU, et les téléphones modestes résolvent plus lentement que les ordinateurs. Cap l'atténue avec une difficulté configurable et un retour de progression visible, et le calcul a lieu une fois par formulaire, pas à chaque page vue.

## Comment se comporte le reste du champ sur mobile

- **reCAPTCHA v2 / hCaptcha :** les grilles d'images sont la pire expérience mobile possible, et les deux y reviennent en repli. Le client de reCAPTCHA pèse en plus plus de 500 Ko. [Cap vs reCAPTCHA →](./alternatives/recaptcha.md) · [Cap vs hCaptcha →](./alternatives/hcaptcha.md)
- **reCAPTCHA v3 :** invisible, mais fondé sur un score, et les signaux mobiles faibles (NAT, webviews) tirent les scores vers le bas, sans recours.
- **Turnstile :** invisible et léger, mais piloté par les empreintes ; les fonctions de confidentialité de Safari mobile et des webviews sont des sources d'erreurs connues, et vous ne pouvez pas contredire son verdict. [Cap vs Turnstile →](./alternatives/turnstile.md)
- **FriendlyCaptcha :** preuve de travail comme Cap, donc mécaniquement adapté au mobile, mais hébergé, facturé au quota et limité à la preuve de travail. [Cap vs FriendlyCaptcha →](./alternatives/friendlycaptcha.md)
- **SilentShield :** l'analyse comportementale s'appuie sur les schémas de souris, de clavier et de défilement, des signaux plus minces et de nature différente sur écran tactile ; la qualité de classification sur mobile est par nature plus difficile à vérifier, et c'est un service fermé, facturé au quota. [Cap vs SilentShield →](./alternatives/silentshield.md)

## Notes d'implémentation

- Placez le widget dans votre `<form>` et Cap injecte automatiquement le champ `cap-token` ; aucun JavaScript requis. [Démarrage rapide →](./index.md)
- Pour les SPA et les webviews d'applications, utilisez l'événement `solve` ou le [mode programmatique](./programmatic.md) pour garder la main sur le parcours.
- Testez sur un vrai Android de milieu de gamme en réseau cellulaire, pas seulement sur un modèle haut de gamme en Wi-Fi, et ajustez la difficulté jusqu'à ce que la résolution paraisse instantanée pour votre public.
- Vous protégez l'API d'une application native plutôt qu'un formulaire web ? Le [serveur standalone](./standalone/api.md) de Cap vérifie les jetons de tout client capable d'exécuter le défi dans une webview.

## FAQ

### Quel est le meilleur CAPTCHA pour les formulaires mobiles ?

Un CAPTCHA qui ne peut jamais afficher de puzzle et ne se trompe jamais de classification. Le modèle de Cap, case à cocher plus preuve de travail, est déterministe, pèse environ 20 Ko et est pensé pour le tactile.

### Comment arrêter le spam sur les formulaires mobiles ?

Imposez un coût au lieu de poser des questions. La preuve de travail rend chaque envoi coûteux en calcul pour les bots à grande échelle, tout en restant un simple tap pour les humains.

### Un CAPTCHA invisible est-il meilleur sur mobile ?

Seulement si son taux d'erreur tient, et le mobile est précisément l'endroit où les signaux d'empreinte et de comportement sont les plus faibles. Les mécanismes déterministes n'ont pas ce mode de défaillance.

### Cap fonctionne-t-il sur mobile ?

Oui : Safari mobile, Chrome, Firefox et webviews intégrées aux applications. La difficulté est réglable, pour que le temps de résolution reste court sur les appareils plus lents.

### Quel CAPTCHA génère le moins de friction ?

Les options sans puzzles : Cap, Turnstile, FriendlyCaptcha, ALTCHA, SilentShield. Cap est celle qui est open source et auto-hébergée, où la faible friction vient de la conception du mécanisme plutôt que du verdict d'un classifieur.

## Voir aussi

- [CAPTCHA et taux de conversion](./captcha-conversion-rate.md) : le calcul de l'entonnoir, sur ordinateur et sur mobile
- [Meilleures alternatives aux CAPTCHA en 2026](./best-captcha-alternatives.md) : tout le paysage
- [Démo en direct](./demo.md) : essayez-la sur votre téléphone
- [Efficacité](./effectiveness.md) : pourquoi le coût vaut mieux que la classification
