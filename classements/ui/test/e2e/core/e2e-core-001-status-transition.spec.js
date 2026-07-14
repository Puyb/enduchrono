const { test, expect } = require('@playwright/test')
const { createCourseFixture } = require('../../fixtures/course-fixtures')
const { createClassementsApi } = require('../helpers/classements-api')
const { bootCourse, cleanupCourse } = require('../helpers/course-lifecycle')
const { waitForCourseLoaded, waitForStatusText } = require('../helpers/ui-waits')

test.describe('Core E2E', () => {
  test.beforeEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await api.waitForApiReady()
    await cleanupCourse(api)
  })

  test.afterEach(async ({ request }) => {
    const api = createClassementsApi(request)
    await cleanupCourse(api)
  })

  test('E2E-CORE-001 synchronise les transitions TEST -> DEPART -> COURSE', async ({ page, request }) => {
    const api = createClassementsApi(request)
    const fixture = createCourseFixture('e2e_core_001')

    await bootCourse(api, fixture)

    await page.goto('/')
    await waitForCourseLoaded(page, fixture.courseName)
    await waitForStatusText(page, 'Test avant course')

    await api.stopTest()
    await waitForStatusText(page, /Attente/i)

    await api.startCourse()
    await waitForStatusText(page, /0 tour/i)

    await expect(page.locator('#status button')).toContainText('Stop')
  })
})
