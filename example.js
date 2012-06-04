var taskman = require("./index"), driver, queue, worker;

driver = new taskman.driver.RedisDriver();
queue = new taskman.Queue("test_queue", driver);

worker = new taskman.Worker(queue, driver, "test_worker", function(data, callback){
   console.log(data);
   callback();
});

queue.rpush("Hello World", function(){
   worker.start();
});