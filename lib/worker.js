/**
 * Module dependencies.
 */

var async = require('async');
var _ = require('lodash');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Expose module.
 */

exports.Worker = Worker;

/**
 * Create a new worker.
 *
 * @param {Queue} queue
 * @param {object} driver
 * @param {string} name Worker name
 * @param {function} action
 * @param {object} options
 */

function Worker(queue, driver, name, action, options) {
  EventEmitter.call(this);

  this.options = _.defaults(options || {}, {
    type: 'FIFO',
    loopSleepTime: 0,
    pauseSleepTime: 5,
    waitingTimeout: 1,
    dataPerTick: 1,
    expire: 17280000,
    timeout: 300000 // 5 minutes
  });

  this.queue = queue;
  this.driver = driver;
  this.action = action;
  this.completeName = this.queue.getName() + ':' + name;
  this.initialized = false;
}

util.inherits(Worker, EventEmitter);

/**
 * Constants.
 */

Worker.STATUS_STARTED = 'STARTED';
Worker.STATUS_PAUSED = 'PAUSE';
Worker.STATUS_WORKING = 'WORKING';
Worker.STATUS_WAITING = 'WAITING';
Worker.STATUS_SLEEPING = 'SLEEPING';
Worker.TYPE_FIFO = 'FIFO';
Worker.TYPE_LIFO = 'LIFO';

/**
 * Initialize the worker.
 *
 * @param {function} cb
 */

Worker.prototype.initialize = function (cb) {
  if (this.initialized) return cb();

  async.series([
    this.driver.initialize.bind(this.driver),
    this.setInfo.bind(this, 'waiting_timeout', this.options.waitingTimeout),
    this.setInfo.bind(this, 'loop_sleep', this.options.loopSleepTime),
    this.setInfo.bind(this, 'pause_sleep_time', this.options.pauseSleepTime),
    this.setInfo.bind(this, 'data_per_tick', this.options.dataPerTick),
    this.setInfo.bind(this, 'action', this.action.toString()),
    this.setInfo.bind(this, 'queue', this.queue.getName()),
    this.setInfo.bind(this, 'type', this.options.type),
    this.setInfo.bind(this, 'unique', +this.queue.options.unique),
    this.setInfo.bind(this, 'language', 'nodejs'),
    this.setInfo.bind(this, 'process_id', process.pid)
  ], function (err, res) {
    if (err) return cb(err);
    this.initialized = true;
    cb(null, res);
  }.bind(this));
};

/**
 * Start the worker.
 *
 * @param function callback
 */

Worker.prototype.start = function (cb) {
  var endDate = new Date(Date.now() + this.options.expire * 1000).toJSON();

  async.series([
    this.initialize.bind(this),
    this.setStatus.bind(this, Worker.STATUS_STARTED),
    this.setInfo.bind(this, 'end_date', endDate)
  ], function (err) {
    if (cb) cb(err);
    // the process is executed in an another tick to be sure that
    // the callback (asynchronous or synchronous) is executed
    process.nextTick(this.process.bind(this));
  }.bind(this));
};

/**
 * Pause the worker.
 *
 * @param {function} callback
 */

Worker.prototype.pause = function (cb) {
  this.initialize(this.setStatus.bind(this, Worker.STATUS_PAUSED, cb));
};

/**
 * Stop the worker.
 *
 * @param {function} callback
 */

Worker.prototype.stop = function (cb) {
  this.initialize(this.setInfo.bind(this, 'end_date', new Date().toJSON(), cb));
};

/**
 * Core process of the worker.
 */

Worker.prototype.process = function () {
  this.getInfos(function onGetInfos(err, infos) {
    if (err) this.emit('error', err);

    // close connexions if infos is empty or end_date is earlier than the current date
    if (! infos || ! infos.end_date || Date.now() > new Date(infos.end_date).getTime())
      return _.invoke([this.queue.driver, this.driver], 'close');

    // make process in pause
    if (infos.status === Worker.STATUS_PAUSED)
      return setTimeout(this.process.bind(this), infos.pause_sleep_time * 1000);

    var typeFunction = infos.type === Worker.TYPE_FIFO ? 'lpop' : 'rpop';

    // pop the queue
    this.queue[typeFunction](infos.data_per_tick, _.partialRight(this.pop.bind(this), infos));
  }.bind(this));
};

/**
 * Pop result from queue
 */

Worker.prototype.pop = function (err, result, infos) {
  var next;

  // Error or no result, set status to waiting and exit
  if (err || ! result[0]) {
    next = _.partial(setTimeout, this.process.bind(this), infos.waiting_timeout * 1000);
    return this.setStatus(Worker.STATUS_WAITING, next);
  }

  // Last callback
  var callback = function (err) {
    if (err) this.emit('job failure', err);
    else this.emit('job complete');

    if (infos.loop_sleep === 0) return this.process.call(this);

    // sleep between two processes
    next = _.partial(setTimeout, this.process.bind(this), infos.loop_sleep * 1000);
    this.setStatus(Worker.STATUS_SLEEPING, next);
  }.bind(this);


  // Launch action with a timeout control
  next = function () {
    var timedOut = false;

    var timeout = setTimeout(function onTimeout() {
      timedOut = true;
      callback(new Error('Timeout'));
    }, this.options.timeout);

    try {
      this.action(result, function onActionFinished() {
        if (timedOut) return ;
        clearTimeout(timeout);
        callback();
      }, this);
    } catch (err) {
      callback(err);
    }

  }.bind(this);

  // set status to working
  this.setStatus(Worker.STATUS_WORKING, next);
};

/**
 * Set the status of the worker.
 *
 * @param {string} status
 * @param {function} callback
 */

Worker.prototype.setStatus = function (status, callback) {
  this.driver.hset(this.completeName, 'status', status, function(err) {
    if (! err) this.emit('status change', status);
    if (callback) callback.apply(null, arguments);
  }.bind(this));

  var date = new Date().toJSON();

  this.driver.hset(this.completeName, 'status_changedate', date);

  if (status === Worker.STATUS_WORKING)
    this.driver.hincrby(this.completeName, 'cpt_action', 1);

  if (status === Worker.STATUS_STARTED) {
    this.driver.hset(this.completeName, 'cpt_action', 0);
    this.driver.hset(this.completeName, 'start_date', date);
  }
};

/**
 * Set worker information.
 *
 * @param {string} name
 * @param {string} value
 * @param {function} cb
 */

Worker.prototype.setInfo = function (name, value, cb) {
  this.driver.hset(this.completeName, name, value, cb);
};

/**
 * Get worker infos
 *
 * @param {function} cb
 */

Worker.prototype.getInfos = function (cb) {
  this.driver.hgetall(this.completeName, cb);
};