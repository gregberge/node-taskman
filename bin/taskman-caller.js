var taskman = require('../index'),
    optimist = require('optimist');

var argv = optimist
.options('a', {
  alias: 'action',
  describe: 'The script to execute, with ##data## as json data',
  demand: true
})
.options('timeout', {
  describe: 'The timeout of the action in milliseconds',
  demand: false
})
.options('w', {
  alias: 'worker',
  describe: 'The name of the worker',
  demand: true
})
.options('o', {
  alias: 'worker-options',
  describe: 'Options of the worker in json',
  demand: false
})
.options('q', {
  alias: 'queue',
  describe: 'The name of the queue',
  demand: true
})
.options('p', {
  alias: 'port',
  describe: 'The redis port',
  demand: false
})
.options('h', {
  alias: 'host',
  describe: 'The redis host',
  demand: false
})
.options('database', {
  describe: 'The redis database',
  demand: false
})
.options('s', {
  alias: 'simple',
  describe: 'The simple mode, only one data without an array is pop',
  demand: false
})
.options('output', {
  describe: 'Transfer stdout from action',
  demand: false
})
.argv;

var child_process = require('child_process'),
    options = {},
    driverConfig = {},
    workerOptions = {};

if(argv.timeout)
  options.timeout = ~~(argv.timeout + 0.5);

if (argv.port)
  driverConfig.port = argv.port;

if (argv.host)
  driverConfig.host = argv.host;

if (argv.database)
  driverConfig.db = argv.database;

var driver = new taskman.driver.RedisDriver(driverConfig),
    queue = new taskman.Queue(argv.queue, driver);

if(argv.o)
  workerOptions = JSON.parse(argv.o);

if(argv.s)
  workerOptions.dataPerTick = 1;

var worker = new taskman.Worker(queue, driver, argv.worker, function (data, callback) {
  var jsonData = argv.s ? data[0].replace(/"/g, '\\"') : JSON.stringify(data).replace(/"/g, '\\"'),
      action = argv.action.replace(/##data##/g, jsonData);

  child_process.exec(action, options, function (error, stdout) {
    if(argv.output)
      console.log(stdout);

    callback();
  });
}, workerOptions);

worker.start();