var sessionHelper = require("./session.js")
var settingConstants = require("./constants/settings.js")

function parseJson(value) {
  try {
    if (!value || typeof value !== "string") {
      return null
    }

    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

function createOptionPageModel(type, storageValue) {
  var settings = sessionHelper.normalizeSettings(parseJson(storageValue))
  var menu = settingConstants.getSettingMenu(type)
  var selected = settingConstants.getSelectedValue(type, settings)

  return {
    storageKey: settingConstants.SETTINGS_KEY,
    titleKey: menu.titleKey,
    options: settingConstants.createSettingMenuOptions(type, selected)
  }
}

function createOptionPageStorageValue(type, storageValue, value) {
  var settings = sessionHelper.normalizeSettings(parseJson(storageValue))
  var nextSettings = settingConstants.applySettingOption(type, settings, value)

  return JSON.stringify(sessionHelper.normalizeSettings(nextSettings))
}

function getOptionPageStorageKey(type) {
  return createOptionPageModel(type, "").storageKey
}

module.exports = {
  createOptionPageModel: createOptionPageModel,
  createOptionPageStorageValue: createOptionPageStorageValue,
  getOptionPageStorageKey: getOptionPageStorageKey
}
