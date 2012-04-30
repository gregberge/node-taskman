var Worker = require("./lib/index").Worker,
    RedisDriver = require('./lib/driver/redis').RedisDriver;

var test = function(data, callback)
{
   console.log(data);
   callback();
};

var config = {port: 6379, host: "localhost", db: 3};
var driver = new RedisDriver(config);
var options = {waitTime : 100, sleepTime: 1000, multiNumber: 2};
var worker = new Worker("notify:apn", test, driver, options);
worker.start();