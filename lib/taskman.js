/**
 * Module dependencies.
 */

const TQueue = require('./queue');
const TWorker = require('./worker');

/**
 * Expose module.
 */

exports.createQueue = createQueue;
exports.createWorker = createWorker;

/**
 * Create a new queue.
 *
 * @param {string} name Name of the task to process.
 * @param {object} options Options.
 * @param {object|function} options.redis Redis configuration.
 * @param {boolean} options.unique Unique queue or not (default false).
 */

function createQueue(name, options) {
  return new TQueue(name, options);
}

/**
 * Create a new worker.
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

function createWorker(name, options) {
  return new TWorker(name, options);
}