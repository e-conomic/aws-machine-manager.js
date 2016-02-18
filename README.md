# aws-machine-manager.js
[![Build Status](https://travis-ci.org/e-conomic/aws-machine-manager.js.svg?branch=master)](https://travis-ci.org/e-conomic/aws-machine-manager.js)
[![Coverage Status](https://coveralls.io/repos/github/e-conomic/aws-machine-manager.js/badge.svg?branch=master)](https://coveralls.io/github/e-conomic/aws-machine-manager.js?branch=master)
[![Dependency Status](https://david-dm.org/e-conomic/aws-machine-manager.js.svg)](https://david-dm.org/e-conomic/aws-machine-manager.js)

Module for managing machines that are backed by aws instances,
and are stored as MongoDB entries for custom per-instance information.

## Install
    npm install e-conomic/aws-machine-manager.js

## Usage
Example of spawning a machine,
printing information about its instance,
and terminating it:

    var AMM = require("./")

    var amm = new AMM({
      key: "***",
      secret: "***"
    })

    amm.spawn({name: "foo"})
      .then(function (machine) {
        console.log("id:", machine.instanceId)
        return machine.getInst()
      })
      .then(function (instance) {
        console.log("instance details:", instance)
      })
      .then(function () {
        return amm.terminate("foo")
      })
      .done()

## Mocked
If you rely on this package and want to test against its behavior
use the [mocked-aws-machine-manager](https://github.com/e-conomic/mocked-aws-machine-manager.js) package
to pass around fake data.
