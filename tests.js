var vows = require("vows"),
    assert = require("assert"),
    node_taskman = require("./index");

vows.describe("Taskman").addBatch( {
   
    "when instantiate whith no port, no host": {
        topic: function () {
           config = {db: 3};
           driver = new node_taskman.driver.RedisDriver(config);
           
           queue = new node_taskman.Queue("test", driver);
           
           return driver;
        },

        "we get :": { 
           "a null port : ": function (topic) {
              assert.equal (topic.port, null);
           },
           "a null host : ": function (topic) {
              assert.equal (topic.host, null);
           }
        }
    },
    
    'when we initialize': {
       
       topic: function () {
          queue.initialize(this.callback);
       },
       
       'there is no error': function (err, result) {
           assert.equal (err, null);
           assert.equal (result, 'OK');
       }
    },
    
    "when we reset redis ": {
       
       topic : function(){
          driver.client.del("queue:test", this.callback);
       },
       
       "it's good !" : function(err, result){
          assert.equal(err, null);
       }
    },
    
    'when we rpush': {
       
       topic: function () {
          queue.rpush("hello", this.callback);
       },
       
       'we get a good result': function (err, result) {
           assert.equal (err, null);
           assert.equal (result, 1);
       }
    },
    
    'when we lpush': {
       
       topic: function () {
          queue.lpush("world", this.callback);
       },
       
       'we get a good result': function (err, result) {
           assert.equal (err, null);
           assert.equal (result, 2);
       }
    },
    
    'when we llen': {
       
       topic: function () {
           queue.llen(this.callback);
       },
       
       'we get a good result': function (err, result) {
           assert.equal (err, null);
           assert.equal (result, 2);
       }
    },
    
    'when we lpop': {
       
       topic: function () {
          queue.lpop(1, this.callback);
       },
       
       'we get a good result': function (err, result) {
           assert.equal (result[0], "world");
       }
    },
    
    'when we rpop': {
       
       topic: function () {
          queue.rpop(1, this.callback);
       },
       
       'we get a good result': function (err, result) {
           assert.equal (result[0], "hello");
       }
    }
})
.addBatch( {
   
   "when instantiate ": {
       topic: function () {
          worker = new node_taskman.Worker(queue, driver, "worker1", function(){}, {waitingTimeout: 3000});
          return worker;
       },

       "we get :": { 
          "a default option : ": function (topic) {
             assert.equal (topic.options.waitingTimeout, 3000);
          },
          "an extend option : ": function (topic) {
             assert.equal (topic.options.type, 'FIFO');
          }
       }
   },
   
   "when we start": {
      topic : function() {
         worker.start(this.callback);
      },
      
      "it's started and initialized :" : function(err){
         assert.equal(worker.initialized, true);
      }
   },
   
   "when we instanciate with an action": {
      topic : function() {
         var k = this;
         queue2 = new node_taskman.Queue("test2", driver);
         
         queue2.rpush("hello", function(err, res){
            worker2 = new node_taskman.Worker(queue2, driver, "worker2", function(data, cb, w){k.callback(data, cb, w);});
            worker2.start();
         });
      },
      
      "it's called with good arguments :" : function(data, callback, w) {
            assert.equal (data[0], "hello");
            assert.equal(typeof callback, "function");
            assert.equal(w, worker2);
         }
   }
})
.run(); // Run it