var PAGE_PADDING = {
  square: 10,
  circle: 48
}

function pagePaddingStyle(shape) {
  var value = shape === "circle" ? PAGE_PADDING.circle : PAGE_PADDING.square

  return "padding-left: " + value + "px; padding-right: " + value + "px;"
}

module.exports = {
  PAGE_PADDING: PAGE_PADDING,
  pagePaddingStyle: pagePaddingStyle
}
