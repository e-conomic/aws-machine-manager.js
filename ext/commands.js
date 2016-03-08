"use strict";
var pemParser = require("pem-parser"),
    Q         = require("q"),
    ursa      = require("ursa")

var Manager = module.exports

Manager.getPassword = function (name) {
  var self = this
  return Q.when(ursa.createPrivateKey(pemParser(self.settings.pem)))
    .then(function (pkey) {
      return self.getMachine(name)
        .then(function (obj) {
          return self.ec2.getPasswordData({InstanceId: obj.instanceId})
            .promise()
        })
        .then(function (res) {
          if (!res.data.PasswordData) return
          return pkey.decrypt(
            res.data.PasswordData, "base64", "utf8", ursa.RSA_PKCS1_PADDING)
        })
    })
}

Manager.startInstance = function (name) {
  var self = this
  return self.getMachine(name)
    .then(function (obj) {
      return self.ec2.startInstances({InstanceIds: [obj.instanceId]})
        .promise()
    })
}

Manager.stopInstance = function (name) {
  var self = this
  return self.getMachine(name)
    .then(function (obj) {
      return self.ec2.stopInstances({InstanceIds: [obj.instanceId]})
        .promise()
    })
}

Manager.terminate = function (name, opts) {
  opts = opts || {}
  var self = this
  return self.getMachine(name)
    .then(function (obj) {
      return self.ec2.terminateInstances({InstanceIds: [obj.instanceId]})
        .promise()
        .catch(function (err) {
          if (opts.strict === false) return
          throw err
        })
        .then(function () {
          return obj.remove()
        })
    })
}
