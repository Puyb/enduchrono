const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourseInRace, cleanupCourse } = require('../helpers/course-lifecycle')
const { openEquipeFiche, infoRow, openCategorieModal, readThPreview, readTdPreview } = require('../helpers/equipe-fiche')

test.describe('Core E2E - Categorie', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-CORE-002 previsualise et applique un changement de categorie avec propagation liste/filtre', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_core_002')

    // team1 (A) et team2 (A): team2 devant. team3 (B) seule dans sa categorie.
    await bootCourseInRace(api, fixture, [
      { transpondeur: fixture.teams.team1.transpondeur, timestamp: 300000 },
      { transpondeur: fixture.teams.team2.transpondeur, timestamp: 200000 },
      { transpondeur: fixture.teams.team2.transpondeur, timestamp: 400000 },
      { transpondeur: fixture.teams.team3.transpondeur, timestamp: 100000 },
    ])

    await openEquipeFiche(page, fixture, fixture.teams.team1.equipe)

    await expect(infoRow(page, /^Categorie/).locator('td')).toContainText('A')
    await expect(infoRow(page, /^Classement categorie/).locator('td')).toHaveText('2')

    const modal = await openCategorieModal(page)
    await modal.locator('#input-categorie').selectOption(fixture.teams.team3.categorie)

    const categoriePreview = await readThPreview(modal, /^A/)
    expect(categoriePreview.current).toBe('A')
    expect(categoriePreview.next).toBe(fixture.teams.team3.categorie)

    const positionPreview = await readTdPreview(modal, /^Position catégorie/)
    expect(positionPreview.current).toBe('2')
    expect(positionPreview.next).toBe('2')

    await modal.getByRole('button', { name: 'OK' }).click()

    await expect(infoRow(page, /^Categorie/).locator('td')).toContainText(fixture.teams.team3.categorie)
    await expect(infoRow(page, /^Classement categorie/).locator('td')).toHaveText('2')

    await page.goto('/#/equipes')
    await page.getByRole('button', { name: /^B/ }).click()
    await expect(page.locator('#equipes-table tbody tr', { hasText: fixture.teams.team1.nom })).toBeVisible()
    await page.getByRole('button', { name: /^A/ }).click()
    await expect(page.locator('#equipes-table tbody tr', { hasText: fixture.teams.team1.nom })).toHaveCount(0)
    await expect(page.locator('#equipes-table tbody tr', { hasText: fixture.teams.team2.nom })).toBeVisible()
  })
})
