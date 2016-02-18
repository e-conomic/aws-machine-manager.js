"use strict";
var ce = require("node-custom-errors")

module.exports = {
  InstanceError: ce.create("InstanceError"),
  NotRunningError: ce.create("NotRunning"),
  MaxRetriesError: ce.create("MaxRetriesError"),
  NotFoundError: ce.create("NotFoundError")
}
