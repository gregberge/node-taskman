/**
 * Queue
 * Add element to a queue, to consume them with a worker in future
 */

/**
 * Create queue
 * @param string queue Queue
 * @param object driver Driver
 */
var Queue = function(queue, driver)
{
   this.queue = queue;
   this.driver = driver;
};

/**
 * Initialize queue
 * @param function callback Callback
 */
Queue.prototype.initialize = function(callback)
{
   this.driver.initialize(callback);
};

/**
 * Push data at the end of the list
 * @param string data
 */
Queue.prototype.rpush = function(data, callback)
{
   this.driver.rpush(this.queue, data, callback);
};

/**
 * Push data at the beginning of the list
 * @param string data
 */
Queue.prototype.lpush = function(data, callback)
{
   this.driver.lpush(this.queue, data, callback);
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.lpop = function(number, callback)
{
   this.driver.lpop(this.queue, number, callback);
};

/**
 * Remove and get the end of the queue
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.rpop = function(number, callback)
{
   this.driver.rpop(this.queue, number, callback);
};

/**
 * Get the size of the current queue
 * @param function callback Callback
 */
Queue.prototype.llen = function(callback)
{
   this.driver.llen(this.queue, callback);
};

/**
 * Get the name of the current queue
 * @return string Name of the queue
 */
Queue.prototype.getName = function()
{
   return this.queue;
};

exports.Queue = Queue;