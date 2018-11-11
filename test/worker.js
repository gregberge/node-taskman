var expect = require('chai').use(require('sinon-chai')).expect;
var sinon = require('sinon');
var os = require('os');
var async = require('async');

var taskman = require('../');
var TQueue = require('../lib/queue');

describe('Taskman worker', function() {
  describe('constructor', function() {
    it('should instantiate queue automatically', function() {
      var worker = taskman.createWorker('test', { unique: true });
      expect(worker.queue).to.be.instanceOf(TQueue);
      expect(worker.queue).to.have.nested.property('options.unique', true);
      expect(worker.queue).to.have.property('name', 'test');
    });

    it('should default name to hostname', function() {
      var worker = taskman.createWorker('test');
      expect(worker).to.have.nested.property('options.name', os.hostname());
    });
  });

  describe('#set', function() {
    var worker, clock;

    beforeEach(function() {
      worker = taskman.createWorker('test', { name: 'w' });
    });

    beforeEach(function(done) {
      worker.redis.flushdb(done);
    });

    beforeEach(function() {
      clock = sinon.useFakeTimers();
    });

    afterEach(function() {
      clock.restore();
    });

    it('should accept an object', function(done) {
      async.series(
        [
          function set(next) {
            worker.set({ foo: 'bar' }, next);
          },
          function checkHash(next) {
            worker.redis.hget('worker:test:w', 'foo', function(err, res) {
              if (err) return next(err);
              expect(res).to.equal('bar');
              next();
            });
          },
        ],
        done
      );
    });

    it('should set the updateAt', function(done) {
      async.series(
        [
          function set(next) {
            worker.set({ foo: 'bar' }, next);
          },
          function checkHash(next) {
            worker.redis.hget('worker:test:w', 'updatedAt', function(err, res) {
              if (err) return next(err);
              expect(res).to.equal('1970-01-01T00:00:00.000Z');
              next();
            });
          },
        ],
        done
      );
    });

    it('should emit a "status change" event if the status change', function(done) {
      var spy = sinon.spy();
      worker.status = 'waiting';
      worker.on('status change', spy);
      worker.set({ status: 'working' }, function(err) {
        if (err) return done(err);
        expect(spy).to.be.calledWith('working');
        done();
      });
    });
  });

  describe('#get', function() {
    var worker;

    beforeEach(function() {
      worker = taskman.createWorker('test', { name: 'w' });
    });

    beforeEach(function(done) {
      worker.redis.flushdb(done);
    });

    beforeEach(function(done) {
      worker.redis.hmset('worker:test:w', { a: 'b', c: 'd' }, done);
    });

    it('should get all data (no args)', function(done) {
      worker.get(function(err, res) {
        if (err) return done(err);
        expect(res).to.eql({ a: 'b', c: 'd' });
        done();
      });
    });

    it('should get one value', function(done) {
      worker.get('a', function(err, res) {
        if (err) return done(err);
        expect(res).to.eql('b');
        done();
      });
    });
  });

  describe('#fetch', function() {
    var worker;

    beforeEach(function() {
      worker = taskman.createWorker('test', { name: 'w' });
    });

    beforeEach(function(done) {
      worker.redis.flushdb(done);
    });

    beforeEach(function(done) {
      worker.redis.hmset(
        'worker:test:w',
        {
          batch: 20,
          ping: 4200,
          sleep: 1000,
          type: 'lifo',
          status: 'working',
        },
        done
      );
    });

    it('should update worker informations from redis', function(done) {
      worker.fetch(function(err) {
        if (err) return done(err);
        expect(worker).to.have.property('batch', 20);
        expect(worker).to.have.property('ping', 4200);
        expect(worker).to.have.property('sleep', 1000);
        expect(worker).to.have.property('type', 'lifo');
        done();
      });
    });

    it('should emit a "status change" event if the status change', function(done) {
      var spy = sinon.spy();
      worker.status = 'waiting';
      worker.on('status change', spy);
      worker.fetch(function(err) {
        if (err) return done(err);
        expect(spy).to.be.calledWith('working');
        done();
      });
    });
  });

  describe('#process', function() {
    var worker, queue;

    beforeEach(function() {
      worker = taskman.createWorker('test', { name: 'w' });
    });

    beforeEach(function(done) {
      worker.redis.flushdb(done);
    });

    afterEach(function(done) {
      worker.close(done);
    });

    afterEach(function(done) {
      if (queue) queue.close(done);
      else done();
    });

    it('should update data in redis', function(done) {
      worker.process(function(tasks, next) {
        worker.get(function(err, infos) {
          if (err) return done(err);
          expect(infos).to.have.property('createdAt');
          expect(infos).to.have.property('pid', process.pid + '');
          expect(infos).to.have.property('batch', '1');
          expect(infos).to.have.property('ping', '1000');
          expect(infos).to.have.property('sleep', '0');
          expect(infos).to.have.property('type', 'fifo');
          expect(infos).to.have.property('queue', 'test');
          expect(infos).to.have.property('taskCount', '1');
          expect(infos).to.have.property('status', 'working');
          next();
          done();
        });
      });

      worker.queue.push('x');
    });

    it('should process tasks', function(done) {
      worker = taskman.createWorker('test', { name: 'w', ping: 10000 });
      queue = taskman.createQueue('test');
      var c = 0;

      worker.process(function(res, next) {
        if (c === 0) expect(res).to.eql(['a']);
        if (c === 1) expect(res).to.eql(['b']);
        if (c === 2) done();
        c++;
        next();
      });

      async.series(
        [queue.push.bind(queue, 'a'), queue.push.bind(queue, 'b')],
        function(err) {
          if (err) return done(err);
          setTimeout(queue.push.bind(queue, 'c'), 50);
        }
      );
    });

    it('should process unique tasks', function(done) {
      worker = taskman.createWorker('test', {
        name: 'w',
        unique: true,
        ping: 10,
      });
      queue = taskman.createQueue('test');
      var c = 0;

      worker.process(function(res, next) {
        if (c === 0) expect(res).to.eql(['a']);
        if (c === 1) expect(res).to.eql(['b']);
        if (c === 2) done();
        c++;
        next();
      });

      async.series(
        [queue.push.bind(queue, 'a'), queue.push.bind(queue, 'b')],
        function(err) {
          if (err) return done(err);
          setTimeout(queue.push.bind(queue, 'c'), 50);
        }
      );
    });

    it('should emit a "job failure" event if process returns an error', function(done) {
      worker = taskman.createWorker('jobfailure');
      queue = taskman.createQueue('jobfailure');

      worker.on('job failure', function(tasks, err) {
        expect(tasks).to.eql(['task']);
        expect(err).to.be.instanceOf(Error);
        expect(err).to.have.property('message', 'error');
        done();
      });

      worker.process(function(tasks, next) {
        next(new Error('error'));
      });

      queue.push('task');
    });

    it('should emit a "job complete" event if process does\'t return an error', function(done) {
      worker = taskman.createWorker('jobcomplete');
      queue = taskman.createQueue('jobcomplete');

      worker.on('job complete', function(tasks) {
        expect(tasks).to.eql(['task']);
        done();
      });

      worker.process(function(tasks, next) {
        next();
      });

      queue.push('task');
    });
  });

  describe('#close', function() {
    var worker;

    beforeEach(function() {
      worker = taskman.createWorker('test');
    });

    it('should close connection to redis', function(done) {
      worker.close(function(err) {
        if (err) return done(err);
        expect(worker.queue.redis.closing).to.be.true;
        expect(worker.redis.closing).to.be.true;
        done();
      });
    });

    it('should be possible to not close the queue', function(done) {
      worker.close({ queue: false }, function(err) {
        if (err) return done(err);
        expect(worker.queue.redis.closing).to.be.false;
        expect(worker.redis.closing).to.be.true;
        done();
      });
    });
  });
});
