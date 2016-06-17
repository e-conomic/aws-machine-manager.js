"use strict";
var Q        = require("q"),
    s        = require("util").format,
    validate = require("validate.js")
var exc = require("../lib/exceptions")

validate.Promise = Q.Promise

var machineCache = {}

var Manager = module.exports

Manager.getAllMachines = function (opts) {
  var self = this
  opts = opts || {}
  return this.db.Machine.find({})
    .sort(opts.sort)
    .then(function (objs) {
      objs.forEach(function (obj) {
        enhanceObj(self.ec2, obj)
      })
      return objs
    })
}

Manager.getMachine = function (name) {
  var self = this
  if (!name) return Q.reject(new Error("No name specified"))
  return this.db.Machine.findSingle({name: name})
    .then(function (obj) {
      if (!obj) throw new exc.NotFoundError(
        s("No machine named %s", name))
      return obj
    })
    .then(function (obj) {
      enhanceObj(self.ec2, obj)
      return obj
    })
}

Manager.getMachineById = function (id) {
  var self = this
  if (!id) return Q.reject(new Error("No id specified"))
  return this.db.Machine.findSingle({_id: id})
    .then(function (obj) {
      if (!obj) throw new exc.NotFoundError(
        s("No machine with id %s", id))
      return obj
    })
    .then(function (obj) {
      enhanceObj(self.ec2, obj)
      return obj
    })
}

Manager.updateMachine = function (name, opts) {
  var self = this
  return self.getMachine(name)
    .then(function (obj) {
      // load-modify-save pattern instead of updating, to invoke validation
      Object.keys(opts).forEach(function (key) {
        obj[key] = opts[key]
      })
      // Need to explicitly mark the extra field as modified since it's mixed schema and mongoose won't track that
      obj.markModified("extra")
      return obj.save()
    })
}

Manager.machineExists = function (name) {
  return this.db.Machine.count({name: name}).limit(1)
    .then(function (count) {
      return count > 0
    })
}

var enhanceObj = function (ec2, obj) {
  obj.getReservations = function () {
    if (!obj.instanceId) throw new exc.InstanceError("No instanceId")
    if (machineCache[obj.instanceId]) {
      if (Date.now() - machineCache[obj.instanceId].reservationTimestamp > 180000) {
        
            machineCache[obj.instanceId] = { 
              "reservationTimestamp": Date.now(),
              "reservations": Q(body.data.Reservations)
            }
        return machineCache[obj.instanceId].reservations
      }
      else {
        return machineCache[obj.instanceId].reservations
      }
    }
    else {
      return ec2.describeInstances({InstanceIds: [obj.instanceId]}).promise()
        .then(function (body) {
          machineCache[obj.instanceId] = { 
            "reservationTimestamp": Date.now(),
            "reservations": Q(body.data.Reservations)
          }
          return machineCache[obj.instanceId].reservations
        })
    }
  }

  obj.getReservation = function () {
    return this.getReservations()
      .then(function (reservs) {
        if (!reservs.length)
          throw new exc.InstanceError("No reservations")
        if (reservs.length > 1)
          throw new exc.InstanceError("More than one reservation")
        return reservs[0]
      })
  }

  obj.getInstances = function () {
    return this.getReservation()
      .then(function (res) {
        return res.Instances
      })
  }

  obj.getInst = function () {
    return this.getInstances()
      .then(function (insts) {
        if (!insts.length)
          throw new exc.InstanceError("No instances")
        if (insts.length > 1)
          throw new exc.InstanceError("More than one instance")
        return insts[0]
      })
  }

  obj.getIds = function () {
    return this.getReservation()
      .then(function (res) {
        return [res.ReservationId, res.Instances[0].InstanceId]
      })
  }

  obj.getState = function () {
    return this.getInst()
      .then(function (inst) {
        return inst.State.Name
      })
  }

  obj.getStatus = function () {
        return ec2.describeInstanceStatus({InstanceIds: [obj.instanceId]})
          .promise()
  }
}
