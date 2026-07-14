async function cleanupCourse(api) {
  try {
    await api.closeCourse()
  } catch (_) {}
}

async function bootCourse(api, fixture) {
  await cleanupCourse(api)
  await api.importCourseFromFixture(fixture)
}

module.exports = {
  bootCourse,
  cleanupCourse,
}
