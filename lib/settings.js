"use strict";
var _ = require("lodash")

module.exports = function (opts) {
  var data = {
    key: undefined,
    pem: undefined,
    secret: undefined,
    ec2: {
      ami: "ami-1624987f",
      keyName: undefined,
      max: 1,
      min: 1,
      networkgroups: [],
      region: "us-east-1",
      subnet: undefined,
      type: "t1.micro",
      userData: undefined
    },
    mongo: {
      options: {},
      url: "localhost:27017"
    },
    retry: {
      count: 30,
      delay: 2000
    },
    ssh: {
      login: undefined,
      port: 22
    }
  }
  _.merge(data, opts || {})
  return data
}
