const assert = require("assert")

const session = require("../src/common/session.js")

function runTest(name, fn) {
  try {
    fn()
    console.log("PASS " + name)
  } catch (error) {
    process.exitCode = 1
    console.error("FAIL " + name)
    console.error(error && error.stack ? error.stack : error)
  }
}

runTest("createSession creates an ongoing session with zero summary", () => {
  const result = session.createSession(1752057600000)

  assert.equal(result.status, "ongoing")
  assert.equal(typeof result.sessionId, "string")
  assert.ok(result.sessionId.length > 0)
  assert.equal(result.startTime, 1752057600000)
  assert.equal(result.endTime, 0)
  assert.deepEqual(result.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(result.events, [])
})

runTest("addEvent records kill and death events with ids and relative seconds", () => {
  const started = session.createSession(100000)
  const afterKill = session.addEvent(started, "kill", 105200, "manual")
  const afterDeath = session.addEvent(afterKill, "death", 112000, "manual")

  assert.deepEqual(afterDeath.summary, { kills: 1, deaths: 1 })
  assert.equal(typeof afterDeath.events[0].eventId, "string")
  assert.ok(afterDeath.events[0].eventId.length > 0)
  assert.equal(typeof afterDeath.events[1].eventId, "string")
  assert.ok(afterDeath.events[1].eventId.length > 0)
  assert.deepEqual(
    afterDeath.events.map((event) => ({
      type: event.type,
      time: event.time,
      actionSource: event.meta.actionSource
    })),
    [
      { type: "kill", time: 5, actionSource: "manual" },
      { type: "death", time: 12, actionSource: "manual" }
    ]
  )
})

runTest("addEvent defaults actionSource only when omitted", () => {
  const started = session.createSession(100000)
  const omitted = session.addEvent(started, "kill", 101000)
  const emptySource = session.addEvent(started, "death", 102000, "")

  assert.equal(omitted.events[0].meta.actionSource, "manual")
  assert.equal(emptySource.events[0].meta.actionSource, "")
})

runTest("undoLast removes the latest event and updates the summary", () => {
  const started = session.createSession(100000)
  const withEvents = session.addEvent(
    session.addEvent(started, "kill", 101000, "manual"),
    "death",
    102000,
    "manual"
  )

  const result = session.undoLast(withEvents)

  assert.deepEqual(result.summary, { kills: 1, deaths: 0 })
  assert.equal(result.events.length, 1)
  assert.equal(result.events[0].type, "kill")
})

runTest("undoLast keeps an empty session safe", () => {
  const started = session.createSession(100000)
  const result = session.undoLast(started)

  assert.deepEqual(result.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(result.events, [])
})

runTest("decrement removes the latest matching event and never goes below zero", () => {
  const started = session.createSession(100000)
  const withEvents = session.addEvent(
    session.addEvent(started, "kill", 101000, "manual"),
    "kill",
    102000,
    "manual"
  )

  const oneKill = session.decrement(withEvents, "kill")
  const zeroKill = session.decrement(oneKill, "kill")
  const stillZero = session.decrement(zeroKill, "kill")

  assert.deepEqual(oneKill.summary, { kills: 1, deaths: 0 })
  assert.deepEqual(zeroKill.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(stillZero.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(stillZero.events, [])
})

runTest("decrement removes the latest matching event from mixed events", () => {
  const started = session.createSession(100000)
  const withEvents = session.addEvent(
    session.addEvent(
      session.addEvent(started, "kill", 101000, "manual"),
      "death",
      102000,
      "manual"
    ),
    "kill",
    103000,
    "manual"
  )

  const result = session.decrement(withEvents, "kill")

  assert.deepEqual(result.summary, { kills: 1, deaths: 1 })
  assert.deepEqual(
    result.events.map((event) => event.type),
    ["kill", "death"]
  )
})

runTest("addEvent, undoLast, and decrement do not mutate input session counts", () => {
  const started = session.createSession(100000)
  const withKill = session.addEvent(started, "kill", 101000, "manual")
  const withEvents = session.addEvent(
    session.addEvent(withKill, "death", 102000, "manual"),
    "kill",
    103000,
    "manual"
  )

  session.addEvent(started, "death", 104000, "manual")
  assert.deepEqual(started.summary, { kills: 0, deaths: 0 })
  assert.equal(started.events.length, 0)

  session.undoLast(withEvents)
  assert.deepEqual(withEvents.summary, { kills: 2, deaths: 1 })
  assert.equal(withEvents.events.length, 3)

  session.decrement(withEvents, "kill")
  assert.deepEqual(withEvents.summary, { kills: 2, deaths: 1 })
  assert.equal(withEvents.events.length, 3)
})

runTest("finishSession stores end time and finished status", () => {
  const started = session.createSession(100000)
  const result = session.finishSession(started, 170000)

  assert.equal(result.status, "finished")
  assert.equal(result.endTime, 170000)
})

runTest("formatDuration and getKdRatio return display values", () => {
  assert.equal(session.formatDuration(0), "00:00")
  assert.equal(session.formatDuration(61000), "01:01")
  assert.equal(session.formatDuration(3723000), "1:02:03")
  assert.equal(session.getKdRatio({ kills: 13, deaths: 7 }), "1.86")
  assert.equal(session.getKdRatio({ kills: 3, deaths: 0 }), "3.00")
})

runTest("defaultSettings provides battle interaction defaults", () => {
  assert.deepEqual(session.defaultSettings(), {
    triggerMode: "longPress",
    killVibration: "short",
    deathVibration: "long",
    aodEnabled: false,
    visualMode: "simple"
  })
})
