var util = require('util');

/**
 * Format the name of a queue key.
 *
 * @param {string} name
 * @returns {string}
 */

exports.formatList = function (name) {
  return util.format('queue:%s', name);
};

exports.formatSet = function (name) {
return util.format('unique:%s', name);
};