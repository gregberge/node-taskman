/**
 * Module dependencies.
 */

var _ = require('lodash');

/**
 * Expose module.
 */

exports.Queue = Queue;

/**
 * Create a new Queue.
 *
 * @param {string} name
 * @param {object} driver
 * @param {object} options
 */

function Queue(name, driver, options) {
  this.name = name;
  this.driver = driver;
  this.options = _.defaults(options || {}, {
    unique: false
  });

  this.initialized = false;
}

/**
 * Initialize queue.
 *
 * @param {function} cb
 */

Queue.prototype.initialize = function (cb) {
  if (this.initialized) return cb();

  this.driver.initialize(function (err) {
    if (err) return cb(err);
    this.initialized = true;
    cb();
  }.bind(this));
};

/**
 * Push data at the end of the list.
 *
 * @param {string} data
 * @param {function} cb
 */

Queue.prototype.rpush = function (data, cb) {
  if (! this.driver.uniquePush || ! this.options.unique)
    return this.initialize(function () {
      this.driver.rpush(this.name, data, cb);
    }.bind(this));

  this.initialize(
    this.driver.uniquePush.bind(this.driver, this.name, 'rpush', data, cb)
  );
};

/**
 * Push data at the beginning of the list
 *
 * @param {string} data
 * @param {function} cb
 */

Queue.prototype.lpush = function (data, cb) {
  if (! this.driver.uniquePush || ! this.options.unique)
    return this.initialize(function () {
      this.driver.lpush(this.name, data, cb);
    }.bind(this));

  this.initialize(
    this.driver.uniquePush.bind(this.driver, this.name, 'lpush', data, cb)
  );
};

/**
 * Remove and get the number of element specified at the beginning of a queue
 * FIFO: First In First Out
 * @param {number} num
 * @param {function} cb
 */

Queue.prototype.lpop = function (num, cb) {
  if (! this.driver.uniquePop || ! this.options.unique)
    return this.initialize(function () {
      this.driver.lpop(this.name, num, cb);
    }.bind(this));

  this.initialize(
    this.driver.uniquePop.bind(this.driver, this.name, 'lpop', num, cb)
  );
};

/**
 * Remove and get the end of the queue
 * LIFO : Last In First Out
 *
 * @param {number} num
 * @param {function} cb
 */

Queue.prototype.rpop = function (num, cb) {
  if (! this.driver.uniquePop || ! this.options.unique)
    return this.initialize(function () {
      this.driver.rpop(this.name, num, cb);
    }.bind(this));

  this.initialize(
    this.driver.uniquePop.bind(this.driver, this.name, 'rpop', num, cb)
  );
};

/**
 * Get the size of the current queue.
 *
 * @param {function} callback
 */

Queue.prototype.llen = function (callback){
  this.initialize(function () {
    this.driver.llen(this.name, callback);
  }.bind(this));
};

/**
 * Get the name of the current queue.
 *
 * @return string Name of the queue
 */

Queue.prototype.getName = function () {
  return this.name;
};