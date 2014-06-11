/**
 * Module dependencies.
 */

var _ = require('lodash');

/**
 * Wrap a callback and send an error event if not defined.
 *
 * @param {EventEmitter} emitter
 * @param {function} cb
 */

exports.wrapCallback = function (emitter, cb) {
  return function (err) {
    if (_.isFunction(cb)) cb.apply(null, arguments);
    else if (err) emitter.emit('error', err);
  };
};