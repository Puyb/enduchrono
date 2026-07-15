async function cleanupCourse(api) {
  try {
    await api.closeCourse()
  } catch (_) {}
}

async function bootCourse(api, fixture) {
  await cleanupCourse(api)
  await api.importCourseFromFixture(fixture)
}

async function bootCourseInRace(api, fixture, tours = []) {
  await bootCourse(api, fixture)
  await api.stopTest()
  await api.startCourse()
  for (const { transpondeur, timestamp } of tours) {
    await api.addTour({ transpondeur, timestamp })
  }
}

module.exports = {
  bootCourse,
  bootCourseInRace,
  cleanupCourse,
}
