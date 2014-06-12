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

  if (_.isFunction(options)) return options();

  return redis.createClient(
    options.port,
    options.host,
    _.omit(options, 'port', 'host')
  );
};