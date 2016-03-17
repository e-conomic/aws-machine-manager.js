"use strict";
var Q = require("q")
var Client = require("ssh2").Client

exports.progressStates = {
  connected: "connected",
  data: "data",
  ready: "ready"
}

var sshcmd = function (cmd, opts) {
  if (!opts) opts = {}
  return Q.Promise(function (resolve, reject, notify) {
    try {
      var conn = new Client()
      var connopts = {
        host: opts.url, port: opts.port || 22, username: opts.login,
        privateKey: opts.privateKey
      }
      if (opts.debugprogress == true) connopts.debug = notify
      conn.on("ready", function () {
        notify("Ready")
        conn.exec(cmd, function (err, stream) {
          if (err) return reject(err)
          notify("Command executed")
          resolve([conn, stream])
        })
      }).connect(connopts)
    } catch (err) {
      reject(err)
    }
  })
}

exports.exec = function (cmd, opts) {
  return sshcmd(cmd, opts)
    .spread(function (conn, stream) {
      return Q.Promise(function (resolve, reject) {
        try {
          stream
            .on("close", function () {
              conn.end()
            })
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
}

exports.eval = function (cmd, opts) {
  return sshcmd(cmd, opts)
    .spread(function (conn, stream) {
      return Q.Promise(function (resolve, reject) {
        try {
          var received = ""
          stream
            .on("close", function () {
              conn.end()
            })
            .on("data", function (data) {
              received += data.toString()
            })
            .on("end", function () {
              resolve(received)
            })
            .stderr.on("data", function (data) {
            reject(data)
          })
        } catch (err) {
          reject(err)
        }
      })
    })
}
