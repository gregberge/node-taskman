'use strict';

var async = require('async');
var moment = require('moment');
var sinon = require('sinon');
var QueueWorker = require('../lib/worker').Worker;
var Queue = require('../lib/queue').Queue;
var RedisDriver = require('../lib/driver/redis').RedisDriver;
var config = require('./config');
var expect = require('chai').use(require('sinon-chai')).expect;

describe('Worker with a redis queue', function () {

  var worker, queue;
  var driver = new RedisDriver(config.redis.run);

  // mock
  var action = sinon.stub().yields();
  var status = QueueWorker.prototype.setStatus = sinon.spy(QueueWorker.prototype.setStatus);

  // init queue and driver
  driver.db = config.redis.db;
  queue = new Queue('Q', driver);

  // init worker with options
  function initWorker(options, callback) {
    worker = new QueueWorker(queue, driver, 'W', action, options);
    worker.start(callback);
  }

  // reinit state of bd and mocks
  afterEach(function (done) {
    action.reset();
    status.reset();
    driver.client.flushdb(done);
  });



  describe('#Controls', function () {

    beforeEach(function (done) {
      initWorker(null, done);
    });

    describe('#start', function () {

      it('should be initialized', function () {
        expect(worker.initialized).to.be.true;
      });

      it('should initialize queue', function () {
        expect(worker.queue).to.eql(queue);
      });

      it('should initialize name', function () {
        expect(worker.completeName).to.equal('Q:W');
      });

      it('should record default parameters in storage', function (done) {
        worker.driver.hgetall(worker.completeName, function (err, params) {
          if (err) return done(err);
          expect(params).to.have.property('waiting_timeout', '1');
          expect(params).to.have.property('loop_sleep', '0');
          expect(params).to.have.property('pause_sleep_time', '5');
          expect(params).to.have.property('data_per_tick', '1');
          expect(params).to.have.property('action', 'stub');
          expect(params).to.have.property('queue', 'Q');
          expect(params).to.have.property('type', 'FIFO');
          expect(params).to.have.property('language', 'nodejs');
          expect(params).to.have.property('unique', '0');
          done();
        });
      });

      it('should set end date', function (done) {
        worker.driver.hget(worker.completeName, 'end_date', function (err, data) {
          if (err) return done(err);
          expect(moment(data).diff(moment(), 'days') + 1).to.equal(200);
          done();
        });
      });

      it('should set status', function (done) {
        worker.driver.hget(worker.completeName, 'status', function (err, data) {
          if (err) return done(err);
          expect(data).to.equal(QueueWorker.STATUS_STARTED);
          done();
        });
      });

      it('should set cpt_action', function (done) {
        worker.driver.hget(worker.completeName, 'cpt_action', function (err, data) {
          if (err) return done(err);
          expect(data).to.equal('0');
          done();
        });
      });

      it('should set start_date', function (done) {
        worker.driver.hget(worker.completeName, 'start_date', function (err, data) {
          if (err) return done(err);
          expect(moment(data)).to.have.property('_isAMomentObject', true);
          done();
        });
      });

      it('should set status change date', function (done) {
        worker.driver.hget(worker.completeName, 'status_changedate', function (err, data) {
          if (err) return done(err);
          expect(moment(data)).to.have.property('_isAMomentObject', true);
          done();
        });
      });

      it('shouldn\'t launch an action', function () {
        expect(action).not.to.be.called;
      });

      it('should fix worker status', function () {
        expect(status).to.be.calledWith(QueueWorker.STATUS_STARTED);
      });
    });

    describe('#pause', function () {

      beforeEach(function (done) {
        worker.pause(done);
      });

      it('should change status', function (done) {
        worker.driver.hget(worker.completeName, 'status', function (err, data) {
          if (err) return done(err);
          expect(data).to.equal(QueueWorker.STATUS_PAUSED);
          done();
        });
      });

      it('shouldn\'t launch an action', function () {
        expect(action).not.to.be.called;
      });

      it('should fix worker status', function () {
        expect(status).to.be.calledWith(QueueWorker.STATUS_STARTED);
        expect(status).to.be.calledWith(QueueWorker.STATUS_PAUSED);
      });

    });

    describe('#stop', function () {

      beforeEach(function (done) {
        worker.stop(done);
      });

      it('shouldn\'t launch an action', function () {
        expect(action).not.to.be.called;
      });

      it('should set end date', function (done) {
        worker.driver.hget(worker.completeName, 'end_date', function (err, data) {
          if (err) return done(err);
          expect(parseInt(moment(data).format('X'), 10)).to.be.below(Date.now());
          done();
        });
      });
    });
  });


  describe('#Process', function () {

    beforeEach(function () {
      driver = new RedisDriver(config.redis.run);
      driver.db = config.redis.db;
      queue = new Queue('Q', driver);
    });

    describe('FIFO', function () {

      beforeEach(function (done) {
        initWorker(null, done);
      });

      it('should treat an element', function (done) {
        queue.rpush('first', function (err) {
          if (err) return done(err);
          worker.on('job complete', function () {
            expect(action).to.be.calledWith(['first']);
            done();
          });
        });
      });

      it('should treat some elements in the good order', function (done) {
        var elements = ['first', 'second', 'third'];
        var expectElements = [];

        worker.on('job complete', function () {
          expectElements.push(action.getCall(expectElements.length).args[0][0]);

          if (expectElements.length !== elements.length) return;

          expect(expectElements).to.eql(elements);
          worker.removeAllListeners();
          done();
        });

        async.eachSeries(elements, queue.rpush.bind(queue), function (err) {
          if (err) return done(err);
        });
      });

    });

    describe('LIFO', function () {

      beforeEach(function (done) {
        initWorker({type: 'LIFO', pauseSleepTime: 0.01}, done);
      });

      it('should treat an element', function (done) {
        queue.rpush('first', function (err) {
          if (err) return done(err);
          worker.on('job complete', function () {
            expect(action).to.be.calledWith(['first']);
            done();
          });
        });
      });

      it('should treat some elements in the good order', function (done) {
        var elements = ['first', 'second', 'third'];
        var expectElements = [];

        worker.on('job complete', function () {
          expectElements.push(action.getCall(expectElements.length).args[0][0]);

          if (expectElements.length !== elements.length) return;

          expect(expectElements).to.eql(elements);
          worker.removeAllListeners();
          done();
        });

        async.eachSeries(elements, queue.lpush.bind(queue), function (err) {
          if (err) return done(err);
        });
      });

      it('should treat the same element many times', function (done) {
        var expectElements = [];

        worker.on('job complete', function () {
          expectElements.push(action.getCall(expectElements.length).args[0][0]);

          if (expectElements.length !== 3) return;

          expect(expectElements).to.eql(['first', 'first', 'first']);
          worker.removeAllListeners();
          done();
        });

        async.series([
          worker.setStatus.bind(worker, QueueWorker.STATUS_PAUSED),
          queue.rpush.bind(queue, 'first'),
          queue.rpush.bind(queue, 'first'),
          queue.rpush.bind(queue, 'first'),
          worker.setStatus.bind(worker, QueueWorker.STATUS_WORKING)
        ], function (err) {
          if (err) return done(err);
        });
      });

    });

    describe('Unique mode', function () {

      beforeEach(function (done) {
        queue = new Queue('Q', driver, {unique: true});
        initWorker({pauseSleepTime: 0.01}, done);
      });

      it('should be impossible to have the same key in the queue', function (done) {
        var expectElements = [];

        worker.on('job complete', function () {
          expectElements.push(action.getCall(expectElements.length).args[0][0]);

          if (expectElements.length !== 2) return;

          expect(expectElements).to.eql(['first', 'second']);
          worker.removeAllListeners();
          done();
        });

        async.series([
          worker.setStatus.bind(worker, QueueWorker.STATUS_PAUSED),
          queue.rpush.bind(queue, 'first'),
          queue.rpush.bind(queue, 'first'),
          queue.rpush.bind(queue, 'first'),
          queue.rpush.bind(queue, 'first'),
          queue.rpush.bind(queue, 'first'),
          queue.rpush.bind(queue, 'second'),
          worker.setStatus.bind(worker, QueueWorker.STATUS_WORKING)
        ], function (err) {
          if (err) return done(err);
        });

      });
    });

  });

});


