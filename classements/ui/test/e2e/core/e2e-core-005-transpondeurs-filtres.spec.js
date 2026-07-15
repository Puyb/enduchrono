const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourseInRace, cleanupCourse } = require('../helpers/course-lifecycle')
const { waitForBadgeCount } = require('../helpers/ui-waits')

test.describe('Core E2E - Transpondeurs filtres', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-CORE-005 filtre les transpondeurs actifs/inactifs/sans-passage/inconnus et navigue vers la fiche equipe', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_core_005')
    const team1 = fixture.teams.team1
    const team2 = fixture.teams.team2
    const team3 = fixture.teams.team3

    // seul team1 a un passage en course, team3 est desactive, le transpondeur inconnu vient du fixture.
    await bootCourseInRace(api, fixture, [
      { transpondeur: team1.transpondeur, timestamp: 300000 },
    ])
    await api.upsertTranspondeur({ id: team3.transpondeur, dossard: team3.dossard, deleted: true })

    await page.goto('/#/transpondeurs')
    await waitForBadgeCount(page.getByRole('button', { name: /^Tous/ }), 4)

    await page.getByRole('button', { name: /^Actifs/ }).click()
    await expect(page.locator('#transpondeurs-table tbody tr')).toHaveCount(2)
    await expect(page.locator('#transpondeurs-table tbody tr', { hasText: team1.transpondeur })).toBeVisible()
    await expect(page.locator('#transpondeurs-table tbody tr', { hasText: team2.transpondeur })).toBeVisible()

    await page.getByRole('button', { name: /^Inactifs/ }).click()
    await expect(page.locator('#transpondeurs-table tbody tr')).toHaveCount(1)
    await expect(page.locator('#transpondeurs-table tbody tr', { hasText: team3.transpondeur })).toBeVisible()

    await page.getByRole('button', { name: /^Sans passage course/ }).click()
    await expect(page.locator('#transpondeurs-table tbody tr')).toHaveCount(2)
    await expect(page.locator('#transpondeurs-table tbody tr', { hasText: team2.transpondeur })).toBeVisible()
    await expect(page.locator('#transpondeurs-table tbody tr', { hasText: team3.transpondeur })).toBeVisible()
    await expect(page.locator('#transpondeurs-table tbody tr', { hasText: team1.transpondeur })).toHaveCount(0)

    await page.getByRole('button', { name: /^Inconnus/ }).click()
    await expect(page.locator('#transpondeurs-table tbody tr')).toHaveCount(1)
    await expect(page.locator('#transpondeurs-table tbody tr', { hasText: fixture.unknownTranspondeur })).toBeVisible()

    await page.getByRole('button', { name: /^Actifs/ }).click()
    await page.locator('#transpondeurs-table tbody tr', { hasText: team1.transpondeur }).getByRole('link').click()
    await expect(page).toHaveURL(new RegExp(`/equipe/${team1.equipe}$`))
  })
})
