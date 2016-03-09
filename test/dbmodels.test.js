"use strict";
require("must")
var mockgoose = require("mockgoose"),
    sinon     = require("sinon")

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

  describe("#findSingle", function () {
    it("should find a single document", function () {
      return db.Machine.insert([{name: "foo", instanceId: "spam"}])
        .then(function () {
          return db.Machine.findSingle({instanceId: "spam"})
        })
        .must.resolve.to.object()
    })

    it("should reject if somehow multiple machines are found", function () {
      return db.Machine.insert([{name: "foo", instanceId: "spam"},
                                 {name: "bar", instanceId: "spam"}])
        .then(function () {
          return db.Machine.findSingle({instanceId: "spam"})
        })
      .must.reject.with.error()
    })
  })
})
