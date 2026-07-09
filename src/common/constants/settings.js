var designConstants = require("./design.js")

var SETTINGS_KEY = "wargame_settings"

var TRIGGER_OPTIONS = [
  { labelKey: "settings.options.longPress", value: "longPress" },
  { labelKey: "settings.options.click", value: "click" }
]

var VIBRATION_OPTIONS = [
  { labelKey: "settings.options.shortVibration", value: "short" },
  { labelKey: "settings.options.doubleVibration", value: "double" },
  { labelKey: "settings.options.longVibration", value: "long" },
  { labelKey: "settings.options.off", value: "off" }
]

var SETTING_MENUS = {
  trigger: {
    titleKey: "settings.items.trigger.title",
    settingKey: "triggerMode",
    options: TRIGGER_OPTIONS
  },
  killVibration: {
    titleKey: "settings.items.killVibration.title",
    settingKey: "killVibration",
    options: VIBRATION_OPTIONS
  },
  deathVibration: {
    titleKey: "settings.items.deathVibration.title",
    settingKey: "deathVibration",
    options: VIBRATION_OPTIONS
  }
}

function getSettingMenu(type) {
  return SETTING_MENUS[type] || SETTING_MENUS.trigger
}

function createSettingMenuOptions(type, selected) {
  return getSettingMenu(type).options.map(function (option) {
    return {
      labelKey: option.labelKey,
      value: option.value,
      optionClass: option.value === selected ? "menu-option selected-option" : "menu-option",
      optionStyle:
        designConstants.STYLES.menuOption +
        (option.value === selected ? designConstants.STYLES.menuSelected : "")
    }
  })
}

function getOptionLabelKey(type, value) {
  var options = getSettingMenu(type).options

  for (var index = 0; index < options.length; index += 1) {
    if (options[index].value === value) {
      return options[index].labelKey
    }
  }

  return options[0].labelKey
}

function getSelectedValue(type, settings) {
  var menu = getSettingMenu(type)
  var value = settings ? settings[menu.settingKey] : ""

  return value || menu.options[0].value
}

function applySettingOption(type, settings, value) {
  var menu = getSettingMenu(type)
  var nextSettings = Object.assign({}, settings || {})

  nextSettings[menu.settingKey] = value

  return nextSettings
}

module.exports = {
  SETTINGS_KEY: SETTINGS_KEY,
  SETTING_MENUS: SETTING_MENUS,
  getSettingMenu: getSettingMenu,
  createSettingMenuOptions: createSettingMenuOptions,
  getOptionLabelKey: getOptionLabelKey,
  getSelectedValue: getSelectedValue,
  applySettingOption: applySettingOption
}
