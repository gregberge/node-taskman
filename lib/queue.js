/**
 * Module dependencies.
 */

const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const async = require('async');
const pipeEvent = require('pipe-event');
const redis = require('./redis');
const parser = require('./parsers/json');
const queueKey = require('./keys/queue');
const wrapCallback = require('./util').wrapCallback;

/**
 * Create a new queue.
 *
 * @param {string} name Name of the task to process.
 * @param {object} options Options.
 * @param {object|function} options.redis Redis configuration.
 * @param {boolean} options.unique Unique queue or not (default false).
 */

class TQueue extends EventEmitter {
  constructor(name, options) {
    super();
    this.name = name;
    this.options = options = _.defaults(options || {}, {
      redis: {},
      unique: false,
    });

    this.redis = redis.createClient(options.redis);

    pipeEvent('error', this.redis, this);
  }

  /**
   * Push a data at the end of the list.
   *
   * @param {*} data
   * @param {function} cb
   * @api public
   */

  push(data, cb) {
    const queue = this;
    cb = wrapCallback(this, cb);

    function done(err) {
      if (err) return cb(err);
      queue.emit('created', data);
      cb();
    }

    if (this.options.unique) this.uniquePush(data, done);
    else this.nonUniquePush(data, done);
  }

  /**
   * Non-unique version of push.
   *
   * @param {*} data
   * @param {function} cb
   */

  nonUniquePush(data, cb) {
    async.waterfall(
      [
        function formatData(next) {
          parser.format(data, next);
        },
        function pushData(data, next) {
          this.redis.rpush(queueKey.formatList(this.name), data, next);
        }.bind(this),
      ],
      wrapCallback(this, cb)
    );
  }

  /**
   * Unique version of push.
   *
   * @param {*} data
   * @param {function} cb
   */

  uniquePush(data, cb) {
    const queue = this;
    const list = queueKey.formatList(queue.name);
    const set = queueKey.formatSet(queue.name);

    async.series(
      [
        function watch(next) {
          queue.redis.watch(list, set, next);
        },
        tryPush,
        function unwatch(next) {
          queue.redis.unwatch(next);
        },
      ],
      wrapCallback(queue, cb)
    );

    /**
     * Push data in the queue and in the set.
     *
     * @param {function} cb
     */

    function tryPush(cb) {
      async.waterfall(
        [
          function formatData(next) {
            parser.format(data, next);
          },
          function exists(formattedData, next) {
            queue.redis.sismember(set, formattedData, function(err, exists) {
              next(err, exists, formattedData);
            });
          },
          function push(exists, formattedData, next) {
            if (exists) return next();

            const multi = queue.redis.multi();
            multi.sadd(set, formattedData);
            multi.rpush(list, formattedData);
            multi.exec(function(err, res) {
              if (err) return next(err);

              // Transaction has fail, we restart it.
              if (!res) return queue.uniquePush(data, next);

              next();
            });
          },
        ],
        cb
      );
    }
  }

  /**
   * Pop a data from the queue.
   *
   * @param {string} type fifo or lifo
   * @param {number} batch
   * @param {function} cb
   */

  pop(type, batch, cb) {
    if (this.options.unique) this.uniquePop(type, batch, cb);
    else this.nonUniquePop(type, batch, cb);
  }

  /**
   * Non-unique version of pop.
   *
   * @param {string} type fifo or lifo
   * @param {number} batch
   * @param {function} cb
   */

  nonUniquePop(type, batch, cb) {
    const queue = this;
    const fn = type === 'fifo' ? 'lpop' : 'rpop';
    const list = queueKey.formatList(this.name);

    async.waterfall(
      [
        function popData(next) {
          queue.redis['b' + fn](list, 0, function(err, res) {
            if (err) return next(err);

            const data = [res];
            const multi = queue.redis.multi();

            for (let i = 1; i < batch; i++) multi[fn](list);

            multi.exec(function(err, res) {
              if (err) return next(err);
              next(null, data.concat(res));
            });
          });
        },
        function parseData(data, next) {
          async.map(
            data,
            function(data, cb) {
              // Handle blpop and brpop results.
              if (_.isArray(data)) data = data[1];

              parser.parse(data, cb);
            },
            next
          );
        },
      ],
      wrapCallback(this, cb)
    );
  }

  /**
   * Unique version of pop.
   *
   * @param {string} type fifo or lifo
   * @param {number} batch
   * @param {function} cb
   */

  uniquePop(type, batch, cb) {
    const queue = this;
    const list = queueKey.formatList(queue.name);
    const set = queueKey.formatSet(queue.name);
    const fn = type === 'fifo' ? 'lpop' : 'rpop';

    async.waterfall(
      [
        function watch(next) {
          queue.redis.watch(list, set, function(err) {
            next(err);
          });
        },
        tryPop,
        function unwatch(data, next) {
          queue.redis.unwatch(function(err) {
            next(err, data);
          });
        },
      ],
      wrapCallback(queue, cb)
    );

    /**
     * Pop data from the queue and remove value from set.
     *
     * @param {function} cb
     */

    function tryPop(cb) {
      async.waterfall(
        [
          function getLength(next) {
            queue.redis.llen(list, next);
          },
          function getData(length, next) {
            if (batch >= length)
              return queue.redis.lrange(list, 0, length, next);

            const start = type === 'fifo' ? 0 : length - batch;
            const end = type === 'fifo' ? batch - 1 : length;

            return queue.redis.lrange(list, start, end, next);
          },
          function pop(data, next) {
            if (!data.length) return next(null, null);

            const multi = queue.redis.multi();

            multi.srem(set, data);
            for (let i = 0; i < data.length; i++) {
              multi[fn](list);
            }

            return multi.exec(function(err, res) {
              if (err) return next(err);

              // Transaction has fail, we restart it.
              if (!res) return queue.uniquePop(type, batch, next);

              return async.map(_.tail(res), parser.parse, next);
            });
          },
        ],
        cb
      );
    }
  }

  /**
   * Gracefully shutdown queue.
   *
   * @param {function} [cb] Optional callback.
   * @api public
   */

  close(cb) {
    this.redis.quit(wrapCallback(this, cb));
  }
}

/**
 * Expose module.
 */

module.exports = TQueue;
