var Worker = require("./lib/index").Worker,
    RedisDriver = require('./lib/driver/redis').RedisDriver;

var test = function(data, callback)
{
   console.log(data);
   callback();
};

var config = {port: 6379, host: "arnold.lemonde-interactif.fr", db: 3};
var driver = new RedisDriver(config);
var options = {waitTime : 100, sleepTime: 30};
var worker = new Worker("notify:apn", test, driver, options);
worker.start();