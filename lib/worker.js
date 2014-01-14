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
    expire: 17280000
  }, options);

  this.queue = queue;
  this.driver = driver;
  this.action = action;
  this.completeName = this.queue.getName() + ':' + name;
  this.initialized = false;
};

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

  var count = 8,
  inc = _.bind(function(err, res) {
    if (err)
      return callback(err, res);

    count --;

    if (count === 0) {
      this.initialized = true;
      return callback(err, res);
    }
  }, this);

  this.driver.initialize(_.bind(function () {
    this.setWaitingTimeout(this.options.waitingTimeout, inc);
    this.setLoopSleepTime(this.options.loopSleepTime, inc);
    this.setPauseSleepTime(this.options.pauseSleepTime, inc);
    this.setDataPerTick(this.options.dataPerTick, inc);
    this.setAction(this.action, inc);
    this.setType(this.options.type, inc);
    this.setLanguage(inc);
    this.setProcessId(inc);
  }, this));
};

/**
 * Start the worker
 * @param function callback Callback
 */
Worker.prototype.start = function (callback) {
  this.initialize(_.bind(function () {
    this.setStatus(Worker.STATUS_STARTED, callback);

    var endDate = new Date(new Date().getTime() + (this.options.expire * 1000)).toJSON();
    this.setEndDate(endDate);

    this.process();
  }, this));
};

/**
 * Pause the worker
 * @param function callback Callback
 */
Worker.prototype.pause = function (callback) {
  this.initialize(_.bind(function () {
    this.setStatus(Worker.STATUS_PAUSED, callback);
  }));
};

/**
 * Stop the worker
 * @param function callback Callback
 */
Worker.prototype.stop = function (callback) {
  this.initialize(_.bind(function() {
    this.setEndDate(null, callback);
  }));
};

/**
 * Process of the worker
 */
Worker.prototype.process = function () {
  this.getInfos(_.bind(function (err, infos) {
    if (! infos.end_date || new Date().getTime() > new Date(infos.end_date).getTime()) {
      this.queue.driver.close();
      this.driver.close();
      return ;
    }

    if(infos.status === Worker.STATUS_PAUSED) {
      var pauseTime = infos.pause_sleep_time * 1000;
      Worker.prototype.setEndDate(new Date(new Date().getTime() + pauseTime).toJSON());
      setTimeout(_.bind(this.process, this), pauseTime);
      return ;
    }

    var typeFunction = infos.type === Worker.TYPE_FIFO ? 'lpop' : 'rpop';

    this.queue[typeFunction](infos.data_per_tick, _.bind(function (err, result) {

      if (! result[0]) {
        setTimeout(_.bind(this.process, this), infos.waiting_timeout * 1000);
        this.setStatus(Worker.STATUS_WAITING);
        return ;
      }

      var callback = _.bind(function () {
        this.emit('job complete');
        if(infos.loop_sleep === 0)
          return this.process.call(this);

        setTimeout(_.bind(this.process, this), infos.loop_sleep * 1000);
        this.setStatus(Worker.STATUS_SLEEPING);
      }, this);

      this.setStatus(Worker.STATUS_WORKING);
      this.action.call(null, result, callback, this);
    }, this));
  }, this));
};

/**
 * Set the status of the worker
 * @param string status Worker status
 * @param function callback Callback
 */
Worker.prototype.setStatus = function (status, callback) {
  var worker = this;

  this.driver.hset(this.completeName, 'status', status, function() {
    worker.emit('status change', status);
    if (callback) {
      callback.call(null, arguments);
    }
  });

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
