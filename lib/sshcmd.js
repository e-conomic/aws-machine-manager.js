"use strict";
var Q = require("q")
var ssh = require("ssh2")

exports.exec = function (cmd, opts) {
  opts = opts || {}
  return Q.Promise(function (resolve, reject) {
    var conn = ssh()
    conn.on("error", function (err) {
      reject(err)
    })
    conn.on("ready", function () {
      conn.exec(cmd, function (err, stream) {
        if (err) reject(err)
        stream
          .on("data", function () {
            resolve()
            conn.end()
          })
      })
    }).connect(
      {
        host: opts.url, port: opts.port || 22, username: opts.login,
        privateKey: opts.privateKey
      })
  })
}

exports.eval = function (cmd, opts) {
  opts = opts || {}
  return Q.Promise(function (resolve, reject) {
    var conn = ssh()
    conn.on("error", function (err) {
      reject(err)
    })
    conn.on("ready", function () {
      conn.exec(cmd, function (err, stream) {
        if (err) throw err
        stream
          .on("data", function (data) {
            resolve(data.toString())
          })
      })
    }).connect(
      {
        host: opts.url, port: opts.port || 22, username: opts.login,
        privateKey: opts.privateKey
      })
  })
}
