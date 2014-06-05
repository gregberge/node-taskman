'use strict';

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
var Queue = function(name, driver, options) {
  this.name = name;
  this.driver = driver;
  this.options = _.defaults(options || {}, {
    unique: false
  });
  this.initialized = false;
};

/**
 * Initialize queue
 * @param function callback Callback
 */
Queue.prototype.initialize = function (callback) {
  if (this.initialized)
    return callback();

  this.driver.initialize(function () {
    this.initialized = true;
    callback();
  }.bind(this));
};

/**
 * Push data at the end of the list
 * @param string data
 */
Queue.prototype.rpush = function (data, callback) {
  if (! this.driver.uniquePush || ! this.options.unique)
    return this.initialize(function () {
      this.driver.rpush(this.name, data, callback);
    }.bind(this));

  this.initialize(
    this.driver.uniquePush.bind(this.driver, this.name, 'rpush', data, callback)
  );
};

/**
 * Push data at the beginning of the list
 * @param string data
 */
Queue.prototype.lpush = function (data, callback) {
  if (! this.driver.uniquePush || ! this.options.unique)
    return this.initialize(function () {
      this.driver.lpush(this.name, data, callback);
    }.bind(this));

  this.initialize(
    this.driver.uniquePush.bind(this.driver, this.name, 'lpush', data, callback)
  );
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * FIFO : First In First Out
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.lpop = function (number, callback) {
  if (! this.driver.uniquePop || ! this.options.unique)
    return this.initialize(function () {
      this.driver.lpop(this.name, number, callback);
    }.bind(this));

  this.initialize(
    this.driver.uniquePop.bind(this.driver, this.name, 'lpop', number, callback)
  );
};

/**
 * Remove and get the end of the queue
 * LIFO : Last In First Out
 * @param number number Number
 * @param function callback Callback
 */
Queue.prototype.rpop = function (number, callback) {
  if (! this.driver.uniquePop || ! this.options.unique)
    return this.initialize(function () {
      this.driver.rpop(this.name, number, callback);
    }.bind(this));

  this.initialize(
    this.driver.uniquePop.bind(this.driver, this.name, 'rpop', number, callback)
  );
};

/**
 * Get the size of the current queue
 * @param function callback Callback
 */
Queue.prototype.llen = function (callback){
  this.initialize(function () {
    this.driver.llen(this.name, callback);
  }.bind(this));
};

/**
 * Get the name of the current queue
 * @return string Name of the queue
 */
Queue.prototype.getName = function () {
  return this.name;
};

exports.Queue = Queue;