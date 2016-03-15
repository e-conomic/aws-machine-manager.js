"use strict";
var expect    = require("must"),
    mockgoose = require("mockgoose"),
    Mongoose  = require("mongoose").Mongoose,
    s         = require("util").format
var MachineManager = require("../")

var mongoose = new Mongoose()
mockgoose(mongoose)

describe("MachineManager", function () {
  it("should be a constructor", function () {
    expect(MachineManager).to.be.a.constructor()
  })

  it("should get its own mongoose if none is provided", function () {
    var instance = new MachineManager({pem: "pem"})
    expect(instance).to.be.an.object()
    expect(instance._mongoose).to.be.an.object()
  })

  describe("as instance", function () {
    var M
    before(function () {
      M = new MachineManager({pem: "pem", mongo: {connection: mongoose}})
      if (M.ec2) M.ec2 = {}
    })

    after(function (done) {
      M.close(done)
    })

    it("should expose db property", function () {
      expect(M.db).to.be.an.object()
    })
    it("should expose ec2 property", function () {
      expect(M.ec2).to.be.an.object()
    })

    it("should expose exceptions", function () {
      expect(M.exceptions).to.be.an.object()
    })

    var methods = [
      "getPassword", "startInstance", "stopInstance", "terminate",
      "getAllMachines", "getMachine", "getMachineById", "updateMachine",
      "runcmd", "spawn"
    ]
    methods.forEach(function (meth) {
      it(s("should expose %s", meth), function () {
        expect(M[meth], s("%s not exposed", meth))
          .to.be.a.function()
      })
    })
  })
})
