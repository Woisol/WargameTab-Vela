var sessionHelper = require("./session.js")

function pad(value) {
  return value < 10 ? "0" + value : String(value)
}

function formatDate(value) {
  var date = new Date(typeof value === "number" && value > 0 ? value : Date.now())

  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
}

function formatClock(value) {
  var date = new Date(typeof value === "number" && value > 0 ? value : Date.now())

  return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds())
}

function isValidSession(session) {
  return (
    session &&
    typeof session.sessionId === "string" &&
    session.summary &&
    typeof session.summary.kills === "number" &&
    typeof session.summary.deaths === "number" &&
    Array.isArray(session.events)
  )
}

function createReviewModel(session) {
  if (!isValidSession(session)) {
    return {
      hasSession: false
    }
  }

  var summary = session.summary || {}
  var kills = typeof summary.kills === "number" ? summary.kills : 0
  var deaths = typeof summary.deaths === "number" ? summary.deaths : 0
  var startTime = typeof session.startTime === "number" ? session.startTime : 0
  var endTime = typeof session.endTime === "number" && session.endTime > 0 ? session.endTime : startTime
  var totalSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000))
  var events = Array.isArray(session.events) ? session.events : []
  var timelineItems = sessionHelper.createReviewTimelineItems(events, totalSeconds)

  return {
    hasSession: true,
    titleDateText: formatDate(startTime) + " ",
    ratioText: sessionHelper.getKdRatio({ kills: kills, deaths: deaths }),
    syncKey: session.status === "synced" ? "review.synced" : "review.unsyncedRetry",
    killCount: kills,
    deathCount: deaths,
    rangeText: formatClock(startTime) + " - " + formatClock(endTime),
    durationMinutes: Math.floor(totalSeconds / 60),
    durationSeconds: totalSeconds % 60,
    timelineItems: timelineItems,
    timelineAxisItems: sessionHelper.createReviewTimelineAxis(totalSeconds),
    timelineListItems: timelineItems
  }
}

module.exports = {
  createReviewModel: createReviewModel,
  formatClock: formatClock,
  formatDate: formatDate,
  isValidSession: isValidSession,
  pad: pad
}
