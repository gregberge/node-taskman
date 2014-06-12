/**
 * Format data into string.
 *
 * @param {*} data
 * @param {function} cb
 */

exports.format = function (data, cb) {
  var err;

  try {
    data = JSON.stringify(data);
  } catch (e) {
    err = e;
  }

  cb(err, data);
};

/**
 * Parse data.
 *
 * @param {*} data
 * @param {function} cb
 */

exports.parse = function (data, cb) {
  var err;

  if (typeof data !== 'string') return cb(null, data);

  try {
    data = JSON.parse(data);
  } catch (e) {
    err = e;
  }

  cb(err, data);
};