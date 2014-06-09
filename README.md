# node-taskman

[![Build Status](https://travis-ci.org/neoziro/node-taskman.svg?branch=master)](https://travis-ci.org/neoziro/node-taskman)
[![Dependency Status](https://david-dm.org/neoziro/node-taskman.svg?theme=shields.io)](https://david-dm.org/neoziro/node-taskman)
[![devDependency Status](https://david-dm.org/neoziro/node-taskman/dev-status.svg?theme=shields.io)](https://david-dm.org/neoziro/node-taskman#info=devDependencies)

node-taskman is a fast work queue based on redis.

Core features:

- atomicity
- persistent queue
- dynamic worker configuration
- unique tasks
- process several tasks at one time

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
queue.on('error', function (error) {
  // ...
});
```

##### "job failure"

Emitted when an error is returned by the job process.

```js
queue.on('job failure', function (task, error) {
  // ...
});
```

##### "job complete"

Emitted when a job is completed without error.

```js
queue.on('job complete', function (task) {
  // ...
});
```

##### "status change"

Emitted when the worker status change.

```js
queue.on('status change', function (status) {
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
  {object|function} redis Redis configuration.
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

## License

MIT

## Credits

Written and maintained by [Greg Bergé][neoziro] and [Justin Bourrousse][JBustin].

An original idea by [David Desbouis][desbouis].

Build an used on [Le Monde.fr](http://www.lemonde.fr).

[neoziro]: http://github.com/neoziro
[desbouis]: http://github.com/desbouis
[JBustin]: http://github.com/JBustin
