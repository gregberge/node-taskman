var expect = require('chai').use(require('sinon-chai')).expect;
var sinon = require('sinon');
var async = require('async');
var taskman = require('../');

describe('Taskman queue', function() {
  describe('non unique', function() {
    var queue, queue2;

    beforeEach(function() {
      queue = taskman.createQueue('myQueue', { unique: false });
      queue2 = taskman.createQueue('myQueue', { unique: false });
    });

    beforeEach(function(done) {
      queue.redis.flushdb(done);
    });

    describe('#push', function() {
      it('should push a new string in the queue', function(done) {
        async.series(
          [
            function push(next) {
              queue.push('test', next);
            },
            function checkData(next) {
              queue.redis.lpop('queue:myQueue', function(err, data) {
                if (err) return next(err);
                expect(data).to.equal('"test"');
                next();
              });
            },
          ],
          done
        );
      });

      it('should push a new object in the queue', function(done) {
        async.series(
          [
            function push(next) {
              queue.push({ foo: 'bar' }, next);
            },
            function checkData(next) {
              queue.redis.lpop('queue:myQueue', function(err, data) {
                if (err) return next(err);
                expect(data).to.equal('{"foo":"bar"}');
                next();
              });
            },
          ],
          done
        );
      });

      it('should emit a "created" event', function(done) {
        var spy = sinon.spy();
        queue.on('created', spy);

        queue.push({ foo: 'bar' }, function(err) {
          if (err) return done(err);
          expect(spy).to.be.calledWith({ foo: 'bar' });
          done();
        });
      });
    });

    describe('#pop', function() {
      it('should pop a string from the queue', function(done) {
        async.series(
          [
            function push(next) {
              queue.redis.rpush('queue:myQueue', '"test"', next);
            },
            function pop(next) {
              queue.pop('fifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql(['test']);
                next();
              });
            },
          ],
          done
        );
      });

      it('should pop an object from the queue', function(done) {
        async.series(
          [
            function push(next) {
              queue.redis.rpush('queue:myQueue', '{"foo":"bar"}', next);
            },
            function pop(next) {
              queue.pop('fifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql([{ foo: 'bar' }]);
                next();
              });
            },
          ],
          done
        );
      });

      it('should work on an empty queue', function(done) {
        queue.pop('fifo', 1, function(err, data) {
          if (err) return done(err);
          expect(data).to.eql([{ foo: 'bar' }]);
          done();
        });

        setTimeout(function() {
          queue2.redis.rpush('queue:myQueue', ['{"foo":"bar"}']);
        }, 10);
      });

      it('should fetch multiple values', function(done) {
        async.series(
          [
            function push(next) {
              queue.redis.rpush('queue:myQueue', 1, next);
            },
            function push(next) {
              queue.redis.rpush('queue:myQueue', 2, next);
            },
            function pop(next) {
              queue.pop('fifo', 3, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql([1, 2, null]);
                next();
              });
            },
          ],
          done
        );
      });
    });
  });

  describe('unique', function() {
    var queue;

    beforeEach(function() {
      queue = taskman.createQueue('myQueue', { unique: true });
    });

    beforeEach(function(done) {
      queue.redis.flushdb(done);
    });

    describe('#push', function() {
      it('should push a new string in the queue', function(done) {
        async.series(
          [
            function push(next) {
              queue.push('test', next);
            },
            function checkQueue(next) {
              queue.redis.lpop('queue:myQueue', function(err, data) {
                if (err) return next(err);
                expect(data).to.equal('"test"');
                next();
              });
            },
            function check(next) {
              queue.redis.sismember('unique:myQueue', '"test"', function(
                err,
                exists
              ) {
                if (err) return next(err);
                expect(exists).to.equal(1);
                next();
              });
            },
          ],
          done
        );
      });

      it("should not push if it's already in the queue", function(done) {
        async.series(
          [
            function firstPush(next) {
              queue.push('test', next);
            },
            function secondPush(next) {
              queue.push('test', next);
            },
            function checkQueue(next) {
              queue.redis.llen('queue:myQueue', function(err, data) {
                if (err) return next(err);
                expect(data).to.equal(1);
                next();
              });
            },
          ],
          done
        );
      });

      it('should work even if we push in parallel', function(done) {
        var queue1 = taskman.createQueue('myQueue', { unique: true });
        var queue2 = taskman.createQueue('myQueue', { unique: true });

        async.parallel(
          [
            function firstPush(next) {
              queue1.push('test1', next);
            },
            function secondPush(next) {
              queue2.push('test2', next);
            },
            function secondPush(next) {
              queue.push('test', next);
            },
          ],
          function(err) {
            if (err) return done(err);

            queue.redis.llen('queue:myQueue', function(err, data) {
              if (err) return done(err);
              expect(data).to.equal(3);
              done();
            });
          }
        );
      });
    });

    describe('#pop', function() {
      it('should pop a string from the queue', function(done) {
        async.series(
          [
            function pushList(next) {
              queue.redis.rpush('queue:myQueue', '"test"', next);
            },
            function addToSet(next) {
              queue.redis.sadd('unique:myQueue', '"test"', next);
            },
            function pop(next) {
              queue.pop('fifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql(['test']);
                next();
              });
            },
            function checkList(next) {
              queue.redis.llen('queue:myQueue', function(err, count) {
                if (err) return next(err);
                expect(count).to.equal(0);
                next();
              });
            },
            function checkSet(next) {
              queue.redis.sismember('unique:myQueue', '"test"', function(
                err,
                exists
              ) {
                if (err) return next(err);
                expect(exists).to.equal(0);
                next();
              });
            },
          ],
          done
        );
      });

      it('should return null if queue is empty', function(done) {
        async.series(
          [
            function pop(next) {
              queue.pop('fifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql(null);
                next();
              });
            },
            function checkList(next) {
              queue.redis.llen('queue:myQueue', function(err, count) {
                if (err) return next(err);
                expect(count).to.equal(0);
                next();
              });
            },
            function checkSet(next) {
              queue.redis.sismember('unique:myQueue', '"test"', function(
                err,
                exists
              ) {
                if (err) return next(err);
                expect(exists).to.equal(0);
                next();
              });
            },
          ],
          done
        );
      });

      it('should pop in the right direction (#fifo)', function(done) {
        async.series(
          [
            function push(next) {
              queue.push('test1', next);
            },
            function push(next) {
              queue.push('test2', next);
            },
            function pop(next) {
              queue.pop('fifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql(['test1']);
                next();
              });
            },
            function pop(next) {
              queue.pop('fifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql(['test2']);
                next();
              });
            },
          ],
          function(err) {
            if (err) return done(err);
            done();
          }
        );
      });

      it('should pop in the right direction (#lifo)', function(done) {
        async.series(
          [
            function push(next) {
              queue.push('test1', next);
            },
            function push(next) {
              queue.push('test2', next);
            },
            function pop(next) {
              queue.pop('lifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql(['test2']);
                next();
              });
            },
            function pop(next) {
              queue.pop('lifo', 1, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql(['test1']);
                next();
              });
            },
          ],
          function(err) {
            if (err) return done(err);
            done();
          }
        );
      });

      it('should fetch multiple values', function(done) {
        async.series(
          [
            function pushList(next) {
              queue.redis.rpush('queue:myQueue', 1, next);
            },
            function addToSet(next) {
              queue.redis.sadd('unique:myQueue', 1, next);
            },
            function pushList(next) {
              queue.redis.rpush('queue:myQueue', 2, next);
            },
            function addToSet(next) {
              queue.redis.sadd('unique:myQueue', 2, next);
            },
            function pop(next) {
              queue.pop('fifo', 3, function(err, data) {
                if (err) return next(err);
                expect(data).to.eql([1, 2]);
                next();
              });
            },
            function checkList(next) {
              queue.redis.llen('queue:myQueue', function(err, count) {
                if (err) return next(err);
                expect(count).to.equal(0);
                next();
              });
            },
            function checkSet(next) {
              queue.redis.smembers('unique:myQueue', function(err, results) {
                if (err) return next(err);
                expect(results.length).to.equal(0);
                next();
              });
            },
          ],
          done
        );
      });
    });
  });

  describe('#close', function() {
    it('should close connection to redis', function(done) {
      var queue = taskman.createQueue('myQueue');
      queue.close(function(err) {
        if (err) return done(err);
        expect(queue.redis.closing).to.be.true;
        done();
      });
    });
  });
});
