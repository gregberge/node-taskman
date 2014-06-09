var expect = require('chai').expect;
var sinon = require('sinon');
var os = require('os');
var async = require('async');
var taskman = require('../');
var TQueue = require('../lib/queue');

describe('Taskman worker', function () {
  describe('constructor', function () {
    it('should instantiate queue automatically', function () {
      var worker = taskman.createWorker('test', {unique:true});
      expect(worker.queue).to.be.instanceOf(TQueue);
      expect(worker.queue).to.have.deep.property('options.unique', true);
      expect(worker.queue).to.have.property('name', 'test');
    });

    it('should work with a queue', function () {
      var queue = taskman.createQueue('test');
      var worker = taskman.createWorker(queue);
      expect(worker.queue).to.be.instanceOf(TQueue);
      expect(worker.queue).to.have.property('name', 'test');
    });

    it('should default name to hostname', function () {
      var worker = taskman.createWorker('test');
      expect(worker).to.have.deep.property('options.name', os.hostname());
    });
  });

  describe('#set', function () {
    var worker, clock;

    beforeEach(function () {
      worker = taskman.createWorker('test', {name:'w'});
    });

    beforeEach(function (done) {
      worker.redis.flushdb(done);
    });

    beforeEach(function () {
      clock = sinon.useFakeTimers();
    });

    afterEach(function () {
      clock.restore();
    });

    it('should accept an object', function (done) {
      async.series([
        function set(next) {
          worker.set({foo: 'bar'}, next);
        },
        function checkHash(next) {
          worker.redis.hget('worker:test:w', 'foo', function (err, res) {
            if (err) return next(err);
            expect(res).to.equal('bar');
            next();
          });
        }
      ], done);
    });

    it('should set the updateAt', function (done) {
      async.series([
        function set(next) {
          worker.set({foo: 'bar'}, next);
        },
        function checkHash(next) {
          worker.redis.hget('worker:test:w', 'updatedAt', function (err, res) {
            if (err) return next(err);
            expect(res).to.equal('1970-01-01T00:00:00.000Z');
            next();
          });
        }
      ], done);
    });
  });

  describe('#get', function () {
    var worker;

    beforeEach(function () {
      worker = taskman.createWorker('test', {name:'w'});
    });

    beforeEach(function (done) {
      worker.redis.flushdb(done);
    });

    beforeEach(function (done) {
      worker.redis.hmset('worker:test:w', {a: 'b', c: 'd'}, done);
    });

    it('should get all data (no args)', function (done) {
      worker.get(function (err, res) {
        if (err) return done(err);
        expect(res).to.eql({a: 'b', c: 'd'});
        done();
      });
    });

    it('should get one value', function (done) {
      worker.get('a', function (err, res) {
        if (err) return done(err);
        expect(res).to.eql('b');
        done();
      });
    });
  });

  describe('#fetch', function () {
    var worker;

    beforeEach(function () {
      worker = taskman.createWorker('test', {name:'w'});
    });

    beforeEach(function (done) {
      worker.redis.flushdb(done);
    });

    beforeEach(function (done) {
      worker.redis.hmset('worker:test:w', {
        batch: 20,
        ping: 4200,
        sleep: 1000,
        type: 'lifo'
      }, done);
    });

    it('should update worker informations from redis', function (done) {
      worker.fetch(function (err) {
        if (err) return done(err);
        expect(worker).to.have.property('batch', 20);
        expect(worker).to.have.property('ping', 4200);
        expect(worker).to.have.property('sleep', 1000);
        expect(worker).to.have.property('type', 'lifo');
        done();
      });
    });
  });

  describe('#process', function () {
    var worker;

    beforeEach(function () {
      worker = taskman.createWorker('test', {name:'w'});
    });

    beforeEach(function (done) {
      worker.redis.flushdb(done);
    });

    it('should update data in redis', function (done) {
      worker.process(function (res) {
        worker.get(function (err, infos) {
          if (err) return done(err);
          expect(infos).to.have.property('createdAt');
          expect(infos).to.have.property('pid', process.pid + '');
          expect(infos).to.have.property('batch', '1');
          expect(infos).to.have.property('ping', '1000');
          expect(infos).to.have.property('sleep', '0');
          expect(infos).to.have.property('type', 'fifo');
          expect(infos).to.have.property('taskCount', '1');
          expect(infos).to.have.property('status', 'working');
          done();
        });
      });

      worker.queue.push('x');
    });

    it('should process tasks', function (done) {
      worker = taskman.createWorker('test', {name: 'w', ping: 10000});
      var queue = taskman.createQueue('test');
      var c = 0;

      worker.process(function (res, next) {
        if (c === 0) expect(res).to.eql(['a']);
        if (c === 1) expect(res).to.eql(['b']);
        if (c === 2) return done();
        c++;
        next();
      });

      async.series([
        queue.push.bind(queue, 'a'),
        queue.push.bind(queue, 'b')
      ], function (err) {
        if (err) return done(err);
        setTimeout(queue.push.bind(queue, 'c'), 50);
      });
    });

    it('should process unique tasks', function (done) {
      worker = taskman.createWorker('test', {name: 'w', unique: true, ping: 10});
      var queue = taskman.createQueue('test');
      var c = 0;

      worker.process(function (res, next) {
        if (c === 0) expect(res).to.eql(['a']);
        if (c === 1) expect(res).to.eql(['b']);
        if (c === 2) return done();
        c++;
        next();
      });

      async.series([
        queue.push.bind(queue, 'a'),
        queue.push.bind(queue, 'b')
      ], function (err) {
        if (err) return done(err);
        setTimeout(queue.push.bind(queue, 'c'), 50);
      });
    });
  });

  describe('#close', function () {
    it('should close connection to redis', function (done) {
      var worker = taskman.createWorker('test');
      worker.close(function (err) {
        if (err) return done(err);
        expect(worker.queue.redis.closing).to.be.true;
        expect(worker.redis.closing).to.be.true;
        done();
      });
    });

    it('should be possible to not close the queue', function (done) {
      var worker = taskman.createWorker('test');
      worker.close({queue: false}, function (err) {
        if (err) return done(err);
        expect(worker.queue.redis.closing).to.be.false;
        expect(worker.redis.closing).to.be.true;
        done();
      });
    });
  });
});