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

### `test/e2e/helpers/equipe-fiche.js`

Usage:

- `openEquipeFiche(page, fixture, numero)`: navigue vers la fiche equipe et attend son chargement.
- `openPenaliteModal(page)` / `openCategorieModal(page)`: ouvrent les modales de correction depuis le tableau d'info equipe.
- `openEquipierTourModal(page, dossard)` / `openEquipierTranspondeursModal(page, dossard)`: ouvrent les modales par equipier depuis le tableau des equipiers.
- `infoRow(page, labelPattern)` / `equipierRow(page, dossard)`: localisent une ligne par libelle (ancre en debut de texte de ligne).
- `readTdPreview(modal, labelPattern)` / `readThPreview(modal, labelPattern)`: lisent les valeurs courante/previsionnelle d'une ligne de previsualisation (`th`/`td` selon la structure de la ligne).

Preconditions:

- `page` est deja sur la fiche equipe (`/#/equipe/:numero`) pour les fonctions de modale/ligne.

### `test/e2e/helpers/course-lifecycle.js` (complement)

- `bootCourseInRace(api, fixture, tours)`: `bootCourse` puis bascule `TEST -> COURSE` puis ajoute une liste de tours `{ transpondeur, timestamp }`.

## Fixtures CSV

`test/fixtures/course-fixtures.js` expose:

- `createCourseFixture(seedLabel)`

Le helper genere des CSV equipes/equipiers/transpondeurs avec nom de course unique pour isolation des scenarios.
Chaque equipe a un seul equipier, nomme `Nom<dossard>`/`Prenom<dossard>` (utilise par les tests de conflit de transpondeur).

## Helpers d'integration mutualises

### `test/integration/helpers/factories.js`

Usage:

- `createEquipe(overrides)` / `createEquipier(overrides)` / `createTour(overrides)` / `createTranspondeur(overrides)`: objets de donnees avec des valeurs par defaut coherentes, surchargeables au cas par cas.
- `createStoreState(overrides)`: etat Vuex minimal (`course`, `tours`, `equipes`, `equipiers`, `transpondeurs`, `noise`, ...) a passer en `mocks.$store.state`.
- `stubBvModal(vm, confirmResult)`: remplace `$bvModal` par un mock (`msgBoxConfirm`, `show`). `$bvModal` est expose par bootstrap-vue via un getter en lecture seule qui lit `vm._bv__modal` : on ne peut pas le mocker via l'option `mocks` de vue-test-utils, d'ou ce helper qui ecrit directement `vm._bv__modal`.

Preconditions / limites connues:

- Les composants qui appellent `this.$root.URL` (`ToursTable`, `EquipierTranspondeurs`, `EquipePenalite`, `EquipeCategorie`, `EquipierTour`) doivent voir cette URL positionnee explicitement sur le wrapper monte, via `wrapper.vm.$root.URL = '...'` (le mock `$store.state.URL` ne suffit pas, ce sont deux valeurs distinctes dans le code source).
- Les composants importants `vue-chartjs` (`EquipierChart`, `ToursMinChart`, `NoiseChart`) doivent etre mockes avec `jest.mock('.../XxxChart.vue', () => ({ name: 'Xxx', render: h => h('div') }))` avant le `require` du composant teste, car `vue-chartjs/legacy` est un module ESM non transpilable par la config Jest actuelle.

## Couverture E2E core (tache 03)

- `E2E-CORE-001`: previsualisation + application d'une penalite (tours/position generale/categorie), verifie aussi la propagation dans `Equipes/Classements`.
- `E2E-CORE-002`: previsualisation + application d'un changement de categorie, verifie la propagation dans la liste filtree par categorie.
- `E2E-CORE-003`: ajout manuel d'un tour equipier insere entre deux passages existants (previsualisation nb tours, positions, duree impactee `newDuree`), verifie la propagation dans l'ecran `Tours`.
- `E2E-CORE-004`: affectation d'un transpondeur deja utilise par un autre equipier, confirmation du remplacement, verifie la reassociation (l'ancien propriétaire ne le possede plus).
- `E2E-CORE-005`: filtres de l'ecran `Transpondeurs` (Actifs/Inactifs/Sans passage course/Inconnus) et navigation vers la fiche equipe.
- `E2E-CORE-006`: coherence des indicateurs de l'ecran `Stats` (total tours avant/apres, presence des graphes, bruit Sta/Box/minSta/minBox si le service chrono/simulateur les fournit).

### Limites connues

- `E2E-CORE-006` ne fait pas echouer le test si le bruit (Sta/Box/minSta/minBox) n'est pas disponible dans les 15s: cette donnee provient du service `chrono`/`sim` reel et peut etre absente selon l'environnement d'execution.
- `E2E-CORE-007` (robustesse de reconnexion websocket, coupure d'un service amont) n'est pas automatise: il necessite un pilotage de l'infra (arret/redemarrage cible d'un conteneur) hors de portee du run Playwright actuel.

