"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    Mongoose  = require("mongoose").Mongoose,
    s         = require("util").format,
    sinon     = require("sinon")
var exc = require("../lib/exceptions")
var MachineManager = require("../")
var awsStub = require("./helpers/aws-stub")

var mongoose = new Mongoose()
mockgoose(mongoose)

describe("lib/machines", function () {
  var M, box
  before(function () {
    box = sinon.sandbox.create()
    M = new MachineManager({pem: "pem", mongo: {connection: mongoose}})
    if (M.ec2) M.ec2 = {}
  })

  afterEach(function () {
    box.restore()
    return M.db.Machine.remove({})
  })

  after(function (done) {
    M.close(done)
  })

  describe("#getAllMachines", function () {
    it("should return array", function () {
      return M.getAllMachines()
        .must.resolve.to.array()
    })

    it("should find machines", function () {
      return M.db.Machine.create({name: "foo"})
        .then(function () {
          return M.getAllMachines()
        })
        .must.resolve.to.length(1)
    })

    it("should enhance all elements", function () {
      return M.db.Machine.create({name: "foo"})
        .then(function () {
          return M.getAllMachines()
        })
        .then(function (objs) {
          return objs[0]
        })
        .must.resolve.to.have.property("getReservations")
    })
  })

  describe("#getMachine", function () {
    it("should reject with NotFoundError", function () {
      return M.getMachine("doesnt exist")
        .must.reject.with.instanceof(exc.NotFoundError)
    })

    it("should find machine", function () {
      return M.db.Machine.create({name: "foo"})
        .then(function () {
          return M.getMachine("foo")
        })
        .must.resolve.to.object()
    })

    describe("should expose", function () {
      var methods = ["getReservations", "getReservation", "getInstances",
                     "getInst", "getIds", "getState", "getStatus"]
      methods.forEach(function (meth) {
        it(s("#%s", meth), function () {
          return M.db.Machine.create({name: "foo"})
            .then(function () {
              return M.getMachine("foo")
                .then(function (obj) {
                  return obj[meth]
                })
                .must.resolve.to.a.function()
            })
        })
      })
    })

    describe("with enhanced data", function () {
      beforeEach(function () {
        M.ec2.describeInstances = awsStub(
          box.stub(), mec2.describeInstances.singleInstance())
        M.ec2.describeInstanceStatus = awsStub(
          box.stub(), mec2.describeInstanceStatus.running())
        return M.db.Machine.create([{name: "foo", instanceId: "1"}])
      })

      it("should expose status", function () {
        return M.getMachine("foo")
          .then(function (obj) {
            return obj.getStatus()
          })
          .must.resolve.to.object()
      })
    })
  })

  describe("#getMachineById", function () {
    it("should reject with NotFoundError", function () {
      return M.getMachineById("doesnt exist")
        .must.reject.with.instanceof(exc.NotFoundError)
    })

    it("should find machine", function () {
      return M.db.Machine.create({_id: "id", name: "foo"})
        .then(function () {
          return M.getMachineById("id")
        })
        .must.resolve.to.object()
    })

    describe("should expose", function () {
      var methods = ["getReservations", "getReservation", "getInstances",
                     "getInst", "getIds", "getState", "getStatus"]
      methods.forEach(function (meth) {
        it(s("#%s", meth), function () {
          return M.db.Machine.create({_id: "id", name: "foo"})
            .then(function () {
              return M.getMachineById("id")
            })
            .then(function (obj) {
              return obj[meth]
            })
            .must.resolve.to.a.function()
        })
      })
    })

    describe("with enhanced data", function () {
      beforeEach(function () {
        M.ec2.describeInstances = awsStub(
          box.stub(), mec2.describeInstances.singleInstance())
        M.ec2.describeInstanceStatus = awsStub(
          box.stub(), mec2.describeInstanceStatus.running()
        )
        return M.db.Machine.create({_id: "id", name: "foo", instanceId: "1"})
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
    it("should reject with NotFoundError", function () {
      return M.updateMachine("doesnt exist")
        .must.reject.with.instanceof(exc.NotFoundError)
    })

    it("should update machine", function () {
      return M.db.Machine.create({name: "foo", extra: {bar: "baz"}})
        .then(function () {
          return M.updateMachine("foo", {extra: {ham: "spam"}})
        })
        .then(function () {
          return M.db.Machine.findOne({name: "foo"})
        })
        .then(function (obj) {
          return obj.extra
        })
        .must.resolve.to.eql({ham: "spam"})
    })

    it("should allow renaming", function () {
      return M.db.Machine.create({name: "foo"})
        .then(function () {
          return M.updateMachine("foo", {name: "bar"})
        })
        .then(function () {
          return M.db.Machine.findOne({name: "bar"})
        })
        .must.resolve.to.object()
    })

    it("should fail renaming if not unique", function () {
      return M.db.Machine.create([{name: "foo"}, {name: "bar"}])
        .then(function () {
          return M.updateMachine("foo", {name: "bar"})
        })
        .must.reject.with.object({"message": "name must be unique"})
    })
  })

  describe("#machineExists", function () {
    it("should identify missing machine", function () {
      return M.machineExists("foo")
        .must.resolve.to.false()
    })

    it("should find machine", function () {
      return M.db.Machine.create({name: "foo"})
        .then(function () {
          return M.machineExists("foo")
            .must.resolve.to.true()
        })
    })
  })
})
