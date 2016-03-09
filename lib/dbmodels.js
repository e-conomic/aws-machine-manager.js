"use strict";
var mongoose = require("mongoose")
var Q = require("q")
var shortid = require("shortid")

mongoose.Promise = require("q").Promise

var machineSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate, unique: true},
  _schemaVersion: {type: Number, default: 2},
  extra: {},
  instanceId: String,
  name: {type: String, required: true, unique: true},
  reservationId: String
}, {
  timestamps: {createdAt: "_created", updatedAt: "_updated"}
})
machineSchema.index({
                      instanceId: 1, reservationsId: 1,
                      name: 1, createdAt: 1, updatedAt: 1
                    })

module.exports = function (conn) {
  var model = conn.model("Machine", machineSchema, "machines.v2")

  model.insert = function (docs, callback) {
    var args = docs ? docs.slice() : []
    if (!callback) callback = promiseCBWrapper
    args.push(callback)
    return conn.model("Machine").create.apply(model, args)
  }

  model.findSingle = function (msg) {
    return conn.model("Machine").find(msg)
      .then(function (res) {
        if (res.length > 1) throw new Error("Only one document allowed, got " +
                                            res.length)
        return res[0]
      })
  }

  machineSchema.path("name").validate(function (value, done) {
    conn.model("Machine").count({name: value})
      .then(function (count) {
        done(!count)
      })
      .done()
  }, "name already exists")

  return {Machine: model}
}

var promiseCBWrapper = function (err, data) {
  return Q.Promise(function (resolve, reject) {
    if (err) return reject(err)
    resolve(data)
  })
}
