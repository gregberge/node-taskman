'use strict';

var redis = require('redis');
var crypto = require('crypto');
var async = require('async');

// Constants for unique mode SET
var SEPARATOR = ':';
var PREFIX_UNIQUE_SET = 'unique_set';

/**
 * Redis driver implementation
 */
var RedisDriver = function (config) {
  config = config || {};

  this.port = config.port;
  this.host = config.host;
  this.queuePrefix = config.queuePrefix || 'queue:';
  this.workerPrefix = config.workerPrefix || 'worker:';
  this.db = config.db;
  this.client = null;
  this.initialized = false;
};

/**
 * Initialization
 * @param function callback Callback
 */
RedisDriver.prototype.initialize = function (callback) {
  if (this.initialized) return callback();

  this.client = this.client || redis.createClient(this.port, this.host);
  this.client.select(this.db);
  this.initialized = true;
  callback();
};

/**
 * Get complete worker name
 * @param string worker Worker
 * @return string Complete worker name
 */
RedisDriver.prototype.getCompleteWorkerName = function (worker) {
  return this.workerPrefix + worker;
};

/**
 * Increments a key of a worker
 * @param worker Worker
 * @param key Key
 * @param number Number
 * @param callback Cabllack
 */
RedisDriver.prototype.hincrby = function (worker, key, number, callback) {
  this.client.hincrby(this.getCompleteWorkerName(worker), key, number, callback);
};

/**
 * Set a data in the worker
 * @param string worker Worker
 * @param string key Key
 * @param mixed data Data
 * @param function callback Callback
 */
RedisDriver.prototype.hset = function (worker, key, data, callback) {
  this.client.hset(this.getCompleteWorkerName(worker), key, data, callback);
};

/**
 * Get a data in the worker
 * @param string worker Worker
 * @param string key Key
 * @param function callback Callback
 */
RedisDriver.prototype.hget = function (worker, key, callback) {
  this.client.hget(this.getCompleteWorkerName(worker), key, callback);
};

/**
 * Get all property of a worker
 * @param string worker Worker
 * @param function callback Callback
 */
RedisDriver.prototype.hgetall = function (worker, callback) {
  this.client.hgetall(this.getCompleteWorkerName(worker), callback);
};

/**
 * Get complete queue name
 * @param string queue Queue
 * @return string Complete queue name
 */
RedisDriver.prototype.getCompleteQueueName = function (queue) {
  return this.queuePrefix + queue;
};

/**
 * Push data at the beginning of the list
 * @param string queue Queue
 * @param string data Data
 * @param function callback Callback
 */
RedisDriver.prototype.lpush = function (queue, data, callback) {
  this.client.lpush(this.getCompleteQueueName(queue), data, callback);
};

/**
 * Push data at the end of the list
 * @param string queue
 * @param string data
 * @param function callback
 */
RedisDriver.prototype.rpush = function (queue, data, callback) {
  this.client.rpush(this.getCompleteQueueName(queue), data, callback);
};

/**
 * Generic function to pop element of a queue
 * @param string redisFunction
 * @param string queue
 * @param number number
 * @param function callback Callback
 */
RedisDriver.prototype.pop = function (redisFunction, queue, number, callback) {
  async.timesSeries(
    number,
    function (n, callback) {
      this.client[redisFunction](queue, callback);
    }.bind(this),
    callback);
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * FIFO : First In First Out
 * @param string queue Queue
 * @param number number Number
 * @param function callback Callback
 */
RedisDriver.prototype.lpop = function (queue, number, callback) {
  this.pop('lpop', this.getCompleteQueueName(queue), number, callback);
};

/**
 * Remove and get the end of the queue
 * LIFO : Last In First Out
 * @param string queue Queue
 * @param number number Numb
 * @param function callback Callback
 */
RedisDriver.prototype.rpop = function (queue, number, callback) {
  this.pop('rpop', this.getCompleteQueueName(queue), number, callback);
};

/**
 * Return the size of the queue
 * @param string queue Queue
 * @param function callback Callback
 */
RedisDriver.prototype.llen = function (queue, callback) {
  this.client.llen(this.getCompleteQueueName(queue), callback);
};

/**
 * Close the connection
 * @param function callback Callback
 */
RedisDriver.prototype.close = function (callback) {
  this.client.quit(callback);
};





// UNIQUE MODE


/**
 * Unique mode : push in set
 * @param string queue Queue
 * @param string type lpush or rpush
 * @param string data
 * @param callback
 */
RedisDriver.prototype.uniquePush = function (queue, type, data, callback) {
  this.exists(queue, data, function (err, exists) {
    if (err) return callback(err);
    if (exists) return callback(null, 0);
    this[type](queue, data, callback);
  }.bind(this));
};

/**
 * Unique mode : pop
 * @param string queue Queue
 * @param string type lpop or rpop
 * @param number number
 * @param function callback Callback
 */
RedisDriver.prototype.uniquePop = function (queue, type, number, callback) {
  async.timesSeries(
    number,
    function (n, callback) {
      this.atomicUniquePop(queue, type, callback);
    }.bind(this),
    callback);
};

/**
 * Unique mode : atomic pop
 * @param string queue Queue
 * @param string type lpop or rpop
 * @param callback
 */
RedisDriver.prototype.atomicUniquePop = function (queue, type, callback) {
  var data;

  async.waterfall([
    this[type].bind(this, queue, 1),
    function (_data, callback) {
      data = (_data || [])[0];

      if (! data) return callback();

      this.client.srem(this.getUniqueSetName(queue), this.shasum(data), function (err) {
        if (! err) return callback();
        // error of hdel, push the data in the queue
        this[type === 'rpop' ? 'rpush' : 'lpush'](queue, data);
        // data to send for the current pop
        data = null;

        callback(null);
      }.bind(this));
    }.bind(this)
  ], function (err) {
    if (err) return callback(err);
    callback(null, data || null);
  });
};

/**
 * Unique mode : check if exists in set
 * @param string queue Queue
 * @param string data
 * @param callback
 */
RedisDriver.prototype.exists = function (queue, data, callback) {
  this.client.sadd(this.getUniqueSetName(queue), this.shasum(data), function (err, count) {
    if (err) return callback(err);
    callback(null, count === 0);
  });
};

/**
 * Unique mode : create a shasum
 * @param string data
 */
RedisDriver.prototype.shasum = function (data) {
  var shasum = crypto.createHash('sha256');
  shasum.update(data);
  return shasum.digest('base64');
};

/**
 * Unique mode : Get unique queue name
 * @param string queue Queue
 * @return string Unique queue name
 */
RedisDriver.prototype.getUniqueSetName = function (queue) {
  return PREFIX_UNIQUE_SET + SEPARATOR + this.getCompleteQueueName(queue);
};


exports.RedisDriver = RedisDriver;