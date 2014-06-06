'use strict';

var _ = require('lodash');
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
  async.series([
    this.client.watch.bind(this.client, this.getCompleteQueueName(queue), this.getUniqueSetName(queue)),
    this.transactionnalPush.bind(this, queue, type, data),
    this.client.unwatch.bind(this.client)
  ], function (err, replies) {
    // in case of error, we relaunch the push in an other tick
    if (err) return process.nextTick(this.uniquePush.bind(this, queue, type, data, callback));
    return callback(null, replies[1]);
  }.bind(this));
};

/**
 * Transactionnal push
 * @param string queue Queue
 * @param string type lpush or rpush
 * @param string data
 * @param callback
 */
RedisDriver.prototype.transactionnalPush = function (queue, type, data, callback) {
  this.client.sismember(this.getUniqueSetName(queue), this.shasum(data), function (err, exists) {
    if (err) return callback(err);
    if (!! exists) return callback(null, 0);

    // sadd and pop in the same transaction
    var multi = this.client.multi();
    multi.sadd(this.getUniqueSetName(queue), this.shasum(data));
    multi[type](this.getCompleteQueueName(queue), data);

    multi.exec(function (err, replies) {
      if (err) return callback(err);
      return callback(null, replies[1]);
    });
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
  async.series([
    this.client.watch.bind(this.client, this.getCompleteQueueName(queue)),
    this.transactionnalPop.bind(this, queue, type),
    this.client.unwatch.bind(this.client)
  ], function (err, replies) {
    if (err) return callback(err);
    return callback(null, replies[1]);
  });
};

/**
 * Transactionnal pop
 * @param string queue Queue
 * @param string type lpop or rpop
 * @param callback
 */
RedisDriver.prototype.transactionnalPop = function (queue, type, callback) {
  async.waterfall([
    this.client.lindex.bind(this.client, this.getCompleteQueueName(queue), -1),
    function (data, callback) {
      if (! data) return callback(null, null);

      // sadd and pop in the same transaction
      var multi = this.client.multi();
      multi[type](this.getCompleteQueueName(queue));
      multi.srem(this.getUniqueSetName(queue), this.shasum(data));

      multi.exec(callback);
    }.bind(this)
  ],function (err, replies) {
    if (err) return callback(err);
    return callback(null, (replies || [])[0] || null);
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