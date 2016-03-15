"use strict";
require("must")
var Mongoose = require("mongoose").Mongoose
var mockgoose = require("mockgoose")

var mongoose = new Mongoose()
mockgoose(mongoose)

describe("schema", function () {
  var Machine
  before(function (done) {
    require("../lib/dbmodels")(mongoose)
    Machine = mongoose.model("Machine")
    require("../lib/dbconnect")(mongoose, "localhost", done)
  })

  afterEach(function () {
    return Machine.remove({})
  })

  describe("unique name", function () {
    beforeEach(function () {
      return Machine.create({name: "foo"})
    })

    it("should allow one entry", function () {
      return Machine.find({name: "foo"})
        .must.resolve.to.length(1)
    })

    it("should reject same name", function () {
      return Machine.create({name: "foo"})
        .must.reject.with.object({"message": "name must be unique"})
    })

    it("should reject saving to same name", function () {
      return Machine.create({name: "bar"})
        .then(function (res) {
          res.name = "foo"
          return res.save()
        })
        .must.reject.with.object({"message": "name must be unique"})
    })
  })

  describe("#findSingle", function () {
    it("should find a single document", function () {
      return Machine.create({name: "foo", instanceId: "spam"})
        .then(function () {
          return Machine.findSingle({instanceId: "spam"})
        })
        .must.resolve.to.object()
    })

    it("should reject if multiple documents exists", function () {
      return Machine.create([{name: "foo", instanceId: "spam"},
                              {name: "bar", instanceId: "spam"}])
        .then(function () {
          return Machine.findSingle({instanceId: "spam"})
        })
        .must.reject.with.error()
    })
  })

  describe("#_updated", function () {
    it("should initially match _created", function () {
      return Machine.create({name: "foo"})
        .then(function (doc) {
          doc._updated.getTime().must.eql(doc._created.getTime())
        })
    })

    it("should update on save", function () {
      var Q = require("q")
      return Machine.create({name: "foo"})
        .then(Q.delay(500))
        .invoke("save")
        .then(function (doc) {
          doc._updated.getTime().must.not.eql(doc._created.getTime())
        })
    })
  })
})

