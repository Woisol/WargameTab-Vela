var COLORS = {
  pageBackground: "#000000",
  surface: "#555555",
  surfaceSelected: "#777777",
  surfaceStrong: "#333333",
  surfaceMuted: "#999999",
  textPrimary: "#ffffff",
  textInverse: "#111111",
  textSecondary: "#d8d8d8",
  textMuted: "#8a8a8a",
  kill: "#ff1744",
  death: "#2979ff",
  success: "#67df79",
  cardLight: "#f5f5f5",
  borderLight: "#dbdbdb",
  axis: "#d9d9d9",
  dangerSoft: "#ff6b6b",
  overlay: "rgba(0, 0, 0, 0.68)",
  panelOverlay: "rgba(34, 34, 34, 0.75)"
}

var PAGE_PADDING = {
  square: 10,
  circle: 48,
  topBar: 70
}

var RADIUS = {
  none: 0,
  control: 10,
  item: 18,
  pill: 21,
  button: 23,
  dialog: 28,
  card: 30,
  round: 999
}

var SIZE = {
  settingsItemHeight: 84,
  settingsSwitchWidth: 76,
  settingsSwitchHeight: 42,
  topBarHeight: 60
}

var STYLES = {
  page: "background-color: " + COLORS.pageBackground + ";",
  topBarPadding: "padding-left: " + PAGE_PADDING.topBar + "px; padding-right: " + PAGE_PADDING.topBar + "px;",
  statusPill:
    "border-radius: 15px; background-color: rgba(255, 255, 255, 0.14); color: " +
    COLORS.textSecondary +
    ";",
  settingsItem:
    "border-radius: " + RADIUS.item + "px; background-color: " + COLORS.surface + ";",
  switchOff:
    "border-radius: " + RADIUS.pill + "px; background-color: " + COLORS.surfaceMuted + ";",
  switchOn: "border-radius: " + RADIUS.pill + "px; background-color: " + COLORS.success + ";",
  switchThumb: "border-radius: 17px; background-color: " + COLORS.textPrimary + ";",
  menuOption:
    "border-radius: " + RADIUS.item + "px; background-color: " + COLORS.surface + ";",
  menuSelected: "background-color: " + COLORS.surfaceSelected + ";"
}

module.exports = {
  COLORS: COLORS,
  PAGE_PADDING: PAGE_PADDING,
  RADIUS: RADIUS,
  SIZE: SIZE,
  STYLES: STYLES
}
