/**
 * Module dependencies.
 */

var util = require('util');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var async = require('async');
var redis = require('./redis');
var parser = require('./parsers/json');
var queueKey = require('./keys/queue');
var wrapCallback = require('./util').wrapCallback;
var pipeEvent = require('./util').pipeEvent;

/**
 * Expose module.
 */

module.exports = TQueue;

/**
 * Create a new queue.
 *
 * @param {string} name Name of the task to process.
 * @param {object} options Options.
 * @param {object|function} options.redis Redis configuration.
 * @param {boolean} options.unique Unique queue or not (default false).
 */

function TQueue(name, options) {
  EventEmitter.call(this);

  this.name = name;
  this.options = options = _.defaults(options || {}, {
    redis: {},
    unique: false
  });

  this.redis = redis.createClient(options.redis);

  pipeEvent('error', this.redis, this);
}

util.inherits(TQueue, EventEmitter);

/**
 * Push a data at the end of the list.
 *
 * @param {*} data
 * @param {function} cb
 * @api public
 */

TQueue.prototype.push = function (data, cb) {
  if (this.options.unique) this.uniquePush(data, cb);
  else this.nonUniquePush(data, cb);
};

/**
 * Non-unique version of push.
 *
 * @param {*} data
 * @param {function} cb
 */

TQueue.prototype.nonUniquePush = function (data, cb) {
  async.waterfall([
    function formatData(next) {
      parser.format(data, next);
    },
    function pushData(data, next) {
      this.redis.rpush(queueKey.formatList(this.name), data, next);
    }.bind(this)
  ], wrapCallback(this, cb));
};

/**
 * Unique version of push.
 *
 * @param {*} data
 * @param {function} cb
 */

TQueue.prototype.uniquePush = function (data, cb) {
  var queue = this;
  var list = queueKey.formatList(queue.name);
  var set = queueKey.formatSet(queue.name);

  async.series([
    function watch(next) {
      queue.redis.watch(list, set, next);
    },
    tryPush,
    function unwatch(next) {
      queue.redis.unwatch(next);
    }
  ], wrapCallback(queue, cb));

  /**
   * Push data in the queue and in the set.
   *
   * @param {function} cb
   */

  function tryPush(cb) {
    async.waterfall([
      function formatData(next) {
        parser.format(data, next);
      },
      function exists(formattedData, next) {
        queue.redis.sismember(set, formattedData, function (err, exists) {
          next(err, exists, formattedData);
        });
      },
      function push(exists, formattedData, next) {
        if (exists) return next();

        var multi = queue.redis.multi();
        multi.sadd(set, formattedData);
        multi.rpush(list, formattedData);
        multi.exec(function (err, res) {
          if (err) return next(err);

          // Transaction has fail, we restart it.
          if (! res) return queue.uniquePush(data, next);

          next();
        });
      }
    ], cb);
  }
};

/**
 * Pop a data from the queue.
 *
 * @param {string} type fifo or lifo
 * @param {number} count
 * @param {function} cb
 */

TQueue.prototype.pop = function (type, count, cb) {
  if (this.options.unique) this.uniquePop(type, count, cb);
  else this.nonUniquePop(type, count, cb);
};

/**
 * Non-unique version of pop.
 *
 * @param {string} type fifo or lifo
 * @param {number} count
 * @param {function} cb
 */

TQueue.prototype.nonUniquePop = function (type, count, cb) {
  var fn = type === 'fifo' ? 'lpop' : 'rpop';
  var list = queueKey.formatList(this.name);

  async.waterfall([
    function popData(next) {
      var commands = _.map(new Array(count), function (value, index) {
        // First time it's blocking.
        if (index === 0) return this.redis['b' + fn].bind(this.redis, list, 0);

        return this.redis[fn].bind(this.redis, list);
      }, this);

      async.parallel(commands, next);
    }.bind(this),
    function parseData(data, next) {
      async.map(data, function (data, cb) {
        // Handle blpop and brpop results.
        if (_.isArray(data)) data = data[1];

        parser.parse(data, cb);
      }, next);
    }
  ], wrapCallback(this, cb));
};

/**
 * Unique version of pop.
 *
 * @param {string} type fifo or lifo
 * @param {number} count
 * @param {function} cb
 */

TQueue.prototype.uniquePop = function (type, count,cb) {
  var queue = this;
  var list = queueKey.formatList(queue.name);
  var set = queueKey.formatSet(queue.name);
  var fn = type === 'fifo' ? 'lpop' : 'rpop';

  async.waterfall([
    function watch(next) {
      queue.redis.watch(list, set, function (err) {
        next(err);
      });
    },
    tryPop,
    function unwatch(data, next) {
      queue.redis.unwatch(function (err) {
        next(err, data);
      });
    }
  ], wrapCallback(queue, cb));

  /**
   * Pop data from the queue and remove value from set.
   *
   * @param {function} cb
   */

  function tryPop(cb) {
    async.waterfall([
      function getData(next) {
        queue.redis.lindex(list, -1, next);
      },
      function pop(data, next) {
        if (! data) return next(null, null);

        var multi = queue.redis.multi();
        multi.srem(set, data);
        for (var i = 0; i < count; i++) multi[fn](list);
        multi.exec(function (err, res) {
          if (err) return next(err);

          // Transaction has fail, we restart it.
          if (! res) return queue.uniquePop(type, count, next);

          async.map(_.rest(res), parser.parse, next);
        });
      }
    ], cb);
  }
};

/**
 * Gracefully shutdown queue.
 *
 * @param {function} [cb] Optional callback.
 * @api public
 */

TQueue.prototype.close = function (cb) {
  this.redis.quit(wrapCallback(this, cb));
};