## Couverture integration (tache 04)

Matrice composant -> comportements verifies (mocks store/fetch/router/`$bvModal`, sans stack Docker):

| Composant | Comportements verifies |
| --- | --- |
| `App.vue` (`INT-APP-*`) | Bascule formulaire nouvelle course / navbar course chargee ; texte de statut par etat (`TEST`/`DEPART`/`COURSE`/`FIN`) ; `toursAll` filtre `ignore` selon `TEST` ; `showDepart`/`showError` ; actions `startTest`/`stopTest`/`startCourse`/`closeCourse`/`openCourse` (endpoints + methode HTTP) ; `stopCourse` conditionne a la confirmation `$bvModal`. |
| `Tours.vue` (`INT-TOURS-001`, `003`, `004`) | Filtres `toursAll/Normaux/Duplicate/Deleted/Unknown` ; regle `TEST` vs hors `TEST` sur `toursAll` ; recherche multi-mots sur transpondeur+dossard (bug corrige : la recherche comparait l'array `tours` au lieu du `tour` courant). |
| `ToursTable.vue` (`INT-TOURS-002-*`) | Suppression d'un tour normal (confirmation puis `DELETE /tour/:id`) ; restauration d'un tour `deleted`/`duplicate` (confirmation puis `POST /tour/:id` `{status:null}`) ; annulation de la confirmation (aucun fetch) ; classes visuelles `text-decoration-line-through-red/blue` ; navigation `showEquipe`. |
| `Equipes.vue` (`INT-EQUIPES-*`) | Tri par `position_general` ; liste des `categories` deduites ; filtre par categorie courante ; recherche sur nom d'equipe et sur nom/prenom/dossard des equipiers ; combinaison filtre + recherche. |
| `Equipe.vue` (`INT-EQUIPE-*`) | Projection des equipiers (nb tours, dernier passage, duree moyenne), exclusion des tours `deleted`/`duplicate` de cette projection quel que soit le statut ; liste des tours de l'onglet filtree selon `TEST` et restreinte a l'equipe consultee ; presence des sous-actions `EquipePenalite`/`EquipeCategorie`/`EquipierTour`/`EquipierTranspondeurs` (mount complet, ces sous-composants sont dans un scoped slot `b-table`). |
| `EquipePenalite.vue` (`INT-EQUIPE-PENALITE-*`) | Annuler (`cancel`) ou fermer (`hide` : croix/ESC/backdrop) la modale n'envoie aucune requete ; seule la validation (`ok`) appelle `POST /equipe/:id` avec la penalite saisie. |
| `EquipeCategorie.vue` (`INT-EQUIPE-CATEGORIE-*`) | Idem : `cancel`/`hide` sans effet, `ok` seul declenche `POST /equipe/:id` avec la nouvelle categorie. |
| `EquipierTour.vue` (`INT-EQUIPE-TOUR-*`) | Idem : `cancel`/`hide` sans effet, `ok` seul declenche `POST /tour` avec le tour manuel saisi. |
| `Transpondeurs.vue` (`INT-TRANSPONDEURS-001` a `008`) | Filtres `Actifs/Inactifs/Inconnus/Sans passage course/Sans passage` ; recherche sur id/dossard/equipier/equipe/categorie ; `rowClass` (`table-danger`/`table-warning`) ; navigation `showEquipe`. |
| `EquipierTranspondeurs.vue` (`INT-TRANSPONDEURS-009` a `014`) | Ajout d'un transpondeur libre ou inconnu sans confirmation ; conflit d'affectation avec confirmation (message nominatif, `okTitle: 'Remplacer'`) et reassignation si confirme, aucun changement si annule ; `remove` bascule `deleted`+`changed` ; `onSubmit` n'envoie que les entrees `changed` avec le payload `{id, dossard, deleted}`. |
| `Stats.vue` (`INT-STATS-001`, `002`) | `toursMin` regroupe par bucket minute les tours valides uniquement (exclut `deleted`/`duplicate`/`ignore`) ; `lastNoise` expose le dernier releve de `noise`. |

### Limites connues

- `EquipierTranspondeurs.onShow` (reinitialisation de `newTranspondeurs` a l'ouverture de la modale) n'est pas testee : les objets `transpondeur` sont partages par reference avec `equipier.transpondeurs`, donc une mutation via `remove()` altere aussi la source clonee par `onShow`, ce qui rend le comportement de reinitialisation incorrect en l'etat (bug pre-existant, hors perimetre de cette tache).
