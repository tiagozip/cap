---
sidebar: false
editLink: false
prev: false
next: false
footer: false
description: "Résoudre les échecs de vérification Cap : solutions pour le CAPTCHA open source auto-hébergé quand les contrôles de preuve de travail ou d'instrumentation échouent dans votre navigateur."
---

# Dépannage

Cette vérification peut échouer pour diverses raisons, pas seulement à cause d'une activité de bot. Si vous n'arrivez pas à la terminer, suivez ces étapes.

## 1. Essayez le mode navigation privée

Ouvrez le mode privé de votre navigateur pour écarter les problèmes causés par des extensions ou des données en cache.

- **Chrome / Edge :** `Ctrl+Maj+N` (Windows) ou `Cmd+Maj+N` (Mac)
- **Firefox :** `Ctrl+Maj+P` (Windows) ou `Cmd+Maj+P` (Mac)
- **Safari :** **Fichier → Nouvelle fenêtre privée**

## 2. Désactivez vos extensions

Certaines extensions peuvent perturber la vérification. Essayez de les désactiver temporairement :

1. Ouvrez les réglages des extensions ou modules de votre navigateur
2. Désactivez temporairement **toutes** les extensions
3. Rechargez la page et réessayez

Si cela résout le problème, réactivez-les une par une pour identifier la coupable.

## 3. Essayez un autre navigateur ou appareil

Le problème peut être propre à votre navigateur actuel. Testez avec un autre navigateur ou un autre appareil.

- Essayez **Chrome**, **Firefox**, **Edge** ou **Safari**
- Remarque : **Internet Explorer n'est pas pris en charge.** Utilisez un navigateur moderne
- Si possible, testez sur un appareil complètement différent (votre téléphone, par exemple)

## 4. Mettez votre navigateur à jour

Un navigateur obsolète peut faire échouer la vérification.

1. Ouvrez le menu de votre navigateur
2. Allez dans **Aide → À propos** (ou équivalent)
3. Installez les mises à jour disponibles et redémarrez le navigateur

## 5. Changez de réseau

Votre réseau actuel impose peut-être des restrictions qui interfèrent avec la vérification.

- Connectez-vous à un **autre réseau Wi-Fi**
- Essayez un **partage de connexion** depuis votre téléphone
- Sur un réseau d'entreprise ou d'école, le filtrage est souvent strict et peut bloquer la vérification

## 6. Fermez toute session de navigateur automatisée

Si vous utilisez un navigateur piloté par un logiciel d'automatisation (Selenium, Puppeteer ou Playwright, par exemple), la vérification sera bloquée.

1. **Fermez complètement** la session de navigateur automatisée
2. Ouvrez la page dans un **navigateur classique, piloté manuellement**
3. Terminez-y la vérification

Les navigateurs d'agents IA sont également bloqués : assurez-vous d'utiliser un navigateur standard.

---

Si vous avez tout essayé sans succès, contactez le propriétaire du site pour obtenir de l'aide. Vous pouvez aussi [ouvrir une issue](https://github.com/tiagozip/cap/issues).
