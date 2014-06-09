/**
 * Module dependencies.
 */

var TQueue = require('./queue');
var TWorker = require('./worker');

/**
 * Expose module.
 */

exports.createQueue = createQueue;
exports.createWorker = createWorker;

/**
 * Create a new queue.
 *
 * @param {string} name
 * @param {object} options
 * @param {boolean} options.unique
 * @param {object|function} options.redis
 */

function createQueue(name, options) {
  return new TQueue(name, options);
}

/**
 * Create a new worker.
 *
 * @param {TQueue} queue
 * @param {object} options
 * @param {number} options.batch
 * @param {string} options.name
 * @param {number} options.ping
 * @param {number} options.sleep
 * @param {object|function} options.redis
 * @param {string} options.type
 * @param {boolean} options.unique
 */

function createWorker(queue, options) {
  return new TWorker(queue, options);
}