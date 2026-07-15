const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourse, cleanupCourse } = require('../helpers/course-lifecycle')
const { openEquipeFiche, equipierRow, openEquipierTranspondeursModal } = require('../helpers/equipe-fiche')

test.describe('Core E2E - Transpondeur', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-CORE-004 affecte a un equipier un transpondeur deja utilise et confirme le remplacement', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_core_004')
    const team1 = fixture.teams.team1
    const team2 = fixture.teams.team2

    await bootCourse(api, fixture)

    await openEquipeFiche(page, fixture, team1.equipe)
    const modal = await openEquipierTranspondeursModal(page, team1.dossard)
    await modal.getByPlaceholder('ID transpondeur').fill(team2.transpondeur)
    await modal.locator('table tr').last().locator('button').click()

    // Le fixture nomme chaque equipier `Nom<dossard>` (voir course-fixtures.js).
    await expect(page.getByText(`Nom${team2.dossard}`)).toBeVisible()
    await page.getByRole('button', { name: 'Remplacer' }).click()

    await expect(modal.locator('table tr', { hasText: team2.transpondeur })).toBeVisible()
    await modal.getByRole('button', { name: 'OK' }).click()

    await expect(equipierRow(page, team1.dossard).locator('td').nth(7)).toContainText(team2.transpondeur)
    await expect(equipierRow(page, team1.dossard).locator('td').nth(7)).toContainText(team1.transpondeur)

    await openEquipeFiche(page, fixture, team2.equipe)
    await expect(equipierRow(page, team2.dossard).locator('td').nth(7)).not.toContainText(team2.transpondeur)
  })
})
