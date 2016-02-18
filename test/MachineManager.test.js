"use strict";
var expect    = require("must"),
    s         = require("util").format
var MachineManager = require("../")

describe("MachineManager", function () {
  it("should be a constructor", function () {
    expect(MachineManager).to.be.a.constructor()
  })

  it("should expose exceptions", function () {
    expect(new MachineManager().exceptions).to.be.an.object()
  })

  it("should expose ec2 property", function () {
    expect(new MachineManager().ec2).to.be.an.object()
  })

  var methods = [
    "getPassword", "startInstance", "stopInstance", "terminate",
    "getAllMachines", "getMachine", "getMachineById", "updateMachine",
    "runcmd", "spawn"
  ]
  methods.forEach(function (meth) {
    it(s("should expose %s", meth), function () {
      expect(new MachineManager()[meth], s("%s not exposed", meth))
        .to.be.a.function()
    })
  })
})
