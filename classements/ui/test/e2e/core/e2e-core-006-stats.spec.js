const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourseInRace, cleanupCourse } = require('../helpers/course-lifecycle')

test.describe('Core E2E - Stats', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-CORE-006 verifie la coherence des indicateurs de la page stats', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_core_006')
    const team1 = fixture.teams.team1

    await bootCourseInRace(api, fixture, [
      { transpondeur: team1.transpondeur, timestamp: 300000 },
    ])

    await page.goto('/#/stats')
    const toursTable = page.locator('table').first()
    await expect(toursTable).toContainText('Tours :')
    const totalCell = toursTable.locator('tr').first().locator('td')
    const totalBefore = Number.parseInt((await totalCell.innerText()).trim(), 10)
    expect(totalBefore).toBeGreaterThanOrEqual(1)

    // Le graphe tours/min et le graphe de bruit doivent chacun rendre un canvas.
    await expect(page.locator('canvas')).toHaveCount(2)

    await api.addTour({ transpondeur: team1.transpondeur, timestamp: 400000 })
    await expect.poll(async () => Number.parseInt((await totalCell.innerText()).trim(), 10)).toBeGreaterThan(totalBefore)

    // Le bruit (Sta/Box/minSta/minBox) provient du service chrono/simulateur reel: on l'attend sans bloquer si indisponible.
    const noiseTable = page.locator('table').nth(1)
    const staCell = noiseTable.locator('tr', { hasText: /^Sta noise/ }).locator('td')
    let noiseAvailable = true
    try {
      await expect.poll(async () => (await staCell.innerText()).trim(), { timeout: 15000 }).not.toBe('')
    } catch (err) {
      noiseAvailable = false
    }
    if (noiseAvailable) {
      await expect(noiseTable.locator('tr', { hasText: /^Box noise/ }).locator('td')).not.toHaveText('')
      await expect(noiseTable.locator('tr', { hasText: /^Min Sta noise/ }).locator('td')).not.toHaveText('')
      await expect(noiseTable.locator('tr', { hasText: /^Min Box noise/ }).locator('td')).not.toHaveText('')
    }
  })
})
