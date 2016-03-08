"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    sinon     = require("sinon"),
    ursa      = require("ursa")
var MachineManager = require("../")
var awsStub = require("./helpers/aws-stub")

describe("lib/commands", function () {
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

  describe("#getPassword", function () {
    var M, stub
    beforeEach(function () {
      stub = box.stub()
      M = new MachineManager({pem: "pem"})
      if (M.ec2) M.ec2 = {
        getPasswordData: awsStub(
          stub, mec2.getPasswordData.windowsInstance())
      }
      box.stub(ursa, "createPrivateKey")
        .returns({decrypt: box.stub().returns("password")})
      return db.Machine.insert([{name: "foo"}])
    })

    it("should resolve to password", function () {
      return M.getPassword("foo")
        .must.resolve.to.eql("password")
    })

    it("should call expected endpoints", function () {
      return M.getPassword("foo")
        .then(function () {
          sinon.assert.calledOnce(stub)
        })
    })

    it("should support missing passwordData", function () {
      stub.resetBehavior()
      awsStub(stub, {})
      return M.getPassword("foo")
        .must.resolve.to.undefined()
    })
  })

  describe("#startInstance", function () {
    var M, stub
    beforeEach(function () {
      stub = sinon.stub()
      M = new MachineManager()
      if (M.ec2) M.ec2 = {
        startInstances: awsStub(
          stub, mec2.startInstances.stoppedInstance())
      }
      return db.Machine.insert([{name: "foo", "instanceId": "id"}])
    })

    it("should call expected endpoint", function () {
      return M.startInstance("foo")
        .then(function () {
          sinon.assert.calledOnce(stub)
        })
    })
  })

  describe("#stopInstance", function () {
    var M, stub
    beforeEach(function () {
      stub = sinon.stub()
      M = new MachineManager()
      if (M.ec2) M.ec2 = {
        stopInstances: awsStub(
          stub, mec2.stopInstances.runningInstance())
      }
      return db.Machine.insert([{name: "foo", "instanceId": "id"}])
    })

    it("should call expected endpoint", function () {
      return M.stopInstance("foo")
        .then(function () {
          sinon.assert.calledOnce(stub)
        })
    })
  })

  describe("#terminate", function () {
    var M, stub
    beforeEach(function () {
      stub = sinon.stub()
      M = new MachineManager()
      if (M.ec2) M.ec2 = {
        terminateInstances: awsStub(
          stub, mec2.terminateInstances.spawnedMachine())
      }
      return db.Machine.insert([{name: "foo"}])
    })

    it("should call expected endpoint", function () {
      return M.terminate("foo")
        .then(function () {
          sinon.assert.calledOnce(stub)
        })
    })

    it("should delete db entry", function () {
      return M.terminate("foo")
        .then(function () {
          return db.Machine.find({})
        })
        .must.resolve.to.eql([])
    })

    it("should still delete machine if strict is disabled", function () {
      awsStub(stub, new Error("some error"))
      return M.terminate("foo", {strict: false})
        .then(function () {
          return db.Machine.find({})
        })
        .must.resolve.to.eql([])
    })
  })
})
