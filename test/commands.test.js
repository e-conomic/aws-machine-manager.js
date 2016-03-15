"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    Mongoose  = require("mongoose").Mongoose,
    sinon     = require("sinon"),
    ursa      = require("ursa")
var MachineManager = require("../")
var awsStub = require("./helpers/aws-stub")

var mongoose = new Mongoose()
mockgoose(mongoose)

describe("lib/commands", function () {
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

  describe("#getPassword", function () {
    beforeEach(function () {
      M.ec2.getPasswordData = awsStub(
        sinon.stub(), mec2.getPasswordData.windowsInstance())
      box.stub(ursa, "createPrivateKey")
        .returns({decrypt: sinon.stub().returns("password")})
      return M.db.Machine.create({name: "foo"})
    })

    it("should resolve to password", function () {
      return M.getPassword("foo")
        .must.resolve.to.eql("password")
    })

    it("should call expected endpoints", function () {
      return M.getPassword("foo")
        .then(function () {
          sinon.assert.calledOnce(M.ec2.getPasswordData)
        })
    })

    it("should support missing passwordData", function () {
      M.ec2.getPasswordData.resetBehavior()
      awsStub(M.ec2.getPasswordData, {})
      return M.getPassword("foo")
        .must.resolve.to.undefined()
    })
  })

  describe("#startInstance", function () {
    beforeEach(function () {
      M.ec2.startInstances = awsStub(
        box.stub(), mec2.startInstances.stoppedInstance())
      return M.db.Machine.create({name: "foo", "instanceId": "id"})
    })

    it("should call expected endpoint", function () {
      return M.startInstance("foo")
        .then(function () {
          sinon.assert.calledOnce(M.ec2.startInstances)
        })
    })
  })

  describe("#stopInstance", function () {
    beforeEach(function () {
      M.ec2.stopInstances = awsStub(
        box.stub(), mec2.stopInstances.runningInstance())
      return M.db.Machine.create({name: "foo", "instanceId": "id"})
    })

    it("should call expected endpoint", function () {
      return M.stopInstance("foo")
        .then(function () {
          sinon.assert.calledOnce(M.ec2.stopInstances)
        })
    })
  })

  describe("#terminate", function () {
    beforeEach(function () {
      M.ec2.terminateInstances = awsStub(
        box.stub(), mec2.terminateInstances.spawnedMachine())
      return M.db.Machine.create({name: "foo"})
    })

    it("should call expected endpoint", function () {
      return M.terminate("foo")
        .then(function () {
          sinon.assert.calledOnce(M.ec2.terminateInstances)
        })
    })

    it("should delete db entry", function () {
      return M.terminate("foo")
        .then(function () {
          return M.db.Machine.find({})
        })
        .must.resolve.to.eql([])
    })

    it("should still delete machine if strict is disabled", function () {
      awsStub(M.ec2.terminateInstances, new Error("some error"))
      return M.terminate("foo", {strict: false})
        .then(function () {
          return M.db.Machine.find({})
        })
        .must.resolve.to.eql([])
    })
  })
})
