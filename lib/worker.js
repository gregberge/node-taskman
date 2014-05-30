'use strict';

var async = require('async');
var _ = require('lodash');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Worker
 * Pop a queue to execute some task
 */


/**
 * Create worker
 * @param Queue queue Queue
 * @param object driver Driver
 * @param string name Worker name
 * @param function action Action
 * @param object options Options
 */
function Worker (queue, driver, name, action, options) {
  EventEmitter.call(this);

  this.options = _.extend({
    type: 'FIFO',
    loopSleepTime: 0,
    pauseSleepTime: 5,
    waitingTimeout: 1,
    dataPerTick: 1,
    expire: 17280000,
    unique: false
  }, options);

  this.queue = queue;
  this.driver = driver;
  this.action = action;
  this.completeName = this.queue.getName() + ':' + name;
  this.initialized = false;
  this.queue.unique = !! this.options.unique;
}

util.inherits(Worker, EventEmitter);

/**
 * Status "STARTED"
 * @type string
 */
Worker.STATUS_STARTED = 'STARTED';

/**
 * Status "PAUSED"
 * @type string
 */
Worker.STATUS_PAUSED = 'PAUSE';

/**
 * Status "WORKING"
 * @type string
 */
Worker.STATUS_WORKING = 'WORKING';

/**
 * Status "WAITING"
 * @type string
 */
Worker.STATUS_WAITING = 'WAITING';

/**
 * Status "SLEEPING"
 * @type string
 */
Worker.STATUS_SLEEPING = 'SLEEPING';

/**
 * Type "FIFO"
 * @type string
 */
Worker.TYPE_FIFO = 'FIFO';

/**
 * Type "LIFO"
 * @type string
 */
Worker.TYPE_LIFO = 'LIFO';

/**
 * Initialize the worker
 */
Worker.prototype.initialize = function (callback) {
  if (this.initialized)
    return callback();

  async.series([
    this.driver.initialize.bind(this.driver),
    this.setWaitingTimeout.bind(this, this.options.waitingTimeout),
    this.setLoopSleepTime.bind(this, this.options.loopSleepTime),
    this.setPauseSleepTime.bind(this, this.options.pauseSleepTime),
    this.setDataPerTick.bind(this, this.options.dataPerTick),
    this.setAction.bind(this, this.action),
    this.setQueue.bind(this, this.queue.getName()),
    this.setType.bind(this, this.options.type),
    this.setLanguage.bind(this),
    this.setProcessId.bind(this)
  ], function (err, res) {
    if (err) return callback(err);
    this.initialized = true;
    callback(null, res);
  }.bind(this));
};

/**
 * Start the worker
 * @param function callback Callback
 */
Worker.prototype.start = function (callback) {
  var endDate = new Date(Date.now() + (this.options.expire * 1000)).toJSON();

  async.series([
    this.initialize.bind(this),
    this.setStatus.bind(this, Worker.STATUS_STARTED),
    this.setEndDate.bind(this, endDate)
  ], function (err) {
    // main callback is executed before the process
    // cause we want to be able to change status
    (callback || _.noop)(err);
    // the process is executed in an another tick to be sure that
    // the callback (asynchronous or synchronous) is executed
    process.nextTick(this.process.bind(this));
  }.bind(this));
};

/**
 * Pause the worker
 * @param function callback Callback
 */
Worker.prototype.pause = function (callback) {
  this.initialize(this.setStatus.bind(this, Worker.STATUS_PAUSED, callback));
};

/**
 * Stop the worker
 * @param function callback Callback
 */
Worker.prototype.stop = function (callback) {
  this.initialize(this.setEndDate.bind(this, new Date(), callback));
};

/**
 * Process of the worker
 */
