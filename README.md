node-taskman
============

node-taskman is a node.js implementation of taskman worker.

Taskman is a system of worker which work with a queue and a hash in redis, so we can pilot it directly in redis console or via other languages.
It support FIFO and LIFO, we can set an end date, get multiple data in one time, etc...

node-taskman is simple to use !
-------------------------------

````javascript
var taskman = require("node-taskman"), driver, queue, worker;

driver = new taskman.driver.RedisDriver();
queue = new taskman.Queue("test_queue", driver);

worker = new taskman.Worker(queue, driver, "test_worker", function(data, callback){
   console.log(data);
   callback();
});

queue.rpush("Hello World", function(){
   worker.start();
});
````

methods
=======

new RedisDriver(options)
------------------------

To be continue.

installation
============

To be continued.

other implementations
=====================

Soon :)
