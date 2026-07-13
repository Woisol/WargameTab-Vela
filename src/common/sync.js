var PROTOCOL_VERSION = 1
var PUSH_TYPE = "wargame.sessions.push"
var ACK_TYPE = "wargame.sessions.ack"

function isSyncableSession(session) {
  return (
    session &&
    typeof session.sessionId === "string" &&
    session.sessionId.length > 0 &&
    session.status === "finished" &&
    Array.isArray(session.events) &&
    session.summary
  )
}

function cloneSession(session) {
  return JSON.parse(JSON.stringify(session))
}

function createSyncExport(history, options) {
  var source = Array.isArray(history) ? history : []
  var config = options || {}
  var sessions = source
    .filter(isSyncableSession)
    .map(cloneSession)
    .sort(function (left, right) {
      return (right.startTime || 0) - (left.startTime || 0)
    })

  return {
    protocolVersion: PROTOCOL_VERSION,
    deviceId: typeof config.deviceId === "string" ? config.deviceId : "",
    appVersion: typeof config.appVersion === "string" ? config.appVersion : "",
    lastSyncAt: typeof config.lastSyncAt === "number" ? config.lastSyncAt : 0,
    sessions: sessions
  }
}

function createSyncPushMessage(history, options) {
  var config = options || {}
  var createdAt = typeof config.createdAt === "number" ? config.createdAt : Date.now()
  var exported = createSyncExport(history, config)

  return {
    type: PUSH_TYPE,
    protocolVersion: PROTOCOL_VERSION,
    messageId: typeof config.messageId === "string" ? config.messageId : "sync_" + createdAt,
    deviceId: exported.deviceId,
    createdAt: createdAt,
    sessions: exported.sessions
  }
}

function parseSyncAck(raw) {
  var payload

  try {
    payload = JSON.parse(raw)
  } catch (error) {
    return null
  }

  if (
    !payload ||
    payload.type !== ACK_TYPE ||
    payload.protocolVersion !== PROTOCOL_VERSION ||
    !Array.isArray(payload.sessionIds)
  ) {
    return null
  }

  var sessionIds = payload.sessionIds.filter(function (sessionId) {
    return typeof sessionId === "string" && sessionId.length > 0
  })

  if (sessionIds.length === 0) {
    return null
  }

  return {
    ackMessageId: typeof payload.ackMessageId === "string" ? payload.ackMessageId : "",
    sessionIds: sessionIds
  }
}

function applySyncAck(history, sessionIds) {
  var source = Array.isArray(history) ? history : []
  var acknowledged = {}

  if (Array.isArray(sessionIds)) {
    sessionIds.forEach(function (sessionId) {
      if (typeof sessionId === "string" && sessionId.length > 0) {
        acknowledged[sessionId] = true
      }
    })
  }

  return source.map(function (session) {
    if (!session || !acknowledged[session.sessionId] || session.status !== "finished") {
      return session
    }

    return Object.assign({}, session, {
      status: "synced"
    })
  })
}

module.exports = {
  PROTOCOL_VERSION: PROTOCOL_VERSION,
  PUSH_TYPE: PUSH_TYPE,
  ACK_TYPE: ACK_TYPE,
  createSyncExport: createSyncExport,
  createSyncPushMessage: createSyncPushMessage,
  parseSyncAck: parseSyncAck,
  applySyncAck: applySyncAck
}
