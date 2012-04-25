var deferred = require("deferred"),
    Worker = require("./lib/index").Worker,
    RedisDriver = require('./lib/driver/redis').RedisDriver;

var test = function(data, callback)
{
   console.log(data);
   callback();
};

var driver = new RedisDriver(6379, 'arnold.lemonde-interactif.fr', 3);
var options = {waitTime : 100, sleepTime: 30};
var worker = new Worker("notify:apn", test, driver, options);
worker.start();