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
