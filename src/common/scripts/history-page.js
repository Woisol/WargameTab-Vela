function pad(value) {
  return value < 10 ? "0" + value : String(value)
}

function formatDate(value) {
  var date = new Date(typeof value === "number" && value > 0 ? value : Date.now())

  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
}

function getRatioText(kills, deaths) {
  return deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2)
}

function createHistoryItems(history, deleteReadySessionId) {
  if (!Array.isArray(history)) {
    return []
  }

  return history.map(function (session) {
    var summary = session && session.summary ? session.summary : {}
    var kills = typeof summary.kills === "number" ? summary.kills : 0
    var deaths = typeof summary.deaths === "number" ? summary.deaths : 0
    var sessionId = session && session.sessionId ? session.sessionId : ""
    var deleteVisible = sessionId === deleteReadySessionId

    return {
      sessionId: sessionId,
      dateText: formatDate(session && session.startTime),
      statusKey: session && session.status === "synced" ? "history.synced" : "history.unsynced",
      kills: kills,
      deaths: deaths,
      ratioText: getRatioText(kills, deaths),
      itemClass: deleteVisible ? "history-item history-item-open" : "history-item",
      itemContentClass: deleteVisible ? "item-content item-content-open" : "item-content",
      deleteActionClass: deleteVisible ? "delete-action delete-action-visible" : "delete-action",
      deleteVisible: deleteVisible
    }
  })
}

module.exports = {
  createHistoryItems: createHistoryItems,
  formatDate: formatDate,
  getRatioText: getRatioText,
  pad: pad
}
