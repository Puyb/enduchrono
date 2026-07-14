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

module.exports = {
  waitForCourseCreationForm,
  waitForCourseLoaded,
  waitForStatusText,
}
