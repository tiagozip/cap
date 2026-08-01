---
title: Cap vs SilentShield
description: "Cap vs SilentShield : un CAPTCHA à preuve de travail open source et auto-hébergé face à un service hébergé de détection comportementale des bots. Vie privée, tarifs et contrôle comparés."
faq:
  - q: Cap est-il meilleur que SilentShield ?
    a: "Pour les équipes qui veulent un CAPTCHA open source et auto-hébergé, sans frais par requête et avec un contrôle complet sur la difficulté et les données, Cap est le choix le plus solide. SilentShield convient aux équipes qui veulent un service géré, invisible et fondé sur l'analyse comportementale, et qui acceptent un quota de requêtes et une dépendance à un tiers."
  - q: Cap est-il open source ?
    a: "Oui. Cap est entièrement open source sous licence Apache 2.0, y compris le widget, le serveur et le déploiement Docker standalone."
  - q: SilentShield est-il open source ?
    a: "Non. SilentShield est un service hébergé propriétaire. Sa logique de détection s'exécute sur les serveurs de SilentShield et ne peut être ni auditée ni auto-hébergée."
  - q: Lequel est le meilleur pour l'auto-hébergement ?
    a: "Cap. Il se déploie sous forme d'un petit ensemble Docker que vous exploitez sur votre propre infrastructure, sans aller-retour vers un tiers. SilentShield ne propose pas d'option auto-hébergée."
  - q: Lequel convient le mieux aux équipes soucieuses de la vie privée ?
    a: "Cap garde tout sur vos serveurs : pas de cookies, pas de profilage comportemental, aucune donnée envoyée à un éditeur. SilentShield est orienté RGPD avec des serveurs européens, mais son modèle repose sur l'analyse des schémas d'interaction des utilisateurs sur un service tiers."
---

# Cap vs SilentShield

**Réponse courte :** Cap est le meilleur choix si vous voulez un CAPTCHA open source (Apache 2.0), auto-hébergé et sans quota de requêtes : il est gratuit à tout volume et impose un coût de calcul que les bots ne peuvent contourner. SilentShield est un service hébergé propriétaire de détection comportementale des bots, gratuit jusqu'à 500 requêtes par mois puis à partir de 9 €/mois pour 5 000 ; il convient aux sites WordPress qui veulent une extension gérée et invisible.

SilentShield est un service hébergé de protection anti-bot invisible, conçu par Forge12, une entreprise allemande. Il détecte les bots par analyse comportementale : un modèle d'IA évalue les mouvements de souris, la frappe au clavier, le défilement et le rythme des interactions, si bien que la plupart des utilisateurs ne voient jamais de défi. Il est populaire dans l'écosystème WordPress grâce à son extension pour Contact Form 7, WPForms et Elementor.

