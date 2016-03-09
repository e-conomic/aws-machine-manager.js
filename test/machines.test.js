"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    s         = require("util").format,
    sinon     = require("sinon")
var exc = require("../lib/exceptions")
var MachineManager = require("../")
var awsStub = require("./helpers/aws-stub")

describe("lib/machines", function () {
  var db, box
  beforeEach(function () {
    box = sinon.sandbox.create()
    mockgoose(require("mongoose"))
    db = require("../lib/dbmodels")(require("../lib/dbconnect")("url"))
  })

  afterEach(function () {
    mockgoose.reset()
    box.restore()
  })

  describe("#getAllMachines", function () {
    it("should return array", function () {
      return new MachineManager().getAllMachines()
        .must.resolve.to.array()
    })

    it("should find machines", function () {
      return db.Machine.insert([{name: "foo"}])
        .then(function () {
          return new MachineManager().getAllMachines()
        })
        .must.resolve.to.length(1)
    })

    it("should enhance all objects", function () {
      return db.Machine.insert([{name: "foo"}])
        .then(function () {
          return new MachineManager().getAllMachines()
            .then(function (objs) {
              return objs[0]
            })
        })
        .must.resolve.to.have.property("getReservations")
    })
  })

  describe("#getMachine", function () {
    it("should reject with NotFoundError", function () {
      return new MachineManager().getMachine("doesnt exist")
        .must.reject.with.instanceof(exc.NotFoundError)
    })

    it("should find machine", function () {
      return db.Machine.insert([{name: "foo"}])
        .then(function () {
          return new MachineManager().getMachine("foo")
        })
        .must.resolve.to.object()
    })

    describe("should expose", function () {
      var methods = ["getReservations", "getReservation", "getInstances",
                     "getInst", "getIds", "getState", "getStatus"]
      methods.forEach(function (meth) {
        it(s("#%s", meth), function () {
          return db.Machine.insert([{name: "foo"}])
            .then(function () {
              return new MachineManager().getMachine("foo")
                .then(function (obj) {
                  return obj[meth]
                })
                .must.resolve.to.a.function()
            })
        })
      })
    })

    describe("with enhanced data", function () {
      var M
      beforeEach(function () {
        M = new MachineManager()
        if (M.ec2) M.ec2 = {
          describeInstances: awsStub(
            box.stub(), mec2.describeInstances.singleInstance()),
          describeInstanceStatus: awsStub(
            box.stub(), mec2.describeInstanceStatus.running()
          )
        }

        return db.Machine.insert([{name: "foo", instanceId: "1"}])
      })

      it("should expose status", function () {
        return M.getMachine("foo")
          .then(function (obj) {
            return obj.getStatus()
          })
          .must.resolve.to.object()
      })

      it("should reject on multiple reservations", function () {
        awsStub(M.ec2.describeInstances, mec2.describeInstances.singleInstance(
          {Reservations: [{}, {}]}))
        return M.getMachine("foo")
          .then(function (obj) {
            return obj.getInstances()
          })
          .must.reject.with.error("More than one reservation")
      })

      it("should reject on multiple instances", function () {
        awsStub(M.ec2.describeInstances, mec2.describeInstances.singleInstance(
          {"Reservations": [{Instances: [{}, {}]}]}))
        return M.getMachine("foo")
          .then(function (obj) {
            return obj.getInst()
          })
          .must.reject.with.error("More than one instance")
      })

      it("should reject if not linked to instance", function () {
        return db.Machine.insert([{name: "bar", instanceId: undefined}])
          .then(function () {
            return M.getMachine("bar")
              .then(function (obj) {
                return obj.getInst()
              })
              .must.reject.with.error("No instanceId")
          })
      })
    })
  })

  describe("#getMachineById", function () {
    it("should reject with NotFoundError", function () {
      return new MachineManager().getMachineById("doesnt exist")
        .must.reject.with.instanceof(exc.NotFoundError)
    })

    it("should find machine", function () {
      return db.Machine.insert([{_id: "id", name: "foo"}])
        .then(function () {
          return new MachineManager().getMachineById("id")
        })
        .must.resolve.to.object()
    })

    describe("should expose", function () {
      var methods = ["getReservations", "getReservation", "getInstances",
                     "getInst", "getIds", "getState", "getStatus"]
      methods.forEach(function (meth) {
        it(s("#%s", meth), function () {
          return db.Machine.insert([{_id: "id", name: "foo"}])
            .then(function () {
              return new MachineManager().getMachineById("id")
                .then(function (obj) {
                  return obj[meth]
                })
                .must.resolve.to.a.function()
            })
        })
      })
    })

    describe("with enhanced data", function () {
      var M
      beforeEach(function () {
        M = new MachineManager()
        if (M.ec2) M.ec2 = {
          describeInstances: awsStub(
            box.stub(), mec2.describeInstances.singleInstance()),
          describeInstanceStatus: awsStub(
            box.stub(), mec2.describeInstanceStatus.running()
          )
        }

        return db.Machine.insert([{_id: "id", name: "foo", instanceId: "1"}])
      })

      it("should expose status", function () {
        return M.getMachineById("id")
          .then(function (obj) {
            return obj.getStatus()
          })
          .must.resolve.to.object()
      })

      it("should reject on multiple reservations", function () {
        awsStub(M.ec2.describeInstances, mec2.describeInstances.singleInstance(
          {Reservations: [{}, {}]}))
        return M.getMachineById("id")
          .then(function (obj) {
            return obj.getInstances()
          })
          .must.reject.with.error("More than one reservation")
      })

      it("should reject on multiple instances", function () {
        awsStub(M.ec2.describeInstances, mec2.describeInstances.singleInstance(
          {"Reservations": [{Instances: [{}, {}]}]}))
        return M.getMachineById("id")
          .then(function (obj) {
            return obj.getInst()
          })
          .must.reject.with.error("More than one instance")
      })
    })
  })

  describe("#updateMachine", function () {
    var M
    beforeEach(function () {
      M = new MachineManager()
    })

    it("should reject with NotFoundError", function () {
      return M.updateMachine("doesnt exist")
        .must.reject.with.instanceof(exc.NotFoundError)
    })

    it("should update machine", function () {
      return db.Machine.insert([{name: "foo", extra: {bar: "baz"}}])
        .then(function () {
          return M.updateMachine("foo", {extra: {ham: "spam"}})
        })
        .then(function () {
          return db.Machine.findOne({name: "foo"})
            .then(function (obj) {
              return obj.extra
            })
        })
        .must.resolve.to.eql({ham: "spam"})
    })

    it("should allow renaming", function () {
      return db.Machine.insert([{name: "foo"}])
        .then(function () {
          return M.updateMachine("foo", {name: "bar"})
        })
        .then(function () {
          return db.Machine.findOne({name: "bar"})
        })
        .must.resolve.to.object()
    })

    it("should fail renaming if not unique", function () {
      return db.Machine.insert([{name: "foo"}, {name: "bar"}])
        .then(function () {
          return M.updateMachine("foo", {name: "bar"})
        })
        .must.reject.with.error("Validation failed")
    })
  })

  describe("#machineExists", function () {
    var M
    beforeEach(function () {
      M = new MachineManager()
    })

    it("should identify missing machine", function () {
      return M.machineExists("foo")
        .must.resolve.to.false()
    })

    it("should find machine", function () {
      return db.Machine.insert([{name: "foo"}])
        .then(function () {
          return M.machineExists("foo")
            .must.resolve.to.true()
        })
    })

    it("should respect deleted machine", function () {
      return db.Machine.insert([{name: "foo"}])
        .then(function () {
          return db.Machine.remove({name: "foo"})
        })
        .then(function () {
          return M.machineExists("foo")
        })
        .must.resolve.to.false()
    })
  })
})
