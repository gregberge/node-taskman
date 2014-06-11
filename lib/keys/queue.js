var util = require('util');

/**
 * Format the name of a the queue list.
 *
 * @param {string} name
 * @returns {string}
 */

exports.formatList = function (name) {
  return util.format('queue:%s', name);
};

/**
 * Format the name of the unique queue set.
 *
 * @param {string} name
 * @returns {string}
 */

exports.formatSet = function (name) {
  return util.format('unique:%s', name);
};