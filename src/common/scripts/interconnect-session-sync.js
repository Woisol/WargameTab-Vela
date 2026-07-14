var protocol = require("./session-sync-protocol.js")
var promptHelper = require("./prompt.js")

var HISTORY_KEY = "wargame_history"
var SETTINGS_KEY = "wargame_settings"

function createRuntime(deps) {
  var config = deps || {}
  var interconnectApi = null
  var storageApi = null
  var showToast = config.prompt ? promptHelper._createToast(config.prompt) : promptHelper.toast
  var connection = null
  var started = false
  var channelOpen = false
  var pendingMessageId = ""
  var _debug = false
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

  function setDebugEnabled(value) {
    _debug = value === true
  }

  function debugLog(message, toast) {
    var text = "[interconnect] " + message

    try {
      console.log(text)
    } catch (error) { }

    if (!_debug || toast !== true) {
      return
    }

    showToast(message, "interconnect")
  }

  function formatError(data, code) {
    var message = ""

    if (data && typeof data.data === "string") {
      message = data.data
    } else if (typeof data === "string") {
      message = data
    } else if (data && typeof data.message === "string") {
      message = data.message
    }

    if (code !== undefined && code !== null) {
      message += (message ? " " : "") + "code=" + code
    }

    return message ? ": " + message : ""
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
      debugLog("connection error", true)
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
      } catch (ignored) { }
    }
  }

  function clearPropertyHandler(name) {
    var current = connection

    if (!current || handlerModes[name] === "function") {
      return
    }

    try {
      current[name] = null
    } catch (error) { }
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
    } catch (error) { }
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

  function readDebugSetting(done) {
    var storage = getStorage()

    try {
      if (!storage || !storage.get) {
        done(_debug)
        return
      }

      storage.get({
        key: SETTINGS_KEY,
        success: function (data) {
          var value = data && data.value !== undefined ? data.value : data
          var settings

          try {
            settings = value && typeof value === "string" ? JSON.parse(value) : value
          } catch (error) {
            settings = null
          }

          setDebugEnabled(settings && settings.interconnectDebugEnabled)
          done(_debug)
        },
        fail: function () {
          done(_debug)
        }
      })
    } catch (error) {
      done(_debug)
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
    var done = arguments[0]
    var current = getConnection()
    var readyState

    if (!current) {
      done(false)
      return
    }

    if (typeof current.getReadyState !== "function") {
      done(channelOpen)
      return
    }

    var completed = false
    var complete = function (value) {
      if (completed) {
        return
      }

      completed = true
      channelOpen = value
      done(value)
    }

    try {
      var result = current.getReadyState({
        success: function (data) {
          readyState = data && data.status !== undefined ? data.status : data
          complete(!isNotReadyState(readyState))
        },
        fail: function (data, code) {
          debugLog("ready state error" + formatError(data, code), true)
          complete(false)
        }
      })

      if (result && typeof result.then === "function") {
        result.then(function (data) {
          readyState = data && data.status !== undefined ? data.status : data
          complete(!isNotReadyState(readyState))
        }).catch(function (error) {
          debugLog("ready state error: " + String(error), true)
          complete(false)
        })
      } else if (result !== undefined) {
        complete(!isNotReadyState(result))
      }
    } catch (error) {
      debugLog("ready state error: " + String(error), true)
      complete(false)
    }
  }

  function sendPushMessage(message) {
    var current = getConnection()

    if (!current || typeof current.send !== "function") {
      debugLog("send skipped: send API unavailable", true)
      return
    }

    isChannelReady(function (ready) {
      if (!ready) {
        debugLog("send skipped: channel not ready", true)
        return
      }

      var messageId = message.messageId
      var completed = false
      var succeed = function () {
        if (completed) {
          return
        }

        completed = true
        debugLog("sent " + messageId + " sessions=" + message.sessions.length, true)
      }
      var fail = function (data, code) {
        if (completed) {
          return
        }

        completed = true
        if (pendingMessageId === messageId) {
          pendingMessageId = ""
        }
        debugLog("send error" + formatError(data, code), true)
      }

      pendingMessageId = messageId
      try {
        var result = current.send({
          data: message,
          success: succeed,
          fail: fail
        })

        if (result && typeof result.then === "function") {
          result.then(succeed).catch(function (error) {
            fail(error, "promise")
          })
        }
      } catch (error) {
        fail(error, "throw")
      }
    })
  }

  function requestSync() {
    if (!started) {
      debugLog("runtime was not started; starting for sync request", true)
      start()
      return
    }

    readDebugSetting(function () {
      debugLog("request sync", true)
      readHistory(function (history) {
        var message = protocol.createSyncPushMessage(history, {
          createdAt: config.now ? config.now() : Date.now()
        })

        debugLog("history=" + history.length + " finished=" + message.sessions.length)

        if (!message.sessions || message.sessions.length === 0) {
          return
        }

        sendPushMessage(message)
      })
    })
  }

  function handleOpen() {
    channelOpen = true
    debugLog("channel open", true)
    requestSync()
  }

  function handleMessage(raw) {
    debugLog("message received", true)
    var ack = protocol.parseSyncAck(extractMessageData(raw))

    if (!ack || !pendingMessageId || ack.ackMessageId !== pendingMessageId) {
      debugLog("message ignored: invalid or unmatched ack", true)
      return
    }

    readHistory(function (history) {
      var nextHistory = protocol.applySyncAck(history, ack.sessionIds)
      writeHistory(nextHistory)
      pendingMessageId = ""
      debugLog("ack applied sessions=" + ack.sessionIds.length, true)
    })
  }

  function handleClose() {
    channelOpen = false
    debugLog("channel closed", true)
  }

  function handleError(error) {
    channelOpen = false
    debugLog("channel error" + (error ? ": " + String(error) : ""), true)
  }

  function start() {
    if (started) {
      return
    }

    started = true
    debugLog("runtime start", true)
    getConnection()
    setHandler("onOpen", handleOpen)
    setHandler("onopen", handleOpen)
    setHandler("onmessage", handleMessage)
    setHandler("onclose", handleClose)
    setHandler("onerror", handleError)
    requestSync()
  }

  function stop() {
    started = false
    channelOpen = false
    clearPropertyHandler("onOpen")
    clearPropertyHandler("onopen")
    clearPropertyHandler("onmessage")
    clearPropertyHandler("onclose")
    clearPropertyHandler("onerror")
    connection = null
  }

  return {
    start: start,
    stop: stop,
    requestSync: requestSync,
    setDebugEnabled: setDebugEnabled
  }
}

var defaultRuntime = createRuntime()

module.exports = {
  start: defaultRuntime.start,
  stop: defaultRuntime.stop,
  requestSync: defaultRuntime.requestSync,
  setDebugEnabled: defaultRuntime.setDebugEnabled,
  _createRuntime: createRuntime
}
