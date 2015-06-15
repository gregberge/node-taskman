/**
 * Module dependencies.
 */

var _ = require('lodash');
var redis = require('redis');

/**
 * Create a new redis client.
 *
 * @param {object|function} options
 */

exports.createClient = function (options) {
  options = options || {};

  if (_.isFunction(options))
    return options();

  return redis.createClient(
    options.port || 6379,
    options.host || '127.0.0.1',
    _.omit(options, 'port', 'host')
  );
};
