/**
 * Module dependencies.
 */

var os = require('os');
var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var redis = require('./redis');
var workerKey = require('./keys/worker');
var wrapCallback = require('./util').wrapCallback;
var pipeEvent = require('./util').pipeEvent;
var TQueue = require('./queue');

/**
 * Expose module.
 */

module.exports = TWorker;

/**
 * Create a new taskman worker.
 *
 * @param {string} name Name of the task to process.
 * @param {object} options Options.
 * @param {number} options.batch Number of tasks popped in each tick (default 1).
 * @param {string} options.name Name of the worker (default os.hostname()).
 * @param {number} options.ping Internal ping interval in ms (default 1000).
 * @param {number} options.sleep Sleep time between each tick in ms (default 0).
 * @param {object|function} options.redis Redis configuration.
 * @param {string} options.type Type of worker, 'fifo' or 'lifo' (default 'fifo').
 * @param {boolean} options.unique Unique queue or not (default false).
 */

function TWorker(name, options) {
  EventEmitter.call(this);

  this.queue = new TQueue(name, options);
  this.options = options = _.defaults(options || {}, {
    batch: 1,
    name: os.hostname(),
    ping: 1000,
    sleep: 0,
    redis: {},
    type: 'fifo'
  });
  _.extend(this, _.pick(options, 'batch', 'name', 'ping', 'sleep', 'type'));

  this.redis = redis.createClient(options.redis);

  pipeEvent('error', this.redis, this);
}

util.inherits(TWorker, EventEmitter);

/**
 * Update worker informations.
 *
 * @param {object} obj
 * @param {function} cb
 * @api public
 */

TWorker.prototype.set = function (obj, cb) {
  var hash = workerKey.formatHash(this.queue.name, this.name);
  obj.updatedAt = new Date().toJSON();

  this.redis.hmset(hash, obj, wrapCallback(this, cb));
};

/**
 * Get worker informations.
 *
 * @param {string} [key]
 * @param {function} cb
 * @api public
 */

TWorker.prototype.get = function (key, cb) {
  var hash = workerKey.formatHash(this.queue.name, this.name);

  // get(cb)
  if (_.isFunction(key)) {
    cb = key;
    return this.redis.hgetall(hash, cb);
  }

  this.redis.hget(hash, key, wrapCallback(this, cb));
};

/**
 * Start processing.
 *
 * @param {function} cb
 */

TWorker.prototype.process = function (cb) {
  this.taskCount = 0;
  this.action = cb;
  this.set({
    createdAt: new Date().toJSON(),
    pid: process.pid,
    batch: this.batch,
    ping: this.ping,
    sleep: this.sleep,
    type: this.type,
    taskCount: this.taskCount,
    status: 'started'
  }, this.loop.bind(this));
};

/**
 * Core loop of the worker.
 */

TWorker.prototype.loop = function () {
  var worker = this;

  async.series([
    function fetch(next) {
      worker.fetch(next);
    },
    function updateInfos(next) {
      worker.set({status: 'waiting'}, next);
    },
    function process(next) {
      worker.queue.pop(worker.type, worker.batch, function (err, res) {
        if (err) return next(err);
        if (! res) return setTimeout(next, worker.ping);
        worker.set({status: 'working', taskCount: ++worker.taskCount});
        worker.action(res, next);
      });
    }
  ], function (err) {
    if (err) {
      worker.emit('error', err);
      return setTimeout(worker.loop.bind(worker), worker.ping);
    }
    setTimeout(worker.loop.bind(worker), worker.sleep);
  });
};

/**
 * Fetch and update worker informations from redis.
 *
 * @param {function} cb
 */

TWorker.prototype.fetch = function (cb) {
  this.get(function (err, infos) {
    if (err) return wrapCallback(this, cb)(err);
    this.batch = +infos.batch;
    this.ping = +infos.ping;
    this.sleep = +infos.sleep;
    this.type = infos.type;
    wrapCallback(this, cb)();
  }.bind(this));
};

/**
 * Gracefully shutdown worker.
 *
 * @param {object} [options]
 * @param {boolean} options.queue Close the worker queue (default true).
 * @param {function} [cb] Optional callback.
 * @api public
 */

TWorker.prototype.close = function (options, cb) {
  // close(cb)
  if (_.isFunction(options)) {
    cb = options;
    options = null;
  }

  options = _.defaults(options || {}, {queue: true});

  var actions = [this.redis.quit.bind(this.redis)];
  if (options.queue) actions.push(this.queue.close.bind(this.queue));

  async.parallel(actions, wrapCallback(this, cb));
};