"use strict";
var pemParser = require("pem-parser"),
    Q         = require("q"),
    ursa      = require("ursa")
var sshCmd = require("../lib/sshcmd")

var Manager = module.exports

Manager.runcmd = function (name, cmd, opts) {
  var self = this
  opts = opts || {}
  var _retryRunCmd = function (cmd, sshOptions, delay_ms, times) {
    return sshCmd[opts.mode || "eval"](cmd, sshOptions)
      .then(function (result) {
              return result
            },
            function (err) {
              if (times == 0) throw err
              return Q.delay(delay_ms)
                .then(function () {
                  return _retryRunCmd(cmd, sshOptions, delay_ms, times - 1)
                })
            })
  }

  var retryRunCmd = function (inst) {
    var sshOptions = {
      login: opts.login || self.settings.ssh.login,
      port: opts.port || self.settings.ssh.port,
      privateKey: pemParser(opts.privateKey || self.settings.pem),
      url: inst.PublicIpAddress
    }
    if (inst.State.Name === "running") {
      return _retryRunCmd(cmd, sshOptions,
                          opts.delay || self.settings.retry.delay,
                          opts.count || self.settings.retry.count)
    }
    else {
      var args = {InstanceIds: [inst.InstanceId]}
      return self.ec2.startInstances(args).promise()
        .then(Q.delay(opts.delay || self.settings.retry.delay))
        .then(function () {
          return _retryRunCmd(cmd, sshOptions,
                              opts.delay || self.settings.retry.delay,
                              opts.count || self.settings.retry.count)
        })
    }
  }

  return self.getMachine(name)
    .then(function (obj) {
      return obj.getInst()
    })
    .then(retryRunCmd)
}
