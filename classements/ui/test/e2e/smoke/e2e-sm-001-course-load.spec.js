const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourse, cleanupCourse } = require('../helpers/course-lifecycle')
const { waitForCourseCreationForm, waitForCourseLoaded, waitForStatusText } = require('../helpers/ui-waits')

function toCsvUpload(name, content) {
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  }
}

async function importCourseFromUi(page, fixture) {
  await waitForCourseCreationForm(page)
  await page.locator('#name').fill(fixture.courseName)
  await page.locator('input[name="equipes"]').setInputFiles(toCsvUpload('equipes.csv', fixture.equipesCsv))
  await page.locator('input[name="equipiers"]').setInputFiles(toCsvUpload('equipiers.csv', fixture.equipiersCsv))
  await page.locator('input[name="transpondeurs"]').setInputFiles(toCsvUpload('transpondeurs.csv', fixture.transpondeursCsv))
  await page.getByRole('button', { name: 'Submit' }).click()
}

async function waitForBadgeCount(container, expectedCount) {
  const badge = container.locator('.badge').first()
  await expect.poll(async () => {
    const text = await badge.textContent()
    return Number.parseInt((text || '').trim(), 10)
  }).toBe(expectedCount)
}

async function seedCourseWithRaceTours(api, fixture) {
  await bootCourse(api, fixture)
  await api.stopTest()
  await api.startCourse()
  await api.addTour({ transpondeur: fixture.teams.team1.transpondeur, timestamp: 300000 })
  await api.addTour({ transpondeur: fixture.teams.team1.transpondeur, timestamp: 600000 })
  await api.addTour({ transpondeur: fixture.teams.team2.transpondeur, timestamp: 200000 })
}

async function clickTeamTourAction(page, transpondeur, confirmationLabel, options = {}) {
  const rowSelector = options.deleted
    ? '#tours-table tbody tr.text-decoration-line-through-red'
    : '#tours-table tbody tr'

  const row = page.locator(rowSelector, { hasText: transpondeur }).first()
  await expect(row).toBeVisible()
  await row.hover()
  await row.locator('button.tour-delete').click()
  await page.getByRole('button', { name: confirmationLabel }).click()
}

async function waitForTopTeamName(page, expectedName) {
  const firstNameCell = page.locator('#equipes-table tbody tr').first().locator('td').nth(1)
  await expect(firstNameCell).toContainText(expectedName)
}

test.describe('Smoke E2E', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-SM-001 importe une nouvelle course depuis le formulaire UI', async ({ page }) => {
    const fixture = createCourseFixture('e2e_sm_001')

    await page.goto('/')
    await importCourseFromUi(page, fixture)

    await waitForCourseLoaded(page, fixture.courseName)
    await waitForStatusText(page, 'Test avant course')

    await expect(page.getByRole('link', { name: /Tours/i })).toBeVisible()
    await waitForBadgeCount(page.getByRole('link', { name: /Tours/i }), 0)
    await waitForBadgeCount(page.getByRole('link', { name: /Classements/i }), 3)
    await waitForBadgeCount(page.getByRole('link', { name: /Transpondeurs/i }), 4)
  })

  test('E2E-SM-002 ouvre une course existante depuis la liste des fichiers', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_sm_002')

    await api.importCourseFromFixture(fixture)
    await cleanupCourse(api)

    await page.goto('/')
    await waitForCourseCreationForm(page)

    await page.getByRole('button', { name: fixture.courseFilename }).click()
    await waitForCourseLoaded(page, fixture.courseName)

    await page.getByRole('link', { name: /Tours/i }).click()
    await expect(page).toHaveURL(/\/tours$/)
    await page.getByRole('link', { name: /Classements/i }).click()
    await expect(page).toHaveURL(/\/equipes$/)
    await page.getByRole('link', { name: /Transpondeurs/i }).click()
    await expect(page).toHaveURL(/\/transpondeurs$/)
  })

  test('E2E-SM-003 pilote le cycle DEPART -> COURSE -> FIN depuis l UI', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_sm_003')

    await bootCourse(api, fixture)

    await page.goto('/')
    await waitForCourseLoaded(page, fixture.courseName)
    await waitForStatusText(page, 'Test avant course')

    await page.locator('#status').getByRole('button', { name: /^Stop$/ }).click()
    await waitForStatusText(page, /Attente/i)

    await page.getByRole('button', { name: /D.part/i }).click()
    await waitForStatusText(page, /tour/i)

    await page.locator('#status').getByRole('button', { name: /^Stop$/ }).click()
    await page.getByRole('button', { name: /^OK$/ }).click()
    await waitForStatusText(page, /Course termin/i)
  })

  test('E2E-SM-004 supprime puis restaure un tour et recalcule les compteurs', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_sm_004')

    await seedCourseWithRaceTours(api, fixture)

    await page.goto('/#/tours')
    await waitForCourseLoaded(page, fixture.courseName)

    await waitForBadgeCount(page.getByRole('button', { name: /Normaux/i }), 3)
    await waitForBadgeCount(page.getByRole('button', { name: /Supprim/i }), 0)

    await page.goto(`/#/equipe/${fixture.teams.team1.equipe}`)
    await clickTeamTourAction(page, fixture.teams.team1.transpondeur, /^Supprimer$/)

    await page.goto('/#/tours')
    await waitForBadgeCount(page.getByRole('button', { name: /Normaux/i }), 2)
    await waitForBadgeCount(page.getByRole('button', { name: /Supprim/i }), 1)

    await page.getByRole('button', { name: /Supprim/i }).click()
    await expect(
      page.locator('#tours-table tbody tr.text-decoration-line-through-red', {
        hasText: fixture.teams.team1.transpondeur,
      }).first(),
    ).toBeVisible()

    await page.goto(`/#/equipe/${fixture.teams.team1.equipe}`)
    await clickTeamTourAction(page, fixture.teams.team1.transpondeur, /^Restaurer$/, { deleted: true })

    await page.goto('/#/tours')
    await waitForBadgeCount(page.getByRole('button', { name: /Normaux/i }), 3)
    await waitForBadgeCount(page.getByRole('button', { name: /Supprim/i }), 0)
  })

  test('E2E-SM-005 met a jour le classement en temps reel apres correction de tour', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_sm_005')

    await seedCourseWithRaceTours(api, fixture)

    await page.goto('/#/equipes')
    await waitForCourseLoaded(page, fixture.courseName)
    await waitForTopTeamName(page, fixture.teams.team1.nom)

    await page.goto(`/#/equipe/${fixture.teams.team1.equipe}`)
    await clickTeamTourAction(page, fixture.teams.team1.transpondeur, /^Supprimer$/)

    await page.goto('/#/equipes')
    await waitForTopTeamName(page, fixture.teams.team2.nom)

    await page.goto(`/#/equipe/${fixture.teams.team1.equipe}`)
    await clickTeamTourAction(page, fixture.teams.team1.transpondeur, /^Restaurer$/, { deleted: true })

    await page.goto('/#/equipes')
    await waitForTopTeamName(page, fixture.teams.team1.nom)
  })
})
