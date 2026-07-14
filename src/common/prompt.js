var promptApi = null

function getPrompt(customPrompt) {
  if (customPrompt) {
    return customPrompt
  }

  if (promptApi !== null) {
    return promptApi
  }

  try {
    promptApi = require("@system.prompt")
  } catch (error) {
    promptApi = null
  }

  return promptApi
}

function formatMessage(message, field) {
  var text = message === undefined || message === null ? "" : String(message)

  if (field === undefined || field === null || String(field).length === 0) {
    return text
  }

  return "[" + String(field) + "] " + text
}

function createToast(customPrompt) {
  return function (message, field) {
    var prompt = getPrompt(customPrompt)

    if (!prompt || typeof prompt.showToast !== "function") {
      return
    }

    try {
      prompt.showToast({
        message: formatMessage(message, field)
      })
    } catch (error) { }
  }
}

module.exports = {
  toast: createToast(),
  // 导出 _createToast 只是为了 customPrompt 实现自定 showToast 逻辑，主要是给测试用，实际使用用 toast 即可
  _createToast: createToast
}
