var sync = require("./sync.js")

var HISTORY_KEY = "wargame_history"

function createRuntime(deps) {
  var config = deps || {}
  var interconnectApi = null
  var storageApi = null
  var connection = null
  var started = false
  var channelOpen = false
  var pendingMessageId = ""
  var handlerModes = {}

  function getInterconnect() {
    if (config.interconnect) {
      return config.interconnect
    }

    if (interconnectApi !== null) {
      return interconnectApi
    }

    try {
      interconnectApi = require("@system.interconnect")
    } catch (error) {
      interconnectApi = null
    }

    return interconnectApi
  }

  function getStorage() {
    if (config.storage) {
      return config.storage
    }

    if (storageApi !== null) {
      return storageApi
    }

    try {
      storageApi = require("@system.storage")
    } catch (error) {
      storageApi = null
    }

    return storageApi
  }

  function getConnection() {
    var interconnect = getInterconnect()

    if (connection) {
      return connection
    }

    try {
      if (interconnect && typeof interconnect.instance === "function") {
        connection = interconnect.instance()
      }
    } catch (error) {
      connection = null
    }

    return connection
  }

  function setHandler(name, handler) {
    var current = getConnection()

    if (!current) {
      return
    }

    try {
      if (typeof current[name] === "function") {
        handlerModes[name] = "function"
        current[name](handler)
        return
      }

      handlerModes[name] = "property"
      current[name] = handler
    } catch (error) {
      try {
        handlerModes[name] = "property"
        current[name] = handler
      } catch (ignored) {}
    }
  }

  function clearPropertyHandler(name) {
    var current = connection

    if (!current || handlerModes[name] === "function") {
      return
    }

    try {
      current[name] = null
    } catch (error) {}
  }

  function readHistory(done) {
    var storage = getStorage()

    try {
      if (!storage || !storage.get) {
        done([])
        return
      }

      storage.get({
        key: HISTORY_KEY,
        success: function (data) {
          done(parseHistory(data && data.value !== undefined ? data.value : data))
        },
        fail: function () {
          done([])
        }
      })
    } catch (error) {
      done([])
    }
  }

  function writeHistory(history) {
    var storage = getStorage()

    try {
      if (!storage || !storage.set) {
        return
      }

      storage.set({
        key: HISTORY_KEY,
        value: JSON.stringify(history)
      })
    } catch (error) {}
  }

  function parseHistory(value) {
    try {
      if (!value || typeof value !== "string") {
        return []
      }

      var history = JSON.parse(value)
      return Array.isArray(history) ? history : []
    } catch (error) {
      return []
    }
  }

  function extractMessageData(raw) {
    if (typeof raw === "string") {
      return raw
    }

    if (!raw) {
      return ""
    }

    if (typeof raw.data === "string") {
      return raw.data
    }

    if (typeof raw.message === "string") {
      return raw.message
    }

    return ""
  }

  function isNotReadyState(value) {
    var state

    if (value === false || value === 0 || value === 2 || value === 3) {
      return true
    }

    if (typeof value !== "string") {
      return false
    }

    state = value.toLowerCase()
    return (
      state === "closed" ||
      state === "closing" ||
      state === "connecting" ||
      state === "disconnected" ||
      state === "disconnecting" ||
      state === "not_ready" ||
      state === "not ready" ||
      state === "unready"
    )
  }

  function isChannelReady() {
    var current = getConnection()
    var readyState

    if (!channelOpen || !current) {
      return false
    }

    try {
      if (typeof current.getReadyState === "function") {
        readyState = current.getReadyState()
        if (isNotReadyState(readyState)) {
          return false
        }
      }
    } catch (error) {
      return false
    }

    return true
  }

  function sendPushMessage(message) {
    var current = getConnection()

    if (!isChannelReady() || !current || typeof current.send !== "function") {
      return
    }

    try {
      current.send(JSON.stringify(message))
      pendingMessageId = message.messageId
    } catch (error) {}
  }

  function requestSync() {
    if (!started) {
      return
    }

    readHistory(function (history) {
      var message = sync.createSyncPushMessage(history, {
        createdAt: config.now ? config.now() : Date.now()
      })

      if (!message.sessions || message.sessions.length === 0) {
        return
      }

      sendPushMessage(message)
    })
  }

  function handleOpen() {
    channelOpen = true
    requestSync()
  }

  function handleMessage(raw) {
    var ack = sync.parseSyncAck(extractMessageData(raw))

    if (!ack || !pendingMessageId || ack.ackMessageId !== pendingMessageId) {
      return
    }

    readHistory(function (history) {
      var nextHistory = sync.applySyncAck(history, ack.sessionIds)
      writeHistory(nextHistory)
      pendingMessageId = ""
    })
  }

  function handleClose() {
    channelOpen = false
  }

  function handleError() {
    channelOpen = false
  }

  function start() {
    if (started) {
      return
    }

    started = true
    getConnection()
    setHandler("onopen", handleOpen)
    setHandler("onmessage", handleMessage)
    setHandler("onclose", handleClose)
    setHandler("onerror", handleError)
    requestSync()
  }

  function stop() {
    started = false
    channelOpen = false
    clearPropertyHandler("onopen")
    clearPropertyHandler("onmessage")
    clearPropertyHandler("onclose")
    clearPropertyHandler("onerror")
    connection = null
  }

  return {
    start: start,
    stop: stop,
    requestSync: requestSync
  }
}

var defaultRuntime = createRuntime()

module.exports = {
  start: defaultRuntime.start,
  stop: defaultRuntime.stop,
  requestSync: defaultRuntime.requestSync,
  _createRuntime: createRuntime
}
