"use strict";
var aws = require("aws-sdk-promise"),
    Q   = require("q")
var dbconnect   = require("./lib/dbconnect"),
    dbmodels    = require("./lib/dbmodels"),
    exceptions  = require("./lib/exceptions"),
    getSettings = require("./lib/settings")

aws.Promise = Q.Promise

var Manager = function (opts) {
  this.settings = getSettings(opts)
  this._mongoose = this.settings.mongo.connection
  if (!this._mongoose) {
    var Mongoose = require("mongoose").Mongoose
    this._mongoose = new Mongoose()
  }

  Object.defineProperty(this, "ec2", {
    get: function () {
      var self = this
      if (!this._ec2) this._ec2 = new aws.EC2({
        accessKeyId: self.settings.key,
        secretAccessKey: self.settings.secret,
        region: self.settings.ec2.region
      })
      return this._ec2
    },
    set: function (val) {
      this._ec2 = val
    }
  })

  Object.defineProperty(this, "db", {
    get: function () {
      var self = this
      if (!this._db) {
        dbmodels(self._mongoose)
        dbconnect(self._mongoose, self.settings.mongo.url,
                  self.settings.mongo.options)
        this._db = {Machine: self._mongoose.model("Machine")}
      }
      return this._db
    },
    set: function (val) {
      this._db = val
    }
  })
}

Manager.prototype.close = function (cb) {
  return this._mongoose.connection.close(cb)
}

Manager.prototype.exceptions = exceptions

var extensions = [require("./ext/commands"), require("./ext/machines"),
                  require("./ext/runcmd"), require("./ext/spawn")]
extensions.forEach(function (mod) {
  for (var functionName in mod) {
    Manager.prototype[functionName] = mod[functionName]
  }
})

module.exports = Manager
