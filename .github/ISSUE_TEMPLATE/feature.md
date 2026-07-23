---
name: "🧩 Fonctionnalité"
about: "Décrire une fonctionnalité avec user story, critères d'acceptation, DoR et DoD."
title: "feat(scope): "
labels: enhancement
assignees: ''
---

## User story

<!-- Une seule phrase, format « rôle / besoin / bénéfice ». -->
> **En tant que** <rôle> **je veux** <capacité> **afin de** <bénéfice>.

## Description

<!-- Contexte fonctionnel + périmètre technique : routes/événements, schémas,
     middlewares, contraintes de sécurité/RGPD concernés. Rester factuel. -->



## Critères d'acceptation (Given / When / Then)

<!-- Chaque critère doit être observable et testable (Vitest / Playwright). -->

1. **Given** <contexte> **When** <action> **Then** <résultat attendu>.
2. **Given** … **When** … **Then** …
3. **Given** … **When** … **Then** …

## Definition of Ready (le ticket peut entrer en sprint)

- [ ] User story rédigée au format « En tant que… je veux… afin de… »
- [ ] Critères d'acceptation testables décrits en Given / When / Then
- [ ] Périmètre technique identifié (routes, événements, schémas, middlewares)
- [ ] Dépendances et impacts explicités (RBAC, sécurité, RGPD, temps réel)
- [ ] Maquette Figma et/ou contrat d'API disponibles si nécessaire
- [ ] Ticket estimé, priorisé et rattaché à un sprint (milestone)
- [ ] Aucune ambiguïté bloquante restante

## Definition of Done (le ticket est terminé)

- [ ] Code implémenté et conforme à tous les critères d'acceptation
- [ ] Tests unitaires et/ou d'intégration écrits et au vert (Vitest)
- [ ] Contrôle d'accès RBAC vérifié (OWNER / EDITOR / VIEWER)
- [ ] Validation des entrées (Zod) et gestion des erreurs en place
- [ ] Revue de code approuvée via Pull Request
- [ ] Commits au format Conventional Commits
- [ ] CI verte (lint, typecheck, tests, build)
- [ ] Documentation / changelog mis à jour si nécessaire

## Priorité

<!-- Cocher une seule case, et poser le label `priority: *` correspondant. -->

- [ ] 🔴 Haute
- [ ] 🟡 Moyenne
- [ ] 🟢 Basse

## Labels attendus

`enhancement` + zone (`area: backend` / `area: frontend`) + domaine
(`realtime` / `rbac` / `security` / `editor` / `attachments`) + `priority: *`.
