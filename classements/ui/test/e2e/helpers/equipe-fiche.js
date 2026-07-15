const { expect } = require('@playwright/test')

function infoTable(page) {
  return page.locator('table').nth(0)
}

function equipiersTable(page) {
  return page.locator('table').nth(1)
}

function infoRow(page, labelPattern) {
  return infoTable(page).locator('tbody tr, tr', { hasText: labelPattern })
}

function equipierRow(page, dossard) {
  return equipiersTable(page).locator('tbody tr', { hasText: new RegExp(`^${dossard}`) })
}

async function openEquipeFiche(page, fixture, numero) {
  await page.goto(`/#/equipe/${numero}`)
  await expect(page.locator('.navbar-brand')).toHaveText(fixture.courseName)
  await expect(infoRow(page, /^Equipe/).locator('td')).toHaveText(String(numero))
}

async function openPenaliteModal(page) {
  await infoRow(page, /^Tours/).locator('button').click()
  return page.locator('#modal-penalite')
}

async function openCategorieModal(page) {
  await infoRow(page, /^Categorie/).locator('button').click()
  return page.locator('#modal-categorie')
}

async function openEquipierTourModal(page, dossard) {
  await equipierRow(page, dossard).locator('td').nth(4).locator('button').click()
  return page.locator(`#modal-equipier-tour-${dossard}`)
}

async function openEquipierTranspondeursModal(page, dossard) {
  await equipierRow(page, dossard).locator('td').nth(7).locator('button').click()
  return page.locator(`#modal-equipier-transpondeur-${dossard}`)
}

function previewTdRow(modal, labelPattern) {
  return modal.locator('table tr', { hasText: labelPattern })
}

async function readTdPreview(modal, labelPattern) {
  const row = previewTdRow(modal, labelPattern)
  const cells = row.locator('td')
  return {
    current: (await cells.nth(0).innerText()).trim(),
    next: (await cells.nth(2).innerText()).trim(),
  }
}

async function readThPreview(modal, labelPattern) {
  const row = previewTdRow(modal, labelPattern)
  const cells = row.locator('th')
  return {
    current: (await cells.nth(1).innerText()).trim(),
    next: (await cells.nth(3).innerText()).trim(),
  }
}

module.exports = {
  infoRow,
  equipierRow,
  openEquipeFiche,
  openPenaliteModal,
  openCategorieModal,
  openEquipierTourModal,
  openEquipierTranspondeursModal,
  previewTdRow,
  readTdPreview,
  readThPreview,
}
