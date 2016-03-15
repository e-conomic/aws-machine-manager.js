"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    Mongoose  = require("mongoose").Mongoose,
    sinon     = require("sinon")
var exc = require("../lib/exceptions")
var MachineManager = require("../")
var awsStub = require("./helpers/aws-stub")

var mongoose = new Mongoose()
mockgoose(mongoose)

describe("lib/spawn", function () {
  var M, box
  before(function () {
    box = sinon.sandbox.create()
    M =
      new MachineManager({
        pem: "pem",
        mongo: {connection: mongoose},
        retry: {count:5, delay: 1}
      })
    if (M.ec2) M.ec2 = {}
  })

  afterEach(function () {
    box.restore()
    return M.db.Machine.remove({})
  })

  after(function (done) {
    M.close(done)
  })

  describe("#spawn", function () {
    beforeEach(function () {
      M.ec2.createTags = awsStub(
        box.stub(), mec2.createTags())
      M.ec2.describeInstances = awsStub(
        box.stub(), mec2.describeInstances.singleInstance())
      M.ec2.runInstances = awsStub(
        box.stub(), mec2.runInstances.econSpawnerMachine())
      M.ec2.terminateInstances = awsStub(
        box.stub(), mec2.terminateInstances.spawnedMachine()
      )
    })

    it("should create new db entry", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          return M.db.Machine.findOne({name: "foo"})
        })
        .must.resolve.to.have.property("name", "foo")
    })

    it("should call expected endpoints", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          sinon.assert.calledOnce(M.ec2.runInstances)
          sinon.assert.calledOnce(M.ec2.createTags)
        })
    })

    it("should set instanceId", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          return M.db.Machine.findOne({name: "foo"})
        })
        .must.resolve.to.have.property("instanceId", "i-e403955c")
    })

    it("should set reservationId", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          return M.db.Machine.findOne({name: "foo"})
        })
        .must.resolve.to.have.property("reservationId", "r-a61a8a0b")
    })

    it("should tag the instance", function () {
      return M.spawn({name: "foo"})
        .then(function () {
          sinon.assert.calledWith(M.ec2.createTags, {
            Resources: [sinon.match.string],
            Tags: [
              {Key: "Name", Value: "foo"},
              {Key: "SpawnedBy", Value: "aws-machine-manager"}]
          })
        })
    })

    it("should retry tags if it initially fails", function () {
      awsStub(M.ec2.createTags, new Error(), mec2.createTags())
      return M.spawn({name: "foo"})
        .then(function () {
          sinon.assert.calledTwice(M.ec2.createTags)
        })
    })

    it("should eventually give up retrying", function () {
      M.ec2.createTags.resetBehavior()
      awsStub(M.ec2.createTags, new Error())
      return M.spawn({name: "foo"})
        .must.reject.to.instanceof(exc.MaxRetriesError)
    })

    describe("with existing machine", function () {
      beforeEach(function () {
        return M.db.Machine.create(
          {
            name: "exists", aws: {instanceId: "foo"},
            extra: {foo: "bar"}
          })
      })

      it("should reject", function () {
        return M.spawn({name: "exists"})
          .must.reject.with.error()
      })

      it("should not terminate instance", function () {
        return M.spawn({name: "exists"})
          .catch(function () {
            sinon.assert.notCalled(M.ec2.terminateInstances)
          })
      })

      it("should spawn after deleting existing", function () {
        return M.db.Machine.remove({name: "exists"})
          .then(function () {
            return M.spawn({name: "exists"})
          })
          .must.resolve.to.object()
      })
    })
  })
})
