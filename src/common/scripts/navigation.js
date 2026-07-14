function getTouchPoint(event) {
  var touches = event && (event.touches || event.changedTouches)
  var point = touches && touches.length ? touches[0] : event

  return {
    x: point && typeof point.clientX === "number" ? point.clientX : 0,
    y: point && typeof point.clientY === "number" ? point.clientY : 0
  }
}

// TODO 用 Left / Right 更通用……
function isBackSwipe(startX, endX, startY, endY) {
  var deltaX = endX - startX
  var deltaY = Math.abs(endY - startY)

  return deltaX >= 72 && deltaY <= 48
}

function isDeleteSwipe(startX, endX, startY, endY) {
  var deltaX = startX - endX
  var deltaY = Math.abs(endY - startY)

  return deltaX >= 72 && deltaY <= 48
}

function isVerticalSwipeDirection(direction) {
  return direction === "up" || direction === "down"
}

module.exports = {
  getTouchPoint: getTouchPoint,
  isBackSwipe: isBackSwipe,
  isDeleteSwipe: isDeleteSwipe,
  isVerticalSwipeDirection: isVerticalSwipeDirection
}
