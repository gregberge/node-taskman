var taskman = require("../index"),
    optimist = require("optimist");

var argv = optimist
.options('a', {
   alias : 'action',
   describe : 'The script to execute, with ##data## as json data',
   demand : true
})
.options('timeout', {
   describe : 'The timeout of the action in milliseconds',
   demand : false
})
.options('w', {
   alias : 'worker',
   describe : 'The name of the worker',
   demand : true
})
.options('o', {
   alias : 'worker-options',
   describe : 'Options of the worker in json',
   demand : false
})
.options('q', {
   alias : 'queue',
   describe : 'The name of the queue',
   demand : true
})
.options('p', {
   alias : 'port',
   describe : 'The redis port',
   demand : false
})
.options('h', {
   alias : 'host',
   describe : 'The redis host',
   demand : false
})
.options('s', {
   alias : 'simple',
   describe : 'The simple mode, only one data without an array is pop',
   demand : false
})
.argv;

var child_process = require('child_process'),
action, jsonData, workerOptions = {}, driver, queue, worker, options = {};

if(argv.timeout)
{
   options.timeout = ~~(argv.timeout + 0.5);
}

driver = new taskman.driver.RedisDriver();
queue = new taskman.Queue(argv.queue, driver);

if(!argv.s && argv.o)
   workerOptions = JSON.parse(argv.o);

   worker = new taskman.Worker(queue, driver, argv.worker, function(data, callback){
   
   if(argv.s)
      jsonData = data[0];
   else
      jsonData = JSON.stringify(data).replace(/"/g, "\\\"");
   
   action = argv.action.replace(/##data##/g, jsonData);
   
   child_process.exec(action, options, function(error, stdout, stderr){
      console.log(stdout);
      callback();
   });
}, workerOptions);

worker.start();
