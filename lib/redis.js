/**
 * Module dependencies.
 */

const _ = require('lodash');
const redis = require('redis');

/**
 * Create a new redis client.
 *
 * @param {object|function} options
 */

exports.createClient = (options) => {
  options = options || {};

  if (_.isFunction(options))
    return options();

  return redis.createClient(
    options.port || 6379,
    options.host || '127.0.0.1',
    _.omit(options, 'port', 'host')
  );
};
