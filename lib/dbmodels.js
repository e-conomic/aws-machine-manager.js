"use strict";
var shortid = require("shortid")
var exc = require("./exceptions")

module.exports = function (mongoose) {
  var machineSchema = mongoose.Schema(
    {
      _id: {type: String, default: shortid.generate, unique: true},
      _schemaVersion: {type: Number, default: 2},
      extra: {},
      instanceId: {type: String, index: true},
      name: {type: String, required: true, unique: true, index: true},
      reservationId: String
    }, {
      timestamps: {createdAt: "_created", updatedAt: "_updated"}
    })

  machineSchema.pre("validate", function (next) {
    var self = this
    mongoose.models["Machine"].findOne(
      {name: self.name}, function (err, doc) {
        if (err) {
          next(err)
        } else if (doc && self._id !== doc._id) {
          self.invalidate("name", "name must be unique")
          next(new Error("name must be unique"))
        } else {
          next()
        }
      })
  })

  machineSchema.statics.findSingle = function (query, cb) {
    return this.model("Machine").find(query)
      .limit(2)
      .then(function (docs) {
        if (!docs.length) return null
        if (docs.length > 1) throw new exc.NotSingleError(query)
        return docs[0]
      })
      .nodeify(cb) // Dependency on Q library
  }
  mongoose.model("Machine", machineSchema, "machines.v2")
  return machineSchema
}
