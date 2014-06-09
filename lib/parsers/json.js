/**
 * Format data into string.
 *
 * @param {*} data
 * @param {function} cb
 */

exports.format = function encoder(data, cb) {
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
 * @param {mixed} data
 * @param {function} cb
 */

exports.parse = function decoder(data, cb) {
  var err;

  if (typeof data !== 'string') return cb(err, data);

  try {
    data = JSON.parse(data);
  } catch (e) {
    err = e;
  }

  cb(err, data);
};