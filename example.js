var node_taskman = require("./index");

var config = {db: 3};

var driver = new node_taskman.driver.RedisDriver(config);

var queue = new node_taskman.Queue("test", driver);

var action = function(data){console.log(data);};

var options = {waitingTimeout: 20};

var worker = new node_taskman.Worker(queue, driver, action, options);

console.log(worker);



//var queue = new node_taskman.Queue();

/*
var Worker = require("./lib/index").Worker,
    RedisDriver = require('./lib/driver/redis').RedisDriver;

var config = {port: 6379, host: "localhost", db: 3};
var driver = new RedisDriver(config);
var options = {waitTime : 100, sleepTime: 1000, multiNumber: 2};
var worker = new Worker("notify:apn", test, driver, options);
worker.start();
*/