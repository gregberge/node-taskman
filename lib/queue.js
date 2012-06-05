/**
 * Queue
 * Add element to a queue, to consume them with a worker in future
 */

/**
 * Create queue
 * @param string name Queue name
 * @param object driver Driver
 */
var Queue = function(name, driver)
{
   this.name = name;
   this.driver = driver;
   
   this.initialized = false;
};

/**
 * Initialize queue
 * @param function callback Callback
 */
Queue.prototype.initialize = function(callback)
{
   if(this.initialized)
   {
      callback();
      return ;
   }
      
   var k = this;
   
   this.driver.initialize(function(){
      k.initialized = true;
      callback();
   });
};

/**
 * Push data at the end of the list
 * @param string data
 */
Queue.prototype.rpush = function(data, callback)
{
   var k = this;
   this.initialize(function(){
      k.driver.rpush(k.name, data, callback);
   });
};

/**
 * Push data at the beginning of the list
 * @param string data
 */
Queue.prototype.lpush = function(data, callback)
{
   var k = this;
   this.initialize(function(){
      k.driver.lpush(k.name, data, callback);
   });
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * FIFO : First In First Out
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.lpop = function(number, callback)
{
   var k = this;
   this.initialize(function(){
      k.driver.lpop(k.name, number, callback);
   });
};

/**
 * Remove and get the end of the queue
 * LIFO : Last In First Out
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.rpop = function(number, callback)
{
   var k = this;
   this.initialize(function(){
      k.driver.rpop(k.name, number, callback);
   });
};

/**
 * Get the size of the current queue
 * @param function callback Callback
 */
Queue.prototype.llen = function(callback)
{
   var k = this;
   this.initialize(function(){
      k.driver.llen(k.name, callback);
   });
};

/**
 * Get the name of the current queue
 * @return string Name of the queue
 */
Queue.prototype.getName = function()
{
   return this.name;
};

exports.Queue = Queue;