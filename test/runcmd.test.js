"use strict";
require("must")
var mec2      = require("mocked-ec2.js"),
    mockgoose = require("mockgoose"),
    Mongoose  = require("mongoose").Mongoose,
    Q         = require("q"),
    sinon     = require("sinon")
var sshcmdModule = require("../lib/sshcmd")
var MachineManager = require("../")
var awsStub   = require("./helpers/aws-stub"),
    fakeClock = require("./helpers/fake-clock")

var mongoose = new Mongoose()
mockgoose(mongoose)

describe("lib/runcmd", function () {
  var M, box, sshcmd
  before(function () {
    box = sinon.sandbox.create()
    M = new MachineManager({
      pem: "pem",
      mongo: {connection: mongoose},
      ssh: {login: "user"}
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

  describe("with fake sshcmd", function () {
    beforeEach(function () {
      M.ec2.describeInstances = awsStub(
        box.stub(), mec2.describeInstances.singleInstance())
      sshcmd = box.stub(sshcmdModule, "eval").returns(Q.resolve("ssh result"))
      return M.db.Machine.create({name: "foo", "instanceId": "id"})
    })

    it("should call sshcmd", function () {
      return M.runcmd("foo", "cmd", {privateKey: "pem"})
        .then(function () {
          sinon.assert.calledOnce(sshcmd)
          sinon.assert.calledWith(
            sshcmd, "cmd", {
              login: "user",
              port: 22,
              privateKey: "pem",
              url: sinon.match.string,
              debugprogress: false
            })
        })
    })

    it("should resolve to ssh output", function () {
      return M.runcmd("foo", "cmd", {privateKey: "pem"})
        .must.resolve.to.eql("ssh result")
    })

    describe("with fake timer", function () {
      var clock
      beforeEach(function () {
        clock = fakeClock(1000)
        M.ec2.describeInstances = awsStub(
          box.stub(), mec2.describeInstances.stoppedInstance())
        M.ec2.startInstances = awsStub(
          box.stub(), mec2.startInstances.stoppedInstance())
      })

      afterEach(function () {
        clock.restore()
      })

      it("should retry if it fails", function () {
        sshcmd.onCall(0).returns(Q.reject(new Error()))
        sshcmd.onCall(1).returns(Q.resolve("ssh result"))
        return M.runcmd("foo", "cmd", {privateKey: "pem"})
          .then(function () {
            sinon.assert.calledTwice(sshcmd)
          })
      })

      it("should eventually fail", function () {
        sshcmd.returns(Q.reject(new Error()))
        return M.runcmd("foo", "cmd", {privateKey: "pem"})
          .must.reject.with.error()
      })
    })
  })
})
