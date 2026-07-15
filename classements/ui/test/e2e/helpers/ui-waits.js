const { expect } = require('@playwright/test')

async function waitForCourseCreationForm(page) {
  await expect(page.getByRole('heading', { name: 'Nouvelle course' })).toBeVisible()
}

async function waitForCourseLoaded(page, courseName) {
  await expect(page.locator('.navbar-brand')).toHaveText(courseName)
}

async function waitForStatusText(page, expectedText) {
  const status = page.locator('#status .navbar-text').first()
  if (expectedText instanceof RegExp) {
    await expect(status).toHaveText(expectedText)
    return
  }
  await expect(status).toContainText(expectedText)
}

async function waitForBadgeCount(container, expectedCount) {
  const badge = container.locator('.badge').first()
  await expect.poll(async () => {
    const text = await badge.textContent()
    return Number.parseInt((text || '').trim(), 10)
  }).toBe(expectedCount)
}

async function waitForTopTeamName(page, expectedName) {
  const firstNameCell = page.locator('#equipes-table tbody tr').first().locator('td').nth(1)
  await expect(firstNameCell).toContainText(expectedName)
}

module.exports = {
  waitForCourseCreationForm,
  waitForCourseLoaded,
  waitForStatusText,
  waitForBadgeCount,
  waitForTopTeamName,
}
