'use strict';

var async = require('async');
var Queue = require(app.base + 'queue').Queue;
var RedisDriver = require(app.base + 'driver/redis').RedisDriver;

describe('Queue', function () {
  var queue, driver;

  before(function (done) {
    driver = new RedisDriver(app.config.redis.run);
    driver.db = app.config.redis.db;
    queue = new Queue('test', driver);
    queue.initialize(done);
  });

  after(function (done) {
    driver.client.flushdb(done);
  });

  it('should be correctly initialized', function () {
    expect(queue.initialized).to.be.true;
  });

  it('should get name', function () {
    expect(queue.getName()).to.equal('test');
  });

  describe('#basic commands with empty db', function () {
    afterEach(function (done) {
      driver.client.flushdb(done);
    });

    it('should rpush', function (done) {
      queue.rpush('hello', function (err, count) {
        if (err) return done(err);
        expect(count).to.equal(1);
        done();
      });
    });

    it('should lpush', function (done) {
      queue.lpush('hello', function (err, count) {
        if (err) return done(err);
        expect(count).to.equal(1);
        done();
      });
    });

    it('should lpop', function (done) {
      queue.lpop(1, function (err, data) {
        if (err) return done(err);
        expect(data).to.eql([ null ]);
        done();
      });
    });

    it('should rpop', function (done) {
      queue.rpop(1, function (err, data) {
        if (err) return done(err);
        expect(data).to.eql([ null ]);
        done();
      });
    });

    it('should llen', function (done) {
      queue.llen(function (err, count) {
        if (err) return done(err);
        expect(count).to.equal(0);
        done();
      });
    });

  });


  describe('#basic commands compiles', function () {

    beforeEach(function (done) {
      async.waterfall([
        queue.rpush.bind(queue, 'first'),
        function (count, callback) {
          queue.rpush('second', callback);
        }
      ], done);
    });

    afterEach(function (done) {
      driver.client.flushdb(done);
    });

    it('should rpop', function (done) {
      queue.rpop(1, function (err, data) {
        if (err) return done(err);
        expect(data).to.eql([ 'second' ]);
        done();
      });
    });

    it('should lpop', function (done) {
      queue.lpop(1, function (err, data) {
        if (err) return done(err);
        expect(data).to.eql([ 'first' ]);
        done();
      });
    });

    it('should lpush', function (done) {
      async.waterfall([
        queue.lpush.bind(queue, 'third'),
        function (count, callback) {
          queue.lpop(1, callback);
        }
      ], function (err, data) {
        if (err) return done(err);
        expect(data).to.eql([ 'third' ]);
        done();
      });
    });

    it('should llen', function (done) {
      queue.llen(function (err, count) {
        if (err) return done(err);
        expect(count).to.equal(2);
        done();
      });
    });

  });

});