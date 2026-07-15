const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourseInRace, cleanupCourse } = require('../helpers/course-lifecycle')
const { waitForTopTeamName } = require('../helpers/ui-waits')
const { openEquipeFiche, infoRow, openPenaliteModal, readTdPreview } = require('../helpers/equipe-fiche')

test.describe('Core E2E - Penalite', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-CORE-001 previsualise et applique une penalite avec impact sur le classement', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_core_001')

    // team1 (categorie A) a 2 tours, team2 (categorie A) a 1 tour: team1 est en tete.
    await bootCourseInRace(api, fixture, [
      { transpondeur: fixture.teams.team1.transpondeur, timestamp: 300000 },
      { transpondeur: fixture.teams.team1.transpondeur, timestamp: 600000 },
      { transpondeur: fixture.teams.team2.transpondeur, timestamp: 200000 },
    ])

    await openEquipeFiche(page, fixture, fixture.teams.team1.equipe)

    await expect(infoRow(page, /^Tours/).locator('td')).toContainText('2')
    await expect(infoRow(page, /^Classement général/).locator('td')).toHaveText('1')
    await expect(infoRow(page, /^Classement categorie/).locator('td')).toHaveText('1')

    const modal = await openPenaliteModal(page)
    // -1 ramene team1 a 1 tour effectif, a egalite de nombre avec team2 mais avec un temps plus tardif:
    // team1 perd la premiere place au profit de team2 (team3, sans le moindre tour, reste hors classement).
    await modal.locator('#input-penalite').fill('-1')

    const toursPreview = await readTdPreview(modal, /^Tours/)
    expect(toursPreview.current).toBe('2')
    expect(toursPreview.next).toBe('1')

    const generalPreview = await readTdPreview(modal, /^Position générale/)
    expect(generalPreview.current).toBe('1')
    expect(generalPreview.next).toBe('2')

    const categoriePreview = await readTdPreview(modal, /^Position catégorie/)
    expect(categoriePreview.current).toBe('1')
    expect(categoriePreview.next).toBe('2')

    await modal.getByRole('button', { name: 'OK' }).click()

    await expect(infoRow(page, /^Tours/).locator('td')).toContainText('1')
    await expect(infoRow(page, /^Classement général/).locator('td')).toHaveText('2')
    await expect(infoRow(page, /^Classement categorie/).locator('td')).toHaveText('2')

    await page.goto('/#/equipes')
    await waitForTopTeamName(page, fixture.teams.team2.nom)
  })
})
