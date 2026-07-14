# Tests `classements/ui`

Ce dossier contient le socle de tests en 3 couches:

- `test/e2e/`: tests Playwright (parcours navigateur).
- `test/integration/`: tests Jest + Vue Test Utils sur composants Vue 2.
- `test/unit/`: tests Jest sur fonctions pures.
- `test/fixtures/`: fixtures CSV reutilisables.

## Preconditions

- Mode de reference: stack docker `dev` active (`docker compose --profile dev up`).
- UI cible: `http://localhost:8080`.
- API classements cible: `http://localhost:3000`.
- En execution locale hors Docker pour les E2E, Chromium Playwright doit etre installe (`npx playwright install chromium`).

Variables optionnelles:

- `CLASSEMENTS_UI_URL` pour surcharger l'URL UI Playwright.
- `CLASSEMENTS_API_URL` pour surcharger l'URL API helper.

## Commandes

Depuis `classements/ui`:

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e:smoke`
- `npm run test:e2e:core`
- `npm run test:e2e`

## Commandes Docker Compose

Depuis la racine du repo:

- `docker compose --profile dev up classements-ui-test`
- `docker compose --profile dev up classements-ui-e2e-smoke`
- `docker compose --profile dev up classements-ui-e2e-core`
- `docker compose --profile dev up classements-ui-e2e`

Les services E2E Playwright tournent dans `mcr.microsoft.com/playwright:v1.61.1-jammy` et ciblent les URLs internes du reseau Docker:

- `CLASSEMENTS_API_URL=http://classements-dev:3000`
- `CLASSEMENTS_UI_URL=http://classements-ui:8080`

## Helpers E2E mutualises

### `test/e2e/helpers/classements-api.js`

Usage:

- `createClassementsApi(request)`
- Retourne des wrappers API: `/import`, `/course/*`, `/tour/*`, `/equipe/*`, `/transpondeur`, `/test/*`.

Preconditions:

- `request` est `APIRequestContext` Playwright.
- API classements disponible sur `CLASSEMENTS_API_URL` ou `http://localhost:3000`.

### `test/e2e/helpers/course-lifecycle.js`

Usage:

- `cleanupCourse(api)`: cleanup best-effort de la course ouverte.
- `bootCourse(api, fixture)`: cleanup puis import fixture CSV.

Preconditions:

- `api` provient de `createClassementsApi`.
- `fixture` provient de `createCourseFixture`.

### `test/e2e/helpers/ui-waits.js`

Usage:

- `waitForCourseCreationForm(page)`
- `waitForCourseLoaded(page, courseName)`
- `waitForStatusText(page, expectedText)`

Preconditions:

- `page` est une page Playwright deja ouverte sur l'UI.
- Les transitions sont attendues via assertions Playwright (pas de sleep fixe).

## Fixtures CSV

`test/fixtures/course-fixtures.js` expose:

- `createCourseFixture(seedLabel)`

Le helper genere des CSV equipes/equipiers/transpondeurs avec nom de course unique pour isolation des scenarios.
