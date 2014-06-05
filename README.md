# node-taskman

[![Build Status](https://travis-ci.org/neoziro/node-taskman.svg?branch=master)](https://travis-ci.org/neoziro/node-taskman)
[![Dependency Status](https://david-dm.org/neoziro/node-taskman.svg?theme=shields.io)](https://david-dm.org/neoziro/node-taskman)
[![devDependency Status](https://david-dm.org/neoziro/node-taskman/dev-status.svg?theme=shields.io)](https://david-dm.org/neoziro/node-taskman#info=devDependencies)

node-taskman is a fast work queue based on redis.

It supports several features:

- worker configuration without restart needed
- take multiple tasks in one time
- unique queue

## Install

```
npm install node-taskman
```

## Usage

````js
var taskman = require('node-taskman');
var driver = new taskman.driver.RedisDriver();
var queue = new taskman.Queue('my-queue', driver);
var worker = new taskman.Worker(queue, driver, 'my-worker', function (data, callback) {
  // process task
  callback();
});

// Start the worker.
worker.start();

// Push a new task.
queue.rpush('some task');
````


### new RedisDriver(options)

Create a redis driver, currently the only driver supported by taskman.

Options avalaible are :

* `port` : Port, default is the redis port, so `6379`.
* `host` : Host, the host, default is `127.0.0.1`.
* `db` : The database, default is 0. The redis driver will perform a `select` in the initialization.
* `queuePrefix` : The queue prefix, default `queue`. If you name your queue "my_queue", the complete name will be "queue:my_queue".
* `workerPrefix` : The worker prefix, default `worker`. If you name your worker "my_worker", the complete name will be "worker:my_worker".

### new Queue(name, driver)

Create a new queue, with a `name` and a `driver`

* `name` : The name of the queue
* `driver` : The driver to use.

```js
var queue = new taskman.Queue('test', redisDriver);
```

### queue.rpush(data, callback)

Push a data at the end of the list.

* `data` : The data to push, only string is supported.

```js
queue.rpush('task', function (err) {
  // ...
});
```


### queue.lpush(data, callback)

Push a data at the beginning of the list.

* `data` : The data to push, only string is supported.

```js
queue.lpush('task', function (err) {
  // ...
});
```

### queue.llen(callback)

Count the number of element in the queue.

```js
queue.llen(function (err, count) {
  // ...
});
```

### new Worker(queue, driver, name, action, options)

Create a worker to take items of a queue and execute an action.

* `queue` : The `Queue` that will be processed.
* `driver` : The driver to use to stock informations of the worker.
* `name` : The name of the worker, to be identified.
* `action(data, callback, worker)` : A function called when a data is pop from the queue
   * `data` : An array of values get from the queue, the number of values is the same, but empty values are filled by null.
   * `callback` : The callback to call to trigger the next tick of the worker.
   * `worker` : The current worker instance.
* `options` : Options
   * `type` : FIFO or LIFO
   * `loopSleepTime` : The time in seconds to sleep between two tick, default `0`.
   * `pauseSleepTime` : The time in seconds to sleep between each tick in pause mode, default `5`.
   * `waitingTimeout` : The time in seconds to wait when the queue is empty, default `1`.
   * `dataPerTick` : The number of item popped from the queue, default `1`.
   * `expire` : Expire time in seconds, default `17280000` (200 days).
   * `unique` : A key can't be duplicated in queue, default `false`.
   * `timeout` : A timeout for the pop's action, default `300000` (5 minutes).

```js
var worker = new taskman.Worker(queue, driver, 'my-worker', function (data, callback) {
  // process task
  callback();
});
```

### worker.start(callback)

Start the worker.

```js
worker.start(function (err, res) {
  // ...
});
```

### worker.stop(callback)

Stop the worker.

```js
worker.stop(function (err, res) {
  // ...
});
``

### worker.pause(callback)

Pause the worker.

```js
worker.pause(function (err, res) {
  // ...
});
```

### worker.setInfo(name, value, callback)

Change an information in the worker.

* `name`: Name of the information
* `value`: Value of the information

```js
worker.setInfo('loop_sleep', 5, function (err, infos) {
  // ...
});
```

### worker.getInfos(callback)

Get all infos of the worker.

```js
worker.getInfos(function (err, infos) {
  // ...
});
```

## License

MIT

## Credits

Written and maintained by [Greg Bergé][neoziro] and [Justin Bourrousse][JBustin]

An original idea by [David Desbouis][desbouis].

Build an used on [Le Monde.fr](http://www.lemonde.fr).

[neoziro]: http://github.com/neoziro
[desbouis]: http://github.com/desbouis
[JBustin]: http://github.com/JBustin
