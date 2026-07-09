function createId(prefix) {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
}

function createSummary(events) {
  var summary = { kills: 0, deaths: 0 }

  events.forEach(function (event) {
    if (event.type === "kill") {
      summary.kills += 1
    }

    if (event.type === "death") {
      summary.deaths += 1
    }
  })

  return summary
}

function createSession(nowMs) {
  return {
    sessionId: createId("session"),
    startTime: nowMs,
    endTime: 0,
    status: "ongoing",
    summary: { kills: 0, deaths: 0 },
    events: []
  }
}

function addEvent(session, type, nowMs, actionSource = "manual") {
  if (type !== "kill" && type !== "death") {
    throw new Error("Unsupported event type: " + type)
  }

  var events = session.events.concat({
    eventId: createId("event"),
    type: type,
    time: Math.max(0, Math.floor((nowMs - session.startTime) / 1000)),
    meta: {
      actionSource: actionSource
    }
  })

  return Object.assign({}, session, {
    summary: createSummary(events),
    events: events
  })
}

function undoLast(session) {
  var events = session.events.slice(0, -1)

  return Object.assign({}, session, {
    summary: createSummary(events),
    events: events
  })
}

function decrement(session, type) {
  var removeIndex = -1

  for (var index = session.events.length - 1; index >= 0; index -= 1) {
    if (session.events[index].type === type) {
      removeIndex = index
      break
    }
  }

  if (removeIndex < 0) {
    return Object.assign({}, session, {
      summary: createSummary(session.events),
      events: session.events.slice()
    })
  }

  var events = session.events.slice(0, removeIndex).concat(session.events.slice(removeIndex + 1))

  return Object.assign({}, session, {
    summary: createSummary(events),
    events: events
  })
}

function finishSession(session, nowMs) {
  return Object.assign({}, session, {
    status: "finished",
    endTime: nowMs
  })
}

function padTime(value) {
  return value < 10 ? "0" + value : String(value)
}

function formatDuration(ms) {
  var totalSeconds = Math.max(0, Math.floor(ms / 1000))
  var seconds = totalSeconds % 60
  var totalMinutes = Math.floor(totalSeconds / 60)
  var minutes = totalMinutes % 60
  var hours = Math.floor(totalMinutes / 60)

  if (hours > 0) {
    return hours + ":" + padTime(minutes) + ":" + padTime(seconds)
  }

  return padTime(minutes) + ":" + padTime(seconds)
}

function getKdRatio(summary) {
  if (summary.deaths === 0) {
    return summary.kills.toFixed(2)
  }

  return (summary.kills / summary.deaths).toFixed(2)
}

function defaultSettings() {
  return {
    triggerMode: "longPress",
    killVibration: "short",
    deathVibration: "long",
    aodEnabled: false,
    visualMode: "simple"
  }
}

module.exports = {
  createSession: createSession,
  addEvent: addEvent,
  undoLast: undoLast,
  decrement: decrement,
  finishSession: finishSession,
  formatDuration: formatDuration,
  getKdRatio: getKdRatio,
  defaultSettings: defaultSettings
}
