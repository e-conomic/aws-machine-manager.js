"use strict";
var aws          = require("aws-sdk-promise"),
    EventEmitter = require("events").EventEmitter,
    Q            = require("q")
var dbconnect   = require("./lib/dbconnect"),
    dbmodels    = require("./lib/dbmodels"),
    exceptions  = require("./lib/exceptions"),
    getSettings = require("./lib/settings")

aws.Promise = Q.Promise

var emitter = new EventEmitter()

var Manager = function (opts) {
  this.settings = getSettings(opts)

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
      if (!this._db) this._db = dbmodels(dbconnect(self.settings.mongo.url,
                                                   self.settings.mongo.options))
      return this._db
    },
    set: function (val) {
      this._db = val
    }
  })
}

Manager.prototype.on = {spawn: function (fn) { emitter.on("spawn", fn) }}
Manager.prototype.emit = emitter.emit.bind(emitter)

Manager.prototype.exceptions = exceptions

var extensions = [require("./ext/commands"), require("./ext/machines"),
                  require("./ext/runcmd"), require("./ext/spawn")]
extensions.forEach(function (mod) {
  for (var functionName in mod) {
    Manager.prototype[functionName] = mod[functionName]
  }
})

module.exports = Manager