describe('Worker processing', function () {
  var mockQueue, mockDriver, worker, clock, action;

  function getTimeAddSeconds(seconds) {
    var now = new Date();
    now.setSeconds(now.getSeconds() + seconds);
    return now;
  }

  beforeEach(function () {
    mockQueue = {
      driver: { close: sinon.spy() },
      getName: sinon.stub().returns('Q')
    };
    mockDriver = { close: sinon.spy() };
    clock = sinon.useFakeTimers();
    sinon.stub(process, 'nextTick', setTimeout);
    action = sinon.spy();
  });

  afterEach(function () {
    process.nextTick.restore();
    clock.restore();
  });

  it('should close connexion if no infos are retrieved in redis', function () {
    worker = new QueueWorker(mockQueue, mockDriver, 'W', action);

    worker.getInfos = sinon.stub().yields(null);

    worker.process();

    clock.tick(1);

    expect(mockQueue.driver.close).to.be.called;
    expect(mockDriver.close).to.be.called;
    expect(action).not.to.be.called;
  });

  it('should close connexion if end_date is earlier than now', function () {
    Date.now = sinon.spy(getTimeAddSeconds.bind(null, 10));

    worker = new QueueWorker(mockQueue, mockDriver, 'W', action);

    worker.getInfos = sinon.stub().yields(null, {
      'end_date': '1970-01-01T00:00:00.000Z'
    });

    worker.process();

    clock.tick(1);

    expect(mockQueue.driver.close).to.be.called;
    expect(mockDriver.close).to.be.called;
    expect(action).not.to.be.called;
  });

  it('should only relaunch a process if it is in pause', function () {
    Date.now = sinon.spy(getTimeAddSeconds.bind(null, 10));

    worker = new QueueWorker(mockQueue, mockDriver, 'W', action);

    worker.getInfos = sinon.stub().yields(null, {
      'end_date': '1970-01-02T00:00:00.000Z',
      'pause_sleep_time': '5',
      status: QueueWorker.STATUS_PAUSED
    });

    worker.process();

    clock.tick(1);

    expect(action).not.to.be.called;
  });

  it('should call lpop if it is in fifo, and no results', function () {
    mockQueue.lpop = sinon.stub().yields(null, []);
    mockQueue.rpop = sinon.stub().yields(null, []);

    Date.now = sinon.spy(getTimeAddSeconds.bind(null, 10));

    worker = new QueueWorker(mockQueue, mockDriver, 'W', action);
    worker.setStatus = sinon.stub().yields();
    worker.getInfos = sinon.stub().yields(null, {
      'end_date': '1970-01-02T00:00:00.000Z',
      'data_per_tick': '1',
      'waiting_timeout': '1',
      type: 'FIFO'
    });

    worker.process();

    clock.tick(1);

    expect(mockQueue.rpop).not.to.be.called;
    expect(mockQueue.lpop).to.be.calledWith('1');
    expect(worker.setStatus).to.be.calledWith(QueueWorker.STATUS_WAITING);
    expect(action).not.to.be.called;
  });

  it('should call rpop if it is in lifo, and no results', function () {
    mockQueue.lpop = sinon.stub().yields(null, []);
    mockQueue.rpop = sinon.stub().yields(null, []);

    Date.now = sinon.spy(getTimeAddSeconds.bind(null, 10));

    worker = new QueueWorker(mockQueue, mockDriver, 'W', action);
    worker.setStatus = sinon.stub().yields();
    worker.getInfos = sinon.stub().yields(null, {
      'end_date': '1970-01-02T00:00:00.000Z',
      'data_per_tick': '1',
      'waiting_timeout': '1',
      type: 'LIFO'
    });

    worker.process();

    clock.tick(1);

    expect(mockQueue.lpop).not.to.be.called;
    expect(mockQueue.rpop).to.be.calledWith('1');
    expect(worker.setStatus).to.be.calledWith(QueueWorker.STATUS_WAITING);
    expect(action).not.to.be.called;
  });

  it('should call the action if there are some results', function () {
    mockQueue.lpop = sinon.stub().yields(null, ['first']);

    Date.now = sinon.spy(getTimeAddSeconds.bind(null, 10));

    worker = new QueueWorker(mockQueue, mockDriver, 'W', action);
    worker.setStatus = sinon.stub().yields();
    worker.getInfos = sinon.stub().yields(null, {
      'end_date': '1970-01-02T00:00:00.000Z',
      'data_per_tick': '1',
      'waiting_timeout': '1',
      'loop_sleep': '0',
      type: 'FIFO'
    });

    worker.process();

    clock.tick(1);

    expect(worker.setStatus).to.be.calledWith(QueueWorker.STATUS_WORKING);
    expect(action).to.be.called;
  });

  describe('#Timeout', function () {

    beforeEach(function () {
      mockQueue.lpop = sinon.stub().yields(null, ['first']);

      action = function (result, callback) {
        setTimeout(callback, 1000);
      };

      worker = new QueueWorker(mockQueue, mockDriver, 'W', action, {
        timeout: 200,
        loop_sleep: 0
      });

      worker.setStatus = sinon.stub().yields();
      worker.getInfos = sinon.stub().yields(null, {
        'end_date': '1970-01-02T00:00:00.000Z',
        'data_per_tick': '1',
        'waiting_timeout': '1',
        'loop_sleep': '0',
        type: 'FIFO'
      });
    });

    it('should call the callback even if the action is not finished (timeout)', function (done) {
      worker.on('job failure', function (err) {
        expect(err).to.eql(new Error('Timeout'));
        done();
      });

      worker.on('job complete', done.bind(null, new Error('Timeout failure')));
      worker.process();

      clock.tick(201);
    });

    it('should continue to pop the queue even if the action is in timeout', function () {
      worker.process = sinon.spy(worker.process.bind(worker));
      worker.process();

      clock.tick(501);

      // execute the action :
      // 1 time when process is launched
      // 2 times after timeout
      expect(worker.process.callCount).to.equal(3);
    });

  });


});