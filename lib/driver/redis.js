var redis = require("redis");

/**
 * Redis driver implementation
 */
var RedisDriver = function(config)
{
   if(!config)
      config = {};
   
   this.port = config.port || null;
   this.host = config.host || null;
   this.queuePrefix = config.queuePrefix || "queue:";
   this.workerPrefix = config.workerPrefix || "worker:";
   this.db = config.db || undefined;
   this.client = null;
   this.initialized = false;
};

/**
 * Initialization
 * @param function callback Callback
 */
RedisDriver.prototype.initialize = function(callback)
{
   if(this.initialized)
   {
      callback();
      return ;
   }
   
   this.client = redis.createClient(this.port, this.host);

   if(this.db === undefined)
   {
      callback();
   }
   else
   {
      var k = this;
      
      this.client.select(this.db, function(err, res)
      {
         k.initialized = true;
         callback(err, res);
      });
   }
};

/**
 * Get complete worker name
 * @param string worker Worker
 * @return string Complete worker name
 */
RedisDriver.prototype.getCompleteWorkerName = function(worker)
{
   return this.workerPrefix + worker;
};

/**
 * Increments a key of a worker
 * @param worker Worker
 * @param key Key
 * @param number Number
 * @param callback Cabllack
 */
RedisDriver.prototype.hincrby = function(worker, key, number, callback)
{
   this.client.hincrby(this.getCompleteWorkerName(worker), key, number, callback);
};

/**
 * Set a data in the worker
 * @param string worker Worker
 * @param string key Key
 * @param mixed data Data
 * @param function callback Callback
 */
RedisDriver.prototype.hset = function(worker, key, data, callback)
{
   this.client.hset(this.getCompleteWorkerName(worker), key, data, callback);
};

/**
 * Get all property of a worker
 * @param string worker Worker
 * @param function callback Callback
 */
RedisDriver.prototype.hgetall = function(worker, callback)
{
   this.client.hgetall(this.getCompleteWorkerName(worker), callback);
};

/**
 * Get complete queue name
 * @param string queue Queue
 * @return string Complete queue name
 */
RedisDriver.prototype.getCompleteQueueName = function(queue)
{
   return this.queuePrefix + queue;
};

/**
 * Push data at the beginning of the list
 * @param string queue Queue
 * @param string data Data
 * @param function callback Callback
 */
RedisDriver.prototype.lpush = function(queue, data, callback)
{
   this.client.lpush(this.getCompleteQueueName(queue), data, callback || undefined);
};

/**
 * Push data at the end of the list
 * @param string queue
 * @param string data
 * @param function callback
 */
RedisDriver.prototype.rpush = function(queue, data, callback)
{
   this.client.rpush(this.getCompleteQueueName(queue), data, callback || undefined);
};

/**
 * Generic function to pop element of a queue
 * @param string redisFunction
 * @param string queue
 * @param number number
 * @param function callback Callback
 */
RedisDriver.prototype.pop = function(redisFunction, queue, number, callback)
{
   var replies = [], i, count = 0;
   
   for(i = 0; i < number; i++)
   {
      count ++;
      
      this.client[redisFunction](queue, function(err, rep){
         replies.push(rep);
         
         if(err) callback(err, rep);
         
         count--;
         
         if(count === 0)
            callback(null, replies);
      });
   }
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * FIFO : First In First Out
 * @param string queue Queue
 * @param number number Number
 * @param function callback Callback
 */
RedisDriver.prototype.lpop = function(queue, number, callback)
{
   return this.pop("lpop", this.getCompleteQueueName(queue), number, callback);
};

/**
 * Remove and get the end of the queue
 * LIFO : Last In First Out
 * @param string queue Queue
 * @param number number Numb
 * @param function callback Callback
 */
RedisDriver.prototype.rpop = function(queue, number, callback)
{
   return this.pop("rpop", this.getCompleteQueueName(queue), number, callback);
};

/**
 * Return the size of the queue
 * @param string queue Queue
 * @param function callback Callback
 */
RedisDriver.prototype.llen = function(queue, callback)
{
   this.client.llen(this.getCompleteQueueName(queue), callback);
};

exports.RedisDriver = RedisDriver;