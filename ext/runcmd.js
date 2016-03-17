"use strict";
var EventEmitter = require("events").EventEmitter,
    pemParser    = require("pem-parser"),
    Q            = require("q"),
    ursa         = require("ursa")
var sshCmd = require("../lib/sshcmd")

var Manager = module.exports

Manager.runcmd = function (name, cmd, opts) {
  var self = this
  opts = opts || {}
  var retryRunCmd = function (cmd, sshOptions, delay_ms, times) {
    return sshCmd[opts.mode || self.runcmd.mode.eval](cmd, sshOptions)
      .then(function (result) {
              return result
            },
            function (err) {
              if (times == 0) throw err
              self.runcmd.emitter.emit("retry", err)
              return Q.delay(delay_ms)
                .then(function () {
                  return retryRunCmd(cmd, sshOptions, delay_ms, times - 1)
                })
            },
            function (msg) {
              self.runcmd.emitter.emit("progress", msg)
            })
  }

  return self.getMachine(name)
    .then(function (obj) {
      return obj.getState()
        .then(function (state) {
          if (state !== "running") {
            return self.ec2.startInstances({InstanceIds: [obj.instanceId]}).promise()
              .then(Q.delay(10000))
          }
        })
        .then(function () {
          return obj
        })
    })
    .invoke("getInst")
    .get("PublicIpAddress")
    .then(function (ip) {
      var sshOptions = {
        debugprogress: opts.debugprogress || self.settings.ssh.debugprogress,
        login: opts.login || self.settings.ssh.login,
        port: opts.port || self.settings.ssh.port,
        privateKey: pemParser(opts.privateKey || self.settings.pem),
        url: ip
      }
      return retryRunCmd(cmd, sshOptions,
                         opts.delay || self.settings.retry.delay,
                         opts.count || self.settings.retry.count)
    })
}

Manager.runcmd.mode = {eval: "eval", exec: "exec"}
Manager.runcmd.emitter = new EventEmitter()
