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

/**
 * Pipe an event from an event emitter to another.
 *
 * @param {string} event
 * @param {EventEmitter} source
 * @param {EventEmitter} target
 */

exports.pipeEvent = function (event, source, target) {
  source.on(event, function () {
    target.emit.apply(target, [event].concat(_.toArray(arguments)));
  });
};