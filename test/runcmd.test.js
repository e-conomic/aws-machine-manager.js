"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    Q         = require("q"),
    sinon     = require("sinon")
var sshcmd = require("../lib/sshcmd")
var MachineManager = require("../")
var awsStub   = require("./helpers/aws-stub"),
    fakeClock = require("./helpers/fake-clock")

describe("lib/runcmd", function () {
  var M, box, db
  beforeEach(function () {
    box = sinon.sandbox.create()
    mockgoose(require("mongoose"))
    M = new MachineManager({ssh: {login: "user"}})
    db = require("../lib/dbmodels")(require("../lib/dbconnect")("url"))
    return db.Machine.insert([{name: "foo", "instanceId": "id"}])
  })

  afterEach(function () {
    box.restore()
    mockgoose.reset()
  })

  describe("with running instance", function () {
    var stub
    beforeEach(function () {
      if(M.ec2) M.ec2 = {
        describeInstances: awsStub(
          box.stub(), mec2.describeInstances.singleInstance()
        )
      }
      stub = box.stub(sshcmd, "eval").returns(Q.resolve("ssh result"))
    })

    it("should call sshcmd", function () {
      return M.runcmd("foo", "cmd", {privateKey: "pem"})
        .then(function () {
          sinon.assert.calledOnce(stub)
          sinon.assert.calledWith(
            stub, "cmd", {
              login: "user",
              port: 22,
              privateKey: "pem",
              url: sinon.match.string
            })
        })
    })

    it("should resolve to ssh output", function () {
      return M.runcmd("foo", "cmd", {privateKey: "pem"})
        .must.resolve.to.eql("ssh result")
    })
  })

  describe("with fake timer", function () {
    var clock, stub
    beforeEach(function () {
      clock = fakeClock(5000)
      if(M.ec2) M.ec2 = {
        describeInstances: awsStub(
          box.stub(), mec2.describeInstances.stoppedInstance()),
        startInstances: awsStub(
          box.stub(), mec2.startInstances.stoppedInstance())
      }
      stub = box.stub(sshcmd, "eval").returns(Q.resolve("ssh result"))
    })

    afterEach(function () {
      clock.restore()
    })

    it("should retry if it fails", function () {
      stub.onCall(0).returns(Q.reject(new Error()))
      stub.onCall(1).returns(Q.resolve("ssh result"))
      return M.runcmd("foo", "cmd", {privateKey: "pem"})
        .then(function () {
          sinon.assert.calledTwice(stub)
        })
    })

    it("should eventually fail", function () {
      stub.returns(Q.reject(new Error()))
      return M.runcmd("foo", "cmd", {privateKey: "pem"})
        .must.reject.with.error()
    })
  })
})
