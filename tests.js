var vows = require("vows"),
    assert = require("assert"),
    node_taskman = require("./index");

var driver, config;

vows.describe("Redis Driver").addBatch( {
   
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
}).run(); // Run it