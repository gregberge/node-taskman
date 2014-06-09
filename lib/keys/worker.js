var util = require('util');

/**
 * Format the name of a worker key.
 *
 * @param {string} queueName
 * @param {string} workerName
 * @returns {string}
 */

exports.formatHash = function (queueName, workerName) {
  return util.format('worker:%s:%s', queueName, workerName);
};