Worker.prototype.process = function () {
  this.getInfos(function (err, infos) {

    // close connexions if infos is empty or end_date is earlier than the current date
    if (! infos || ! infos.end_date || Date.now() > new Date(infos.end_date).getTime())
      return _.invoke([this.queue.driver, this.driver], 'close');

    // make process in pause
    if(infos.status === Worker.STATUS_PAUSED)
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

  if (err) return;

  // no result, set status to waiting
  if (! result[0]) {
    next = _.partial(setTimeout, this.process.bind(this), infos.waiting_timeout * 1000);
    return this.setStatus(Worker.STATUS_WAITING, next);
  }

  // last callback
  var callback = function () {
    this.emit('job complete');
    if (infos.loop_sleep === 0) return this.process.call(this);

    // sleep between two processes
    next = _.partial(setTimeout, this.process.bind(this), infos.loop_sleep * 1000);
    this.setStatus(Worker.STATUS_SLEEPING, next);
  }.bind(this);

  // launch action
  next = _.partial(this.action, result, callback, this);

  // set status to working
  this.setStatus(Worker.STATUS_WORKING, next);
};

/**
 * Set the status of the worker
 * @param string status Worker status
 * @param function callback Callback
 */
Worker.prototype.setStatus = function (status, callback) {
  this.driver.hset(this.completeName, 'status', status, function(err) {
    if (! err) this.emit('status change', status);
    if (callback) callback.apply(null, arguments);
  }.bind(this));

  var date = (new Date()).toJSON();

  this.driver.hset(this.completeName, 'status_changedate', date);

  if (status === Worker.STATUS_WORKING)
    this.driver.hincrby(this.completeName, 'cpt_action', 1);

  if (status === Worker.STATUS_STARTED) {
    this.driver.hset(this.completeName, 'cpt_action', 0);
    this.driver.hset(this.completeName, 'start_date', date);
  }
};

/**
 * Set the end date
 * @param string date Date in format JSON
 * @param function callback Callback
 */
Worker.prototype.setEndDate = function (date, callback) {
  this.driver.hset(this.completeName, 'end_date', date, callback);
};

/**
 * Set the loop sleep time of the worker
 * @param number time Time in seconds
 * @param function callback Callback
 */
Worker.prototype.setLoopSleepTime = function (time, callback) {
  this.driver.hset(this.completeName, 'loop_sleep', time, callback);
};

/**
 * Set the pause sleep time of the worker
 * @param number time Time in seconds
 * @param function callback Callback
 */
Worker.prototype.setPauseSleepTime = function (time, callback) {
  this.driver.hset(this.completeName, 'pause_sleep_time', time, callback);
};

/**
 * Set the number of data to get per tick
 * @param number number Data per tick
 * @param function callback Callback
 */
Worker.prototype.setDataPerTick = function (number, callback) {
  this.driver.hset(this.completeName, 'data_per_tick', number, callback);
};


/**
 * Set the waiting timeout of the worker
 * @param number timeout Timeout in seconds
 * @param function callback Callback
 */
Worker.prototype.setWaitingTimeout = function (timeout, callback) {
  this.driver.hset(this.completeName, 'waiting_timeout', timeout, callback);
};

/**
 * Set the action of the worker
 * @param function action Action
 * @param function callback Callback
 */
Worker.prototype.setAction = function (action, callback) {
  this.action = action;
  this.driver.hset(this.completeName, 'action', action.toString(), callback);
};

/**
 * Set the queue name of the worker
 * @param string queue Queue
 * @param function callback Callback
 */
Worker.prototype.setQueue = function (queue, callback) {
  this.driver.hset(this.completeName, 'queue', queue, callback);
};

/**
 * Set the type of the worker (FIFO, LIFO)
 * @param string type Type
 * @param function callback Callback
 */
Worker.prototype.setType = function (type, callback) {
  this.driver.hset(this.completeName, 'type', type, callback);
};

/**
 * Set the language to "nodejs"
 * @param function callback Callback
 */
Worker.prototype.setLanguage = function (callback) {
  this.driver.hset(this.completeName, 'language', 'nodejs', callback);
};

/**
 * Set the pid
 * @param function callback Callback
 */
Worker.prototype.setProcessId = function (callback) {
  this.driver.hset(this.completeName, 'process_id', process.pid, callback);
};

/**
 * Return the complete name of the worker
 * @return string The complete name of the worker
 */
Worker.prototype.getCompleteName = function() {
  return this.driver.getCompleteWorkerName(this.completeName);
};

/**
 * Get worker infos
 * @param function callback Callback
 */
Worker.prototype.getInfos = function (callback) {
  this.driver.hgetall(this.completeName, callback);
};


exports.Worker = Worker;
