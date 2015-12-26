export const transitionEndEventName = (() => {
  const el = document.createElement("div")
  const transitions = {
    "transition": "transitionend",
    "OTransition": "oTransitionEnd",
    "MozTransition": "transitionend",
    "WebkitTransition": "webkitTransitionEnd"
  }

  for (const t in transitions)
    if (el.style[t] !== undefined)
      return transitions[t]
})()


export const requestAnimFrame = (() => {
  return window.requestAnimationFrame
    || window.webkitRequestAnimationFrame
    || window.mozRequestAnimationFrame
    || window.msRequestAnimationFrame
    || window.oRequestAnimationFrame
    || ((callback) => setTimeout(callback, 1000 / 60))
})()
