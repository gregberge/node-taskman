exports.Worker = require('./lib/worker').Worker;
exports.Queue = require('./lib/queue').Queue;
exports.driver = {
  RedisDriver: require('./lib/driver/redis').RedisDriver,
  MemoryDriver: require('./lib/driver/memory').MemoryDriver
};