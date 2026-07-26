# Roadmap de mise en conformité — Dossier CDA ↔ Code

> **Objectif** : aligner le code réel sur ce que le *Dossier Projet* affirme, pour que tout soit **réel et démontrable** à l'oral.
> **Échéance** : oral fin juillet 2026. **Point de départ** : 11/06/2026. **Dernière MAJ : 16/06/2026** (remesure après lot P0+P1).
> **Méthode** : cocher au fil de l'eau. Chaque feature codée vient avec ses tests (cas nominal + cas d'erreur).

## Principe de priorisation

Tri par : **risque jury** (affirmation falsifiable qu'on peut demander à montrer) × **compétence CDA évaluée** × **effort**.
**P0 + P1 sont incompressibles.** Si le temps manque, on descope **P3** en ajustant la narration du dossier — jamais P0.

## Règle d'or sur les chiffres

La config de mesure (couverture, k6) arrive en **S1 exprès**, pour piloter avec le réel.
Le jour de la rédaction finale (S7), chaque chiffre du dossier = celui d'un rapport affichable. **Jamais un chiffre qu'on ne peut pas afficher.**

| Chiffre annoncé dans le dossier | Cible | Dernière mesure | Statut |
|---|---|---|---|
| Couverture back-end (lignes) | ≥ 70 % (dossier annonce 78 %) | **61,52 %** — 88 tests · 24 fichiers (16/06) | ❌ sous seuil |
| Couverture composants sensibles | ≥ 85 % | rbac **91,7** ✅ · auth **81,4** ❌ · workspace **82,8** ❌ · attachment **18,2** ❌ (16/06) | ❌ partiel |
| Couverture front (lignes) | 62 % (dossier) | **30,6 %** — hooks 97, lib 92, AuthContext 88, composants 0 (18/06) | ❌ sous seuil (couche hooks/lib faite, composants à couvrir) |
| P95 API REST | < 200 ms | — (k6 à lancer) | ⏳ |
| P95 propagation temps réel | < 500 ms | — (k6 à lancer) | ⏳ |
| Nombre de cas de test « tous au vert » | 64 | **176** (88 back + 88 front, 18/06) | ✅ dépassé |

> **Constat 16/06** : 88 tests back au vert (vs 68 estimés), 25 front. La couverture globale back est à 61,5 % — sous le seuil 70 %. Zones à 0 % : `src/realtime/` (socket) et `src/jobs/` (purge). Zones faibles : `src/controllers/` 42 %, `attachment.service.ts` 18 %, `note.service.ts` 38 %, `storage.ts` 18 %. **Action P3 : monter la couverture back au-dessus de 70 % en ciblant en priorité attachment.service + note.service + 1-2 contrôleurs. Mettre à jour le chiffre dans le dossier (78 % est inatteignable avant l'oral sans travail significatif — ajuster à la valeur réelle ou viser 70 %).**

---

## ✅ Livré et vérifié au 15/06 (socle conforme au dossier)

> Ce socle est **réel et démontrable** — ne pas le retoucher, juste savoir le montrer à l'oral.

**Lot `feature/security-p0` (10–11/06)** :
- [x] **argon2id** (19 Mio / 3 it. / p=1), secrets fail-fast, **CORS** liste blanche + en-têtes **CSP/HSTS/X-Frame/X-Content-Type/Referrer**, **HIBP** k-anonyme, anti-énumération 403 (commit `f6a83d9`).
- [x] **Sanitization XSS** : DOMPurify (front) + sanitize Tiptap/ProseMirror (back), strip `on*` / `javascript:` (commit `a5d114d`).
- [x] **Rate limiting login** 5/min/IP Redis + **harness d'intégration** (`docker-compose.test.yml`, tmpfs) (commit `e2cb2d4`).
- [x] **Tests d'intégration** : refresh blacklisté (T-AUTH-03), JWT clé étrangère (T-AUTH-04), RBAC 403≠404, upload `.exe`→`.png` 415 (T-UP-01) (commit `4916780`).
- [x] **Schéma** ownership/permissions/invitations + **`tokenVersion`** ; `removeMember` révoque les sessions (bump tokenVersion) (commit `ba86af8`).
- [x] **Invitations e-mail** : token + expiry 7 j + acceptation + contrôle d'e-mail (user story du périmètre) (commit `8f41f0a`).

**Lot quick wins (16/06)** — +16 tests unitaires au vert, `tsc` OK :
- [x] Validation Zod (helper `normalizedText`) : note `title` 1–200, workspace `name` 3–50, `.trim()` + `.normalize('NFC')`.
- [x] Whitelist MIME : `+text/plain` (via détection texte UTF-8 `looksLikeText`), `−image/gif`.
- [x] `removeMember` → code **`CANNOT_REMOVE_OWNER`** + mapping 403 contrôleur (**T-WS-01** en test unitaire).
- [x] `updateMemberRole` → **bump `tokenVersion`** du membre modifié (transaction).
- [x] **Rate-limit upload** (`uploadRateLimit` 20/min/IP) + **`.github/dependabot.yml`**.

**Lot P0 outillage (16/06)** — vert (`npm run lint`, `npm run format:check`) :
- [x] **ESLint** flat racine (back Node + front React) + **Prettier** (`.prettierrc.json`, repo normalisé).
- [x] **Husky + lint-staged** (`.husky/pre-commit`) + **gitleaks** (`.gitleaks.toml`).
- [x] **`ci.yml`** : job `lint` (format:check + eslint + `npm audit` + gitleaks) branché à l'emplacement réservé.

**Infra P2 (faite hors session, non committée — à committer)** : Dockerfiles multi-stage non-root (back+front), `docker-compose.prod.yml`, `Caddyfile`, `ci.yml`, `deploy.yml`, `docs/deployment/README.md`, route `/api/health`.

**Socle antérieur (mai)** déjà conforme : JWT HS256 15 min/7 j + cookie `httpOnly/Secure/SameSite=Strict` + blacklist Redis ; RBAC OWNER/EDITOR/VIEWER + `ROLE_WEIGHT` + `canAccessNote` + `resolveWorkspaceFromNote` ; upload magic bytes + 10 Mio + rename UUID + rollback disque ; recherche full-text tsvector (`plainto_tsquery`/`ts_rank`/`ts_headline`, `$queryRaw` paramétré) ; `content` JSONB + `contentText` ; temps réel (JWT au handshake, `note:update`/`note:live`, `@socket.io/redis-adapter`) ; Tailwind v4 + React Query + Tiptap/CodeBlockLowlight + autosave 2 s + AuthContext (token en mémoire, refresh silencieux) ; Conventional Commits.

---

## P0 — Crédibilité immédiate — **outillage en place ✅ (16/06)**

> But : rendre le dossier *vérifiable* via l'outillage qualité. **Fait** : ESLint, Prettier, Husky, gitleaks, CI (lint + Trivy), ADR. **Restent** : remesure couverture, protection `main`.

- [x] **Couverture Vitest** : `@vitest/coverage-v8` installé ; combiné back via `vitest.coverage.config.ts` ; mesure front dans `frontend/vitest.config.ts` ; seuils 70 %/85 %.
- [ ] **Remesurer** les vrais % (back / sensibles / front) et réécrire le tableau ci-dessus.
- [x] **ESLint** flat config racine (back Node + front React) — `npm run lint` au vert (0 erreur, 21 warnings). ✅ 16/06
- [x] **Prettier** + `format:check` en CI — repo normalisé (114 fichiers). ✅ 16/06
- [x] **Husky + lint-staged** pre-commit (`.husky/pre-commit`). ✅ 16/06
- [x] **gitleaks** (`.gitleaks.toml`) en pre-commit (si installé) + en CI. ✅ 16/06
- [x] **`ci.yml`** : job `lint` (format:check + ESLint + `npm audit` high/critical + gitleaks) branché à l'emplacement réservé ; quality/integration/build déjà présents. ✅ 16/06
- [x] **Trivy** (scan images HIGH/CRITICAL, `ignore-unfixed`) dans le job build → bloque le deploy. ✅ 16/06
- [x] **`.github/dependabot.yml`** (npm back + front, GitHub Actions). ✅ 16/06
- [ ] Protéger la branche `main` (merge via PR + CI verte).
- [x] **ADR** dans `docs/adr/` : 5 fiches (Hono, Prisma, Redis, JWT stateless, last-writer-wins) + index. ✅ 16/06

## P1 — Périmètre fonctionnel + RGPD (~6 j) — **livré ✅ 16/06**

> But : compléter les user stories du périmètre + le RGPD, tous démontrables en live.

**Déplacement (user story du périmètre)**
- [x] `moveNote(noteId, targetFolderId)` — valide la cible même workspace (sinon `INVALID_TARGET` → 400). ✅ 16/06
- [x] `moveFolder(folderId, targetParentId)` — même workspace + **anti-cycle** (refus de déplacer dans un descendant). ✅ 16/06
- [x] Routes `PATCH /notes/:id/move` + `PATCH /workspaces/:id/folders/:id/move` + `requireRole(EDITOR)` + tests unitaires. ✅ 16/06
- [x] **Front** : glisser-déposer dans l'arbre (note ou dossier vers un autre dossier, dossier vers le bandeau = retour à la racine), cibles invalides refusées au survol (`canDropOn`). ✅ 26/07

**Propriété / membres** (`backend/src/services/workspace.service.ts`)
- [x] `removeMember` révoque les sessions (incrément `tokenVersion`) — fait au 10/06.
- [x] `transferOwnership` — transaction : `Workspace.ownerId` change, ancien OWNER → EDITOR, nouveau → OWNER (`POST /workspaces/:id/transfer-ownership`). ✅ 16/06
- [x] `updateMemberRole` — **incrément `tokenVersion`** du membre modifié (transaction). ✅ 16/06
- [x] `removeMember` — code d'erreur **`CANNOT_REMOVE_OWNER`** + mapping 403 contrôleur. ✅ 16/06
- [x] `deleteWorkspace` — supprime aussi les **fichiers d'uploads** sur disque (`storage.removeMany` après le commit). ✅ 16/06
- [x] **T-WS-01** : `removeMember` sur OWNER → `CANNOT_REMOVE_OWNER`, zéro écriture (test unitaire). ✅ 16/06

**RGPD** — **implémenté** (`deactivatedAt` exploité ; aucune migration, le champ existait déjà)
- [x] `DELETE /api/me` : `deactivatedAt = now()` + incrément `tokenVersion` + blacklist du refresh courant + grâce 30 j. ✅ 16/06
- [x] **Refus du login d'un compte désactivé** (login + refresh vérifient `deactivatedAt` → 403 `DEACTIVATED`). ✅ 16/06
- [x] `GET /api/me/export` : JSON complet (profil, workspaces, notes, pièces jointes en liens). ✅ 16/06
- [x] Job de **purge à 30 j** (`npm run purge` + scheduler interne opt-in `PURGE_SCHEDULER=on`) : workspaces seul-membre supprimés (+disque), partagés transférés au membre le plus ancien, contributions anonymisées « Utilisateur supprimé », compte supprimé. ✅ 16/06
- [x] Pages publiques front **Mentions légales** + **Politique de confidentialité** (liens en pied de page) + écran **Mon compte** (export + suppression). ✅ 16/06
- [x] **T-RGPD-01** : `DELETE /api/me` → désactivé, grâce 30 j, refresh tokens révoqués (test d'intégration au vert). ✅ 16/06

**Auth — écart de détail**
- [ ] **Délai progressif** après échec de login (500 ms, 1 s…) cité au §10.2 — **absent** (seul le 429 existe). À implémenter (faible effort) **ou** retirer la phrase du dossier.

## P2 — Déploiement + perf + tests lourds — **code livré ✅ (à committer + 3 actions runtime) ⚠️**

> But : le bloc 3 du référentiel (déploiement, tests système/charge, observabilité).
> ⚠️ Tout le **code** P2 est sur le disque, **pas encore committé**. Restent **3 actions runtime** (non automatisables ici) : lancer les 2 scénarios k6 sur une stack vivante pour figer les P95, dérouler une vraie restauration et la dater, provisionner les secrets `.env` sur le VPS. Vérifié au 16/06.

**Infra prod** — ✅ **réalisée (à committer)**
- [x] `backend/Dockerfile` multi-stage **non-root** (`base`/`builder`/`production`, `npm ci --omit=dev`, `prisma generate`, `CMD node dist/index.js`).
- [x] `frontend/Dockerfile` multi-stage → **Caddy sert `/srv`** (build Vite statique).
- [x] **`docker-compose.prod.yml`** : images GHCR par tag, **seul Caddy expose 80/443**, db/redis internes, healthchecks (api `/api/health`), profil `migrate`.
- [x] **`Caddyfile`** : TLS Let's Encrypt auto, `encode zstd br gzip`, reverse-proxy `/api/*` + `/socket.io/*`, fallback SPA.
- [x] **`.github/workflows/deploy.yml`** : `workflow_run`/dispatch → SSH VPS → `pull` → `migrate deploy` → `up -d` ; rollback par tag `sha-`.
- [x] **Compte PostgreSQL applicatif sans DDL** : `infra/postgres/init/10-app-role.sh` crée un rôle DML-only (REVOKE CREATE), `DATABASE_URL` (appli) ≠ `MIGRATE_DATABASE_URL` (propriétaire) ; compose prod monte l'init + migrate en propriétaire. ✅ 16/06

**Sauvegardes**
- [x] **Runbook de déploiement** : `docs/deployment/README.md` (VPS Hetzner, DNS, secrets, GHCR, rollback) — complet.
- [x] `backup.sh` : `pg_dump -Fc` + volume `uploads`, chiffrés GPG AES256 → Hetzner Storage Box (rsync ssh:23) + rétention. `infra/backup/backup.sh`. ✅ 16/06
- [x] **Runbook de restauration** : `docs/runbooks/restore.md` (procédure complète + RPO/RTO). ⚠️ **reste à dérouler pour de vrai et à dater** (journal en bas du fichier) avant l'oral.

**Charge & observabilité**
- [x] **k6** scénario 1 : harness `benchmarks/realtime/note-live-load.mjs` (50 clients `note:live`, P95 propagation). ⚠️ **à lancer sur stack vivante** pour le vrai P95 (T-RT-01).
- [x] **k6** scénario 2 : `benchmarks/k6/rest-workspace.js` (100 req/s `GET /api/workspaces/:id`, seuil P95<200ms, taux HIT via `X-Cache`). ⚠️ **à lancer** pour les vrais chiffres.
- [x] Dossier **`benchmarks/`** + `reports/` (rapports versionnés) + tableau de résultats à remplir. ✅ 16/06
- [x] **Pino** : `lib/logger.ts` (JSON, redaction mdp/tokens/cookies/Authorization, `securityLog` OWASP A09), remplace `hono/logger` + `onError` sans fuite de stack ; events login KO / refresh blacklisté·version·invalide / changement de rôle / 401-403. ✅ 16/06
- [x] **Cache Redis** `cache:workspace:<id>` TTL 60 s (`lib/cache.ts`) + invalidation à chaque écriture workspace/membre + compteurs hits/miss + en-tête `X-Cache`. ✅ 16/06
- [x] **Pagination** enveloppe `{items,total,limit,offset}` sur notes/workspaces/corbeille (cap dur sur arbre dossiers + membres) + déballage `.items` côté hooks TanStack Query. ✅ 16/06

## P3 — Finitions + réconciliation doc (~5,5 j, descopable) — **non démarré**

**Accessibilité RGAA AA**
- [ ] Rétablir le **focus visible** (`outline:none` dans `base.css`, `tiptap.css` et Login inline) : outline/ring custom.
- [ ] Formulaires : `label htmlFor`/`id`, `aria-required`, `aria-invalid`, `aria-describedby` sur les erreurs (Login surtout — labels enveloppants sans liaison).
- [ ] `role="tree"` + `aria-expanded` sur la sidebar/arborescence (absent).
- [ ] (Bonus) tests d'accessibilité (axe) en E2E.

**Éco-conception front**
- [ ] Code splitting des routes secondaires (`React.lazy`/`Suspense`) — absent.
- [ ] Images **WebP** + `loading="lazy"` — absent.
- [ ] Virtualisation de la sidebar (`react-window` ou équivalent) — absent.

**Validation**
- [x] Contraintes Zod : note `title` 1–200, workspace `name` 3–50 (helper `normalizedText`). ✅ 16/06
- [x] `.trim()` + `.normalize('NFC')` sur les titres/noms (helper `normalizedText`). ✅ 16/06
- [ ] Package **`shared`** Zod consommé front + back (cf. arbitrage) — front et back isolés aujourd'hui.
- [x] Whitelist MIME upload : `+text/plain` (détection texte UTF-8), `−image/gif`. ✅ 16/06
- [x] Rate-limit Redis sur la route d'upload (`uploadRateLimit` 20/min/IP). ✅ 16/06
- [ ] Anti-énumération : harmoniser les **404 résiduels** des contrôleurs vers le 403 standardisé.

**Tests système & complétude**
- [ ] **Playwright** E2E : inscription, création workspace, édition collaborative 2 clients, suppression compte (absent — T-RT-01 « Système » non exécutable).
- [ ] Tests front (React Testing Library) : `useNoteAutosave`, `useNoteRealtime`, `AuthContext` (absents — listés au §11).
- [x] Compléter la suite vers **~64 cas** — **~68 aujourd'hui** (49 unit back ✅) ; reste à confirmer les 12 intég en CI Docker. ✅ 16/06
- [ ] **Supertest** : cité au tableau des outils §11 mais l'intégration utilise `app.request()` de Hono → adopter Supertest **ou** corriger la doc.

**Réécriture du dossier (S7)**
- [ ] Remplacer chaque chiffre par sa valeur mesurée (64 cas, couvertures, P95).
- [ ] Passer au présent/futur ce qui resterait non livré (ne rien affirmer de non démontrable : RGPD, déploiement prod, backups testés, ADR…).
- [ ] Harmoniser Dossier Projet ↔ Dossier Professionnel (déploiement, destination backups).
- [ ] Corriger le §7 MEA/MPD + script SQL : PK **`cuid`** (pas UUID), tables **PascalCase** (pas snake_case), **enums Prisma** (pas `CHECK`), `@updatedAt` applicatif (pas trigger) — alignés sur les décisions §23.

---

## Planning sur 7 semaines

| Semaine | Dates | Contenu | État 15/06 |
|---|---|---|---|
| **S1** | 11–15/06 | Tout **P0** (mesurer les vrais chiffres) | ⚠️ dévié : lot **sécurité applicative** livré à la place ; **P0 outillage CI non démarré** |
| **S2** | 16–22/06 | P0 outillage CI **(rattrapage)** + P1 déplacement + propriété/membres | à faire |
| **S3** | 23–29/06 | P1 RGPD complet + pages légales (T-RGPD-01) | à faire |
| **S4** | 30/06–06/07 | P2 infra prod (Dockerfiles, compose prod, Caddyfile, deploy.yml, Trivy) | à faire |
| **S5** | 07–13/07 | P2 backups+runbook daté, Pino, cache, pagination | à faire |
| **S6** | 14–20/07 | P2 k6 (vrais chiffres) + compléter tests + Playwright ; figer la couverture | à faire |
| **S7** | 21–27/07 | P3 finitions RGAA/éco + **réécriture du dossier** + répétition. Tampon. | à faire |

> **Alerte planning** : le socle sécurité est solide, mais **P0 (CI/lint/hooks) a glissé** et S1 est consommée. Sanctuariser S2–S3 (P0 rattrapage + P1), basculer une partie de P2/P3 vers « ajuster la doc » si le rythme alternance serre.

## Décisions déjà actées (§23 — ne pas rouvrir)

- **PK = `cuid()`** : **pas** de migration vers `uuid`. → Corriger le §7 du dossier (MPD) qui annonce UUID.
- **Tables en PascalCase** (convention Prisma). → Corriger le §7 du dossier (qui annonce snake_case + `CHECK`).
- **`deploy.yml` = `workflow_dispatch` + push `main`.** → Harmoniser le Dossier Professionnel.
- **Backups → Hetzner Storage Box.**
- **Couche d'accès aux données = Prisma consommé directement** par les services (pas de couche `repositories/` dédiée, pas d'injection de dépôts). → Dossier projet corrigé le 18/06 (¶ archi multicouche, patrons de conception, couche d'accès). Arbitrage tranché : méthode actuelle conservée. CP8 reste couvert par les extraits Prisma (`$transaction`, `$queryRaw` paramétré, rollback attachment) + les usages Redis. Memo de règles aligné (CP6/CP8).

## Arbitrages restants

1. **Temps réel dispo/semaine** → calibre l'ambition P2/P3.
2. **Package `shared` Zod** : restructuration invasive → reco : le faire si S7 le permet, sinon le présenter comme axe d'évolution.
3. **Délai progressif login** & **Supertest** : implémenter (petit effort) ou descoper la doc — trancher en S2.

## Definition of Done (par lot)

Code + test(s) nominal & erreur au vert + lint/format/tsc OK + (si comportement documenté) cas `T-*` correspondant + couverture non régressée.
