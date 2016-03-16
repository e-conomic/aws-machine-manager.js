"use strict";
var _        = require("lodash"),
    Q        = require("q"),
    s        = require("util").format,
    validate = require("validate.js")
var exc = require("../lib/exceptions")

validate.Promise = Q.Promise

var Manager = module.exports

Manager.spawn = function (opts, userData) {
  var self = this
  opts = opts || {}

  return Q.fcall(function () {
      var obj = new self.db.Machine(opts)
      return obj.save()
    })
    .then(function (obj) {
      var uData = userData || self.settings.ec2.userData
      var payload = {
        ImageId: self.settings.ec2.ami,
        InstanceType: self.settings.ec2.type,
        KeyName: self.settings.ec2.keyName,
        MinCount: self.settings.ec2.min,
        MaxCount: self.settings.ec2.max
      }
      if (self.settings.ec2.networkgroups.length ||
          self.settings.ec2.subnet)
        payload.NetworkInterfaces = [{
          AssociatePublicIpAddress: true,
          DeviceIndex: 0,
          Groups: self.settings.ec2.networkgroups,
          SubnetId: self.settings.ec2.subnet
        }]
      if (uData) payload.UserData = new Buffer(uData).toString("base64")
      return [obj, payload]
    })
    .spread(function (obj, payload) {
      return spawnInstance(self.ec2, opts.name, payload,
                           self.settings.retry)
        .catch(function (err) {
          return obj.remove()
            .thenReject(err)
        })
        .then(function (awsMachine) {
          return associateMachineToInstance(obj, awsMachine)
        })
        .then(function () {
          return self.getMachineById(obj._id) // Return fresh data
        })
    })
}

var associateMachineToInstance = function (obj, aws) {
  var reservation = aws.data.Reservations[0]
  var instance = reservation.Instances[0]
  var data = {
    reservationId: reservation.ReservationId,
    instanceId: instance.InstanceId
  }
  return Q(obj.update(data)) // somehow .update doesn't return a Q promise?
    .catch(function (err) {
      return Q.all(
        [
          self.ec2.terminateInstances({InstanceIds: [data.instanceId]}),
          obj.remove()
        ])
        .thenReject(err)
    })
}

var retrySetName = function (ec2, instanceId, tags, delay, retries) {
  return Q.Promise(function (resolve) {
      var args = {
        Resources: [instanceId],
        Tags: []
      }
      _.map(tags, function (value, key) {
        args.Tags.push({Key: key, Value: value})
      })
      resolve(args)
    })
    .then(function (args) {
      return ec2.createTags(args).promise()
        .catch(function (err) {
          if (retries == 0) throw new exc.MaxRetriesError(
            s("createTags too many times, err: ", err))
          return Q.delay(delay)
            .then(function () {
              return retrySetName(ec2, instanceId, tags, delay, retries - 1)
            })
        })
    })
    .then(function (res) {
      return res.data
    })
}

var spawnInstance = function (ec2, name, payload, retry) {
  return ec2.runInstances(payload).promise()
    .then(function (res) {
      return Q.delay(retry.delay)
        .then(function () {
          var instance = res.data.Instances[0]
          return retrySetName(ec2, instance.InstanceId,
                              {
                                Name: name,
                                SpawnedBy: "aws-machine-manager",
                                Env: process.env.NODE_ENV || "development"
                              },
                              retry.delay, retry.count)
            .catch(function (err) {
              if (err instanceof exc.MaxRetriesError)
                ec2.terminateInstances({InstanceIds: [instance.InstanceId]})
              throw err
            })
            .then(function () {
              var args = {InstanceIds: [instance.InstanceId]}
              return ec2.describeInstances(args).promise()
            })
        })
    })
}

