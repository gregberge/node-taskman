var _ = require('lodash');

/**
 * Queue
 * Add element to a queue, to consume them with a worker in future
 */

/**
 * Create queue
 * @param string name Queue name
 * @param object driver Driver
 */
var Queue = function( name, driver) {
  this.name = name;
  this.driver = driver;

  this.initialized = false;
};

/**
 * Initialize queue
 * @param function callback Callback
 */
Queue.prototype.initialize = function (callback) {
  if (this.initialized)
    return callback();

  this.driver.initialize(_.bind(function () {
    this.initialized = true;
    callback();
  }, this));
};

/**
 * Push data at the end of the list
 * @param string data
 */
Queue.prototype.rpush = function (data, callback) {
  this.initialize(_.bind(function () {
    this.driver.rpush(this.name, data, callback);
  }, this));
};

/**
 * Push data at the beginning of the list
 * @param string data
 */
Queue.prototype.lpush = function (data, callback) {
  this.initialize(_.bind(function () {
    this.driver.lpush(this.name, data, callback);
  }, this));
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * FIFO : First In First Out
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.lpop = function (number, callback) {
  this.initialize(_.bind(function () {
    this.driver.lpop(this.name, number, callback);
  }, this));
};

/**
 * Remove and get the end of the queue
 * LIFO : Last In First Out
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.rpop = function (number, callback) {
  this.initialize(_.bind(function () {
    this.driver.rpop(this.name, number, callback);
  }, this));
};

/**
 * Get the size of the current queue
 * @param function callback Callback
 */
Queue.prototype.llen = function (callback){
  this.initialize(_.bind(function () {
    this.driver.llen(this.name, callback);
  }, this));
};

/**
 * Get the name of the current queue
 * @return string Name of the queue
 */
Queue.prototype.getName = function () {
  return this.name;
};

exports.Queue = Queue;