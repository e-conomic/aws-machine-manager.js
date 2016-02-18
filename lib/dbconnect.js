"use strict";
var mongoose = require("mongoose")
var Q = require("q")

mongoose.Promise = Q.Promise

module.exports = function (url, opts, onError) {
  var conn = mongoose.createConnection(url, opts)
  if (!onError) onError = console.error.bind(console)
  conn.once("open", function (err) {
    if (err) onError(err)
  })
  conn.on("error", onError)
  return conn
}
