const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourseInRace, cleanupCourse } = require('../helpers/course-lifecycle')
const { waitForBadgeCount } = require('../helpers/ui-waits')
const { openEquipeFiche, infoRow, openEquipierTourModal, readThPreview, readTdPreview } = require('../helpers/equipe-fiche')

test.describe('Core E2E - Ajout tour manuel', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-CORE-003 previsualise puis valide un tour manuel insere entre deux passages existants', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_core_003')
    const team1 = fixture.teams.team1
    const team2 = fixture.teams.team2

    // team1 (A) a 2 tours mais un dernier passage plus tardif que team2 (A) qui a aussi 2 tours: team2 est devant.
    // (les tours d'une meme equipe doivent etre espaces de plus de 2 minutes pour ne pas etre detectes comme doublon)
    await bootCourseInRace(api, fixture, [
      { transpondeur: team1.transpondeur, timestamp: 50000 },
      { transpondeur: team1.transpondeur, timestamp: 900000 },
      { transpondeur: team2.transpondeur, timestamp: 100000 },
      { transpondeur: team2.transpondeur, timestamp: 300000 },
    ])

    await openEquipeFiche(page, fixture, team1.equipe)

    await expect(infoRow(page, /^Classement général/).locator('td')).toHaveText('2')
    await expect(infoRow(page, /^Classement categorie/).locator('td')).toHaveText('2')

    const modal = await openEquipierTourModal(page, team1.dossard)
    await expect(modal).toContainText(String(team1.dossard))
    // 10 minutes = 600000ms, entre les tours existants a 50000ms et 900000ms.
    await modal.locator('input[type="time"]').fill('00:10:00.000')

    const toursPreview = await readThPreview(modal, /^Tours/)
    expect(toursPreview.current).toBe('2')
    expect(toursPreview.next).toBe('3')

    const generalPreview = await readTdPreview(modal, /^Position général/)
    expect(generalPreview.current).toBe('2')
    expect(generalPreview.next).toBe('1')

    const categoriePreview = await readTdPreview(modal, /^Position catégorie/)
    expect(categoriePreview.current).toBe('2')
    expect(categoriePreview.next).toBe('1')

    // Le tour existant a 900000ms voit sa duree recalculee (impact des durees, "newDuree").
    const impactedRow = modal.locator('#tours-table tbody tr').nth(2)
    await expect(impactedRow).toContainText('14:10.000')
    await expect(impactedRow).toContainText('5:00.000')

    await modal.getByRole('button', { name: 'OK' }).click()

    await expect(infoRow(page, /^Classement général/).locator('td')).toHaveText('1')
    await expect(infoRow(page, /^Classement categorie/).locator('td')).toHaveText('1')

    await page.goto('/#/tours')
    await waitForBadgeCount(page.getByRole('button', { name: /Normaux/i }), 5)
    await expect(page.locator('#tours-table tbody tr', { hasText: 'Manuel' })).toBeVisible()
  })
})
