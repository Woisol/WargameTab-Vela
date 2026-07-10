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

function createDisplaySummary(session, nowMs) {
  if (!session || session.status !== "ongoing") {
    return {
      kills: 0,
      deaths: 0,
      ratioText: "0.00",
      durationText: "00:00",
      aodSummaryText: "K 0 / D 0",
      running: false
    }
  }

  var summary = session.summary || { kills: 0, deaths: 0 }
  var kills = typeof summary.kills === "number" ? summary.kills : 0
  var deaths = typeof summary.deaths === "number" ? summary.deaths : 0

  return {
    kills: kills,
    deaths: deaths,
    ratioText: getKdRatio({ kills: kills, deaths: deaths }),
    durationText: formatDuration(nowMs - session.startTime),
    aodSummaryText: "K " + kills + " / D " + deaths,
    running: true
  }
}

function formatEventTime(value) {
  var totalSeconds = Math.max(0, Math.floor(value))

  return Math.floor(totalSeconds / 60) + ":" + padTime(totalSeconds % 60)
}

var REVIEW_TIMELINE_TRACK_WIDTH = 350
var REVIEW_TIMELINE_MARKER_WIDTH = 5
var REVIEW_TIMELINE_AXIS_LABEL_WIDTH = 86

function createReviewTimelineItems(events, totalSeconds) {
  var duration = Math.max(1, Math.floor(totalSeconds || 0))

  if (!Array.isArray(events)) {
    return []
  }

  return events.map(function (event) {
    var isKill = event && event.type === "kill"
    var eventSecond = event && typeof event.time === "number" ? Math.max(0, Math.floor(event.time)) : 0
    var displaySecond = Math.min(duration, eventSecond)
    var offsetPercent = Math.min(100, Math.round((displaySecond / duration) * 100))

    return {
      markerClass: isKill ? "timeline-marker kill-marker" : "timeline-marker death-marker",
      eventDotClass: isKill ? "event-dot kill-marker" : "event-dot death-marker",
      offsetPercent: offsetPercent,
      markerStyle: createTimelineMarkerStyle(displaySecond, duration),
      timeText: formatEventTime(displaySecond),
      typeText: isKill ? "K" : "D"
    }
  })
}

function createTimelineMarkerStyle(value, duration) {
  var maxLeft = REVIEW_TIMELINE_TRACK_WIDTH - REVIEW_TIMELINE_MARKER_WIDTH
  var left = Math.round((Math.max(0, value) / Math.max(1, duration)) * maxLeft)

  return "left: " + Math.min(maxLeft, Math.max(0, left)) + "px;"
}

function createReviewTimelineAxis(totalSeconds) {
  var duration = Math.max(1, Math.floor(totalSeconds || 0))
  var stepOptions = [60, 120, 300, 600, 900, 1800, 3600]
  var step = duration
  var axisItems = []
  var tick = 0

  if (duration < 60) {
    return [
      { label: "0:00", style: "left: 0px;" },
      { label: formatEventTime(duration), style: createTimelinePositionStyle(duration, duration) }
    ]
  }

  for (var index = 0; index < stepOptions.length; index += 1) {
    if (Math.floor(duration / stepOptions[index]) <= 4) {
      step = stepOptions[index]
      break
    }
  }

  for (tick = 0; tick <= duration; tick += step) {
    axisItems.push({
      label: formatEventTime(tick),
      style: createTimelinePositionStyle(tick, duration)
    })
  }

  return axisItems
}

function createTimelinePositionStyle(value, duration) {
  var maxLeft = REVIEW_TIMELINE_TRACK_WIDTH - REVIEW_TIMELINE_AXIS_LABEL_WIDTH
  var center = Math.round((Math.max(0, value) / Math.max(1, duration)) * REVIEW_TIMELINE_TRACK_WIDTH)
  var left = center - Math.floor(REVIEW_TIMELINE_AXIS_LABEL_WIDTH / 2)

  return "left: " + Math.min(maxLeft, Math.max(0, left)) + "px;"
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

function normalizeSettings(value) {
  var defaults = defaultSettings()
  var saved = value || {}
  var settings = Object.assign({}, defaults, saved)

  if (["longPress", "click"].indexOf(settings.triggerMode) < 0) {
    settings.triggerMode = defaults.triggerMode
  }

  if (["short", "double", "long", "off"].indexOf(settings.killVibration) < 0) {
    settings.killVibration = defaults.killVibration
  }

  if (["short", "double", "long", "off"].indexOf(settings.deathVibration) < 0) {
    settings.deathVibration = defaults.deathVibration
  }

  if (typeof settings.aodEnabled !== "boolean") {
    settings.aodEnabled = defaults.aodEnabled
  }

  if (["simple", "detailed"].indexOf(settings.visualMode) < 0) {
    settings.visualMode = defaults.visualMode
  }

  return settings
}

module.exports = {
  createSession: createSession,
  addEvent: addEvent,
  undoLast: undoLast,
  decrement: decrement,
  finishSession: finishSession,
  formatDuration: formatDuration,
  formatEventTime: formatEventTime,
  getKdRatio: getKdRatio,
  createDisplaySummary: createDisplaySummary,
  createReviewTimelineItems: createReviewTimelineItems,
  createReviewTimelineAxis: createReviewTimelineAxis,
  defaultSettings: defaultSettings,
  normalizeSettings: normalizeSettings
}
