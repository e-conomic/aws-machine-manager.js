"use strict";
var _ = require("lodash")
var Q = require("q")

module.exports = function (mongoose, url, opts, cb) {
  mongoose.Promise = Q.Promise
  if (_.isFunction(opts) && cb == undefined) {
    cb = opts
    opts = undefined
  }
  if (!opts) opts = {}
  _.set(opts, "server.socketOptions", {keepAlive: 120})
  _.set(opts, "replset.socketOptions", opts.server.socketOptions)

  mongoose.connection.on("error", function (err) {
    console.error(err.message)
  })

  mongoose.connection.once("open", function () {
    if (opts.debug) console.log("mongodb connection open")
  })

  if (cb) mongoose.connect(url, opts, function (err) {
    cb(err)
  })
  else return mongoose.connect(url, opts)
}
