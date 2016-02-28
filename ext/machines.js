"use strict";
var Q        = require("q"),
    s        = require("util").format,
    validate = require("validate.js")
var exc = require("../lib/exceptions")

validate.Promise = Q.Promise

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
  return this.db.Machine.findOne({name: name})
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
  return this.db.Machine.findOne({_id: id})
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
      opts._updated = new Date()
      return obj.update(opts, {runValidators: true})
        .then(function () {
          return self.getMachineById(obj.id)
        })
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
    return ec2.describeInstances({InstanceIds: [obj.instanceId]}).promise()
      .then(function (body) {
        return body.data.Reservations
      })
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
