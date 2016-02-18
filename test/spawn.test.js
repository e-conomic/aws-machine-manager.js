"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    sinon     = require("sinon")
var exc = require("../lib/exceptions")
var MachineManager = require("../")
var awsStub   = require("./helpers/aws-stub"),
    fakeClock = require("./helpers/fake-clock")

describe("lib/spawn", function () {
  var db, box, clock
  beforeEach(function () {
    box = sinon.sandbox.create()
    clock = fakeClock(5000)
    mockgoose(require("mongoose"))
    db = require("../lib/dbmodels")(require("../lib/dbconnect")("url"))
  })

  afterEach(function () {
    box.restore()
    clock.restore()
    mockgoose.reset()
  })

  describe("#spawn", function () {
    var M, stubs
    beforeEach(function () {
      stubs = {
        createTags: box.stub(), describeInstances: box.stub(),
        runInstances: box.stub(), terminateInstances: box.stub()
      }
      M = new MachineManager()
      if (M.ec2) M.ec2 = {
        createTags: awsStub(
          stubs.createTags, mec2.createTags()),
        describeInstances: awsStub(
          stubs.describeInstances, mec2.describeInstances.singleInstance()),
        runInstances: awsStub(
          stubs.runInstances, mec2.runInstances.econSpawnerMachine()),
        terminateInstances: awsStub(
          stubs.terminateInstances, mec2.terminateInstances.spawnedMachine()
        )
      }
    })

    it("should create new db entry", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          return db.Machine.findOne({name: "foo"})
        })
        .must.resolve.to.have.property("name", "foo")
    })

    it("should call expected endpoints", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          sinon.assert.calledOnce(stubs.runInstances)
          sinon.assert.calledOnce(stubs.createTags)
        })
    })

    it("should set instanceId", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          return db.Machine.findOne({name: "foo"})
            .then(function (obj) {
              return obj
            })
        })
        .must.resolve.to.have.property("instanceId", "i-e403955c")
    })

    it("should set reservationId", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          return db.Machine.findOne({name: "foo"})
            .then(function (obj) {
              return obj
            })
        })
        .must.resolve.to.have.property("reservationId", "r-a61a8a0b")
    })

    it("should tag the instance", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          sinon.assert.calledWith(stubs.createTags, {
            Resources: [sinon.match.string],
            Tags: [
              {Key: "Name", Value: "foo"},
              {Key: "SpawnedBy", Value: "aws-machine-manager"}]
          })
        })
    })

    it("should retry tags if it initially fails", function () {
      awsStub(stubs.createTags, new Error(), mec2.createTags())
      return M.spawn({name: "foo"})
        .then(function () {
          sinon.assert.calledTwice(stubs.createTags)
        })
    })

    it("should eventually give up retrying", function () {
      stubs.createTags.resetBehavior()
      awsStub(stubs.createTags, new Error())
      return M.spawn({name: "foo"})
        .must.reject.to.instanceof(exc.MaxRetriesError)
    })

    describe("with existing machine", function () {
      beforeEach(function () {
        return db.Machine.insert([{
          name: "exists", aws: {instanceId: "foo"},
          extra: {foo: "bar"}
        }])
      })

      it("should use existing machine", function () {
        return M.spawn({name: "exists"})
          .must.resolve.to.object()
      })

      it("should terminate instance", function () {
        return M.spawn({name: "exists"})
          .then(function () {
            sinon.assert.calledOnce(stubs.terminateInstances)
          })
      })

      it("should support missing instance", function () {
        awsStub(stubs.terminateInstances, new Error())
        return M.spawn({name: "exists"})
          .then(function (obj) {
            return obj
          })
          .must.resolve.to.have.property("instanceId", "i-e403955c")
      })

      it("should update instanceId", function () {
        return M.spawn({name: "exists"})
          .then(function () {
            return db.Machine.findOne({name: "exists"})
              .then(function (obj) {
                return obj
              })
          })
          .must.resolve.to.have.property("instanceId", "i-e403955c")
      })

      it("should update reservationId", function () {
        return M.spawn({name: "exists"})
          .then(function () {
            return db.Machine.findOne({name: "exists"})
              .then(function (obj) {
                return obj
              })
          })
          .must.resolve.to.have.property("reservationId", "r-a61a8a0b")
      })

      it("should set extra data", function () {
        return M.spawn({name: "exists", extra: {ham: "spam"}})
          .then(function () {
            return db.Machine.findOne({name: "exists"})
              .then(function (obj) {
                return obj.extra
              })
          })
          .must.resolve.to.eql({ham: "spam"})
      })
    })
  })
})
