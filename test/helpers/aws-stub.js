"use strict";
var _ = require("lodash")
var Q = require("q")
var sinon = require("sinon")

module.exports = function (stub, returns /*, ...*/) {
  var extra_returns = Array.prototype.slice.call(arguments).slice(2)
  var promiseStub = getPromiseStub(returns, extra_returns)
  stub.returns({promise: promiseStub})
  return stub
}

var getPromiseStub = function (returns, extra_returns) {
  if (!extra_returns) extra_returns = []

  var promiseStub = sinon.stub()
  if (!extra_returns.length) {
    promiseStub.returns(getPromiseReturnValue(returns))
  } else {
    returns = [returns].concat(extra_returns)
    for (var i = 0; i < returns.length; i++) {
      var val = returns[i]
      promiseStub.onCall(i).returns(getPromiseReturnValue(val))
    }
  }
  return promiseStub
}

var getPromiseReturnValue = function (val) {
  if (_.isError(val)) return Q.reject(val)
  return Q.resolve({data: val})
}