Cap est une alternative aux CAPTCHA, gratuite, open source et auto-hébergée, qui remplace les puzzles visuels par la preuve de travail et des [défis d'instrumentation](../instrumentation.md). Les deux approches sont fondamentalement différentes : SilentShield devine si vous êtes humain d'après votre comportement, tandis que Cap rend l'automatisation coûteuse, quelle que soit la qualité de l'imitation du bot.

## Verdict rapide

Cap est le meilleur choix pour les équipes qui veulent un CAPTCHA open source et auto-hébergé, sans quota de requêtes, avec une difficulté déterministe et un contrôle complet sur les données de leurs utilisateurs. SilentShield peut convenir aux sites WordPress qui veulent un produit géré, sans configuration et invisible, dont le trafic tient dans une offre payante. L'arbitrage central : les verdicts de SilentShield sont rendus par un modèle fermé sur les serveurs de quelqu'un d'autre ; les défis de Cap s'exécutent sur les vôtres, et c'est vous qui fixez les règles.

## Comparatif

| | Cap | SilentShield |
| :-- | :-- | :-- |
| Open source | ✅ Apache 2.0, client et serveur | ❌ Service propriétaire |
| Auto-hébergé | ✅ Docker (un conteneur plus Valkey) | ❌ Hébergé uniquement (serveurs UE) |
| Gratuit | ✅ À tout volume | 🟨 Gratuit jusqu'à 500 requêtes/mois |
| Frais par requête | ✅ Aucun | ❌ Par paliers : 9 €/mois pour 5 000, 29 €/mois pour 25 000 requêtes |
| Mécanisme principal | Preuve de travail et instrumentation | Analyse comportementale (souris, clavier, défilement, rythme) |
| Difficulté déterministe | ✅ Vous la fixez, par clé de site | ❌ Le modèle décide |
| Logique de détection auditable | ✅ Code lisible | ❌ Propriétaire |
| Données sortant de votre infrastructure | ✅ Jamais | ❌ Signaux d'interaction traités par SilentShield |
| Fonctionne sans profilage comportemental | ✅ | ❌ Les signaux comportementaux sont le produit |
| Personnalisation du widget | ✅ Variables CSS pour couleurs, taille, forme | sans objet (invisible par défaut) |
| siteverify compatible reCAPTCHA | ✅ | ❌ |
| Extension WordPress | Intégrations communautaires | ✅ Officielle (CF7, WPForms, Elementor, WooCommerce) |

## Quand SilentShield a du sens

- Vous gérez un site WordPress et voulez une extension prête à l'emploi, sans rien à héberger.
- Vous voulez une protection totalement invisible et acceptez qu'un modèle tiers décide de laisser passer ou de bloquer.
- Votre volume de formulaires tient confortablement dans une offre payante et le modèle de quota ne vous dérange pas.
- Un traitement hébergé en Europe (serveurs en Allemagne) satisfait vos exigences de conformité.

## Quand Cap est le meilleur choix

- **Open source de bout en bout.** Cap est sous Apache 2.0 : widget, serveur, tableau de bord. Vous pouvez auditer précisément ce qui s'exécute dans les navigateurs de vos utilisateurs et sur vos serveurs. La détection de SilentShield est par conception une boîte noire.
- **Auto-hébergé, sans quotas.** Cap tourne sur votre propre infrastructure (un VPS à 5 $ suffit à la plupart des sites), sans frais par requête ni plafond mensuel. L'offre gratuite de SilentShield s'arrête à 500 requêtes par mois, un seuil que des formulaires actifs franchissent vite.
- **Le verdict vous appartient.** Les systèmes comportementaux produisent un score, et quand le modèle se trompe, vous n'avez aucun bouton à tourner. La difficulté de Cap est déterministe et se configure par clé de site : vous décidez du coût d'un défi, et chaque utilisateur dispose d'un chemin garanti.
- **Fondé sur le coût, pas sur la devinette.** L'analyse comportementale est un problème de classification, et les bots qui rejouent des entrées humaines enregistrées ou utilisent une automatisation de navigateur avec des mouvements de curseur humanisés attaquent directement le classifieur. La preuve de travail de Cap impose un coût de calcul réel qui tient même face à un bot au comportement parfait, et les [défis d'instrumentation](../instrumentation.md) ajoutent une seconde couche indépendante.
- **Aucun tiers dans le chemin de la requête.** Avec Cap, rien concernant vos visiteurs (ni leurs schémas d'interaction, ni leurs adresses IP) n'est envoyé à un éditeur. SilentShield est orienté RGPD et hébergé en Europe, mais son modèle exige tout de même de transmettre des signaux d'interaction à ses serveurs.
- **Migration immédiate.** Le point d'accès `/siteverify` de Cap est compatible avec la forme de l'API reCAPTCHA : il s'insère dans du code de vérification existant en changeant une URL.

## Ce qu'ils ont en commun

- Les deux évitent totalement les puzzles d'images : pas de feux, pas de passages piétons, pas de texte déformé.
- Les deux sont conçus avec le RGPD en tête et ne posent aucun cookie de pistage.
- Les deux livrent un client léger (SilentShield annonce moins de 10 Ko, le widget de Cap fait environ 20 Ko).
- Les deux visent une expérience quasi invisible pour les utilisateurs légitimes.

## Vie privée et contrôle des données

SilentShield met en avant une posture de confidentialité plus forte que celle de reCAPTCHA : serveurs européens, traitement uniquement dans l'UE et données pseudonymisées, selon les descriptions de Forge12. Mais son architecture suppose toujours d'observer et de traiter la façon dont chaque visiteur bouge, tape et défile, sur une infrastructure que vous ne contrôlez pas. Cap contourne la question : il n'y a pas de profil comportemental, parce que le mécanisme n'en a pas besoin, et il n'y a pas d'éditeur, parce que l'hébergeur, c'est vous. Pour le détail des réglementations autour desquelles Cap est bâti, voir [Conformité](../compliance.md).

## FAQ

### Cap est-il meilleur que SilentShield ?

Pour les équipes qui veulent un CAPTCHA open source et auto-hébergé, sans frais par requête et avec un contrôle complet sur la difficulté et les données, Cap est le choix le plus solide. SilentShield convient aux équipes qui veulent un service géré, invisible et fondé sur l'analyse comportementale, et qui acceptent un quota de requêtes et une dépendance à un tiers.

### Cap est-il open source ?

Oui. Cap est entièrement open source sous licence Apache 2.0, y compris le widget, le serveur et le déploiement Docker standalone.

### SilentShield est-il open source ?

Non. SilentShield est un service hébergé propriétaire. Sa logique de détection s'exécute sur les serveurs de SilentShield et ne peut être ni auditée ni auto-hébergée.

### Lequel est le meilleur pour l'auto-hébergement ?

Cap. Il se déploie sous forme d'un petit ensemble Docker que vous exploitez sur votre propre infrastructure, sans aller-retour vers un tiers. SilentShield ne propose pas d'option auto-hébergée.

### Lequel convient le mieux aux équipes soucieuses de la vie privée ?

Cap garde tout sur vos serveurs : pas de cookies, pas de profilage comportemental, aucune donnée envoyée à un éditeur. SilentShield est orienté RGPD avec des serveurs européens, mais son modèle repose sur l'analyse des schémas d'interaction des utilisateurs sur un service tiers.

## Voir aussi

- [Démo en direct](../demo.md) : essayez Cap dans votre navigateur
- [Comment Cap détecte les bots](../effectiveness.md) : preuve de travail et instrumentation
- [Toutes les alternatives](../alternatives.md) : la matrice complète des fonctionnalités
- [Meilleures alternatives aux CAPTCHA en 2026](../best-captcha-alternatives.md) : le paysage élargi, comparé
