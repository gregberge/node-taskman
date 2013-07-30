/**
 * Memory driver
 */
var MemoryDriver = function () {};

/**
 * Initialization
 * @param function callback Callback
 */
MemoryDriver.prototype.initialize = function (callback) {
  if (! this.initialized) {
    this.workers = {};
    this.queues = {};
    this.initialized = true;
  }

  if (callback)
    callback(null);
};

/**
 * Increments a key of a worker
 * @param worker Worker
 * @param key Key
 * @param number Number
 * @param callback Cabllack
 */
MemoryDriver.prototype.hincrby = function (worker, key, number, callback) {
  this.workers[worker] = this.workers[worker] || {};
  this.workers[worker][key] += number;

  if (callback)
    callback(null);
};

/**
 * Set a data in the worker
 * @param string worker Worker
 * @param string key Key
 * @param mixed data Data
 * @param function callback Callback
 */
MemoryDriver.prototype.hset = function (worker, key, data, callback) {
  this.workers[worker] = this.workers[worker] || {};
  this.workers[worker][key] = data;

  if (callback)
    callback(null);
};

/**
 * Get all property of a worker
 * @param string worker Worker
 * @param function callback Callback
 */
MemoryDriver.prototype.hgetall = function (worker, callback) {
  if (callback)
    callback(null, this.workers[worker]);
};

/**
 * Push data at the beginning of the list
 * @param string queue Queue
 * @param string data Data
 * @param function callback Callback
 */
MemoryDriver.prototype.lpush = function (queue, data, callback) {
  this.queues[queue] = this.queues[queue] || [];
  this.queues[queue].unshift(data);

  if (callback)
    callback(null);
};

/**
 * Push data at the end of the list
 * @param string queue
 * @param string data
 * @param function callback
 */
MemoryDriver.prototype.rpush = function (queue, data, callback) {
  this.queues[queue] = this.queues[queue] || [];
  this.queues[queue].push(data);

  if (callback)
    callback(null);
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * FIFO : First In First Out
 * @param string queue Queue
 * @param number number Number
 * @param function callback Callback
 */
MemoryDriver.prototype.lpop = function (queue, number, callback) {
  this.queues[queue] = this.queues[queue] || [];

  var data = [];

  for (var i = 0; i < number; i++) {
    var item = this.queues[queue].shift();

    if (item)
      data.push(item);
  }

  if (callback)
    callback(null, data);
};

/**
 * Remove and get the end of the queue
 * LIFO : Last In First Out
 * @param string queue Queue
 * @param number number Numb
 * @param function callback Callback
 */
MemoryDriver.prototype.rpop = function (queue, number, callback) {
  this.queues[queue] = this.queues[queue] || [];

  var data = [];

  for (var i = 0; i < number; i++) {
    var item = this.queues[queue].pop();

    if (item)
      data.push(item);
  }

  if (callback)
    callback(null, data);
};

/**
 * Return the size of the queue
 * @param string queue Queue
 * @param function callback Callback
 */
MemoryDriver.prototype.llen = function (queue, callback) {
  this.queues[queue] = this.queues[queue] || [];

  if (callback)
    callback(null, this.queues[queue].length);
};

/**
 * Close the connection
 * @param function callback Callback
 */
MemoryDriver.prototype.close = function () {
  // Do nothing
};

exports.MemoryDriver = MemoryDriver;