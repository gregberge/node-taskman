# node-taskman

[![Build Status](https://travis-ci.org/neoziro/node-taskman.svg?branch=master)](https://travis-ci.org/neoziro/node-taskman)
[![Dependency Status](https://david-dm.org/neoziro/node-taskman.svg?theme=shields.io)](https://david-dm.org/neoziro/node-taskman)
[![devDependency Status](https://david-dm.org/neoziro/node-taskman/dev-status.svg?theme=shields.io)](https://david-dm.org/neoziro/node-taskman#info=devDependencies)

node-taskman is a fast work queue based on redis.

Core features:

- [atomicity](#atomicity)
- [persistence](#persistence)
- [hot configuration](#hot-configuration)
- [unique tasks](#unique-tasks)
- [multi tasks processing](#multi-tasks-processing)

## Install

```
npm install node-taskman
```

## Usage

````js
var taskman = require('node-taskman');

// Process tasks.
var worker = taskman.createWorker('email');
worker.process(function sendEmail(emails, done) {
  // send emails
  done();
});

// Create tasks.
var queue = taskman.createQueue('email');
queue.push({to: 'hello@world.com', body: 'Hello world!'});
````

### Worker

#### taskman.createWorker(name, options)

Create a new worker to process tasks.

Arguments:

```
  {string} name Name of the task to process.
  {object} options Options.
  {number} options.batch Number of tasks popped in each tick (default 1).
  {string} options.name Name of the worker (default os.hostname()).
  {number} options.ping Internal ping interval in ms (default 1000).
  {number} options.sleep Sleep time between each tick in ms (default 0)   
  {object|function} options.redis Redis configuration.
  {string} options.type Type of worker, 'fifo' or 'lifo' (default 'fifo').
  {boolean} options.unique Unique queue or not (default false).
```

```js
// Create a new worker that sleep 2s between each task.
var worker = taskman.createWorker('email', {sleep: 2000});
```

#### worker.process(action)

Process tasks. The action has two arguments, first is the tasks, the number depends of the batch option. The second is the callback, if it's called with an error, a "job failure" event is emitted, else a "job complete" event is emitted.

```js
worker.process(function (tasks, done) {
 // process tasks
});
```


#### worker.set(options, [callback])

Update options of the worker.

Arguments:

```
  {object} options Options.
  {number} options.batch Number of tasks popped in each tick.
  {number} options.ping Internal ping interval in ms.
  {number} options.sleep Sleep time between each tick in ms.
  {object|function} options.redis Redis configuration.
  {string} options.type Type of worker, 'fifo' or 'lifo'.
  {function} [callback] Optional callback.
```

```js
// Put worker in lifo mode.
worker.set({type: 'lifo'});
```


#### worker.get(callback)

Get informations about the worker.

```js
worker.get(function (err, infos) {
  console.log(infos); // worker infos
});
```

#### worker.close([options], [callback])

Gracefully stop the worker.

Arguments:

```
  {object} [options] Optional options.
  {boolean} options.queue Close the worker queue (default true).
  {function} [callback] Optional callback.
```

```js
worker.close(function (err) {
  // worker closed
});
```

#### Events

##### "error"

Emitted when:
- a callback is omitted and an error occur in a method
- a redis "error" event is emitted

```js
worker.on('error', function (error) {
  // ...
});
```

##### "job failure"

Emitted when an error is returned by the job process.

```js
worker.on('job failure', function (task, error) {
  // ...
});
```

##### "job complete"

Emitted when a job is completed without error.

```js
worker.on('job complete', function (task) {
  // ...
});
```

##### "status change"

Emitted when the worker status change.

```js
worker.on('status change', function (status) {
  // ...
});
```

### Queue

#### taskman.createQueue(name, options)

Create a new queue to add task.

Arguments:

```
  {string} name Name of the task to process.
  {object} options Options.
  {object|function} options.redis Redis configuration.
  {boolean} options.unique Unique queue or not (default false).
```

```js
// Create a new unique queue.
var queue = taskman.createQueue('email', {unique: true});
```

#### queue.push(task)

Push a new task at the end of the queue.

```js
queue.push({to: 'hello@world.com', body: 'Hello world!'});
```

#### queue.close([callback])

Close the connection to the queue, the redis command used is [QUIT](http://redis.io/commands/QUIT), so it will wait that all redis commands are done before closing the connection. The queue will continue to persist so tasks will not be lost.

Arguments:

```
  {function} [callback] Optional callback.
```

```js
queue.close(function (err) {
  // queue closed
});
```

#### Events

##### "error"

Emitted when:
- a callback is omitted and an error occur in a method
- a redis "error" event is emitted

```js
queue.on('error', function (error) {
  // ...
});
```

##### "created"

Emitted when a new task is created.

```js
queue.on('created', function (task) {
  // ...
});
```

## Features

### Atomicity

Every tasks are added and removed using [redis transactions](http://redis.io/topics/transactions). You can't be stuck in an unstable state.

### Persistence

Thanks to redis, it's possible to [choose the level of persistence](http://redis.io/topics/persistence) of your queue.

### Hot configuration

Workers configuration (batch, ping, sleep) is stored in a redis hash. If you change this redis hash, the changes will be active without the need to reload your workers.

The redis hash name is "worker:{queueName}:{workerName}".

You will find some informations like:

- createdAt: creation date of the worker
- pid: process identifier
- batch: number of tasks processed at each tick
- ping: ping time
- sleep: sleep time
- type: type of worker (fifo or lifo)
- queue: name of the queue
- taskCount: number of tasks already processed
- status: status of the worker (waiting, working, stopped)

### Unique tasks

If you choose the unique mode, every tasks added in the queue will be present once at a time X. This feature is very interesting if you need to add task that consume a lot of resources. To known if the task is unique or not we compare all the payload of the task.

### Multi tasks processing

Using the configuration "batch" it's possible to specify the number of tasks processed at each tick. This feature is interesting if you need to batch some tasks in a single request (insert in database, indexing...).

## License

MIT

## Credits

Written and maintained by [Greg Bergé][neoziro] and [Justin Bourrousse][JBustin].

An original idea by [David Desbouis][desbouis].

Built an used at [Le Monde](http://www.lemonde.fr).

[neoziro]: http://github.com/neoziro
[desbouis]: http://github.com/desbouis
[JBustin]: http://github.com/JBustin
