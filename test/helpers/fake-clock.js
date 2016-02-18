"use strict";
var sinon = require("sinon")

/**
 * Activate fake clock where every real millisecond is `speed`
 */
module.exports = function (speed) {
  var timeout = global.setTimeout
  var clock = sinon.useFakeTimers()

  var speedup = function () {
    timeout(function () {
      clock.tick(speed)
      speedup()
    }, 1)
  }
  speedup()
  return clock
}
