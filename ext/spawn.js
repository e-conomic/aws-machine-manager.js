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
  var created = false
  opts = opts || {}

  return self.getMachine(opts.name)
    .then(function (obj) {
            var args = {InstanceIds: [obj.instanceId]}
            return self.ec2.terminateInstances(args).promise()
              .then(function () { return obj },
                    function (err) { return obj })
          },
          function (err) {
            if (err instanceof exc.NotFoundError)
              return newMachine(self.db, opts)
                .then(function () {
                  created = true
                  return self.getMachine(opts.name)
                })
            throw err
          })
    .then(function (obj) {
      return Q.fcall(function () {
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
          return payload
        })
        .then(function (payload) {
          return spawnInstance(self.ec2, opts.name, payload,
                               self.settings.retry)
            .catch(function (err) {
              if (created) return obj.remove()
                .then(function () {
                  throw err
                })
              throw err
            })
            .then(function (res) {
              var reservation = res.data.Reservations[0]
              var instance = reservation.Instances[0]
              var data = {
                reservationId: reservation.ReservationId,
                instanceId: instance.InstanceId
              }
              if (opts.extra) data.extra = opts.extra
              return obj.update(data)
                .then(function () {
                  return self.getMachine(opts.name)
                })
            })
        })
    })
}

var spawnInstance = function (ec2, name, payload, retry) {
  return ec2.runInstances(payload).promise()
    .then(function (res) {
      return Q.delay(retry.delay)
        .then(function () {
          var instance = res.data.Instances[0]
          return retrySetName(ec2, instance.InstanceId,
                              {Name: name, SpawnedBy: "aws-machine-manager"},
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

var newMachine = function (db, opts) {
  return Q.when(new db.Machine(opts))
    .then(function (machine) {
      return machine.save()
    })
}
