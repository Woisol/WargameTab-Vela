var designConstants = require("./constants/design.js")

var PAGE_PADDING = designConstants.PAGE_PADDING

function pagePaddingStyle(shape) {
  var value = shape === "circle" ? PAGE_PADDING.circle : PAGE_PADDING.square

  return "padding-left: " + value + "px; padding-right: " + value + "px;"
}

module.exports = {
  PAGE_PADDING: PAGE_PADDING,
  STYLES: designConstants.STYLES,
  pagePaddingStyle: pagePaddingStyle
}
