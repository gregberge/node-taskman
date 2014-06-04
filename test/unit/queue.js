'use strict';

var async = require('async');
var Queue = require(app.base + 'queue').Queue;
var RedisDriver = require(app.base + 'driver/redis').RedisDriver;

describe('Queue', function () {
  var queue, driver, queueName = 'test';

  before(function (done) {
    driver = new RedisDriver(app.config.redis.run);
    driver.db = app.config.redis.db;
    queue = new Queue(queueName, driver);
    queue.initialize(done);
  });

  afterEach(function (done) {
    driver.client.flushdb(done);
  });

  it('should be correctly initialized', function () {
    expect(queue.initialized).to.be.true;
  });

  it('should get name', function () {
    expect(queue.getName()).to.equal(queueName);
  });

  describe('#basic commands with empty db', function () {

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
      async.series([
        queue.rpush.bind(queue, 'first'),
        queue.rpush.bind(queue, 'second')
      ], done);
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
      async.series([
        queue.lpush.bind(queue, 'third'),
        queue.lpop.bind(queue, 1)
      ], function (err, results) {
        if (err) return done(err);
        expect(results[1]).to.eql([ 'third' ]);
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

  describe('#unique mode', function () {

    var nameSet;
    var data = 'first';

    beforeEach(function () {
      nameSet = driver.getUniqueSetName(queueName);
      queue.unique = true;
    });

    it('rpush should set data in a Set', function (done) {
      async.series([
        queue.rpush.bind(queue, data),
        driver.client.hget.bind(driver.client, nameSet, driver.shasum(data))
      ], function (err, data) {
        if (err) return done(err);
        expect(data[0]).to.equal(1);
        expect(data[1]).to.equal('first');
        done();
      });
    });

    it('lpush should set data in a Set', function (done) {
      async.series([
        queue.lpush.bind(queue, data),
        driver.client.hget.bind(driver.client, nameSet, driver.shasum(data))
      ], function (err, data) {
        if (err) return done(err);
        expect(data[0]).to.equal(1);
        expect(data[1]).to.equal('first');
        done();
      });
    });

    it('shouldn\'t push the same element two times', function (done) {
      async.series([
        queue.rpush.bind(queue, data),
        queue.rpush.bind(queue, data)
      ], function (err, counts) {
        if (err) return done(err);
        expect(counts).to.eql([1, 0]);
        done();
      });
    });

    it('should return an array when rpop not find', function () {
      queue.rpop(1, function (err, data) {
        expect(data).to.eql([ null ]);
      });
    });

    it('should remove the element from the set when rpop', function (done) {
      async.series([
        queue.rpush.bind(queue, data),
        queue.rpop.bind(queue, 1),
        driver.client.hget.bind(driver.client, nameSet, driver.shasum(data))
      ], function (err, results) {
        if (err) return done(err);
        expect(results[0]).to.equal(1);
        expect(results[1]).to.eql([data]);
        expect(results[2]).to.be.null;
        done();
      });
    });

    it('should return an array when lpop not find', function () {
      queue.lpop(1, function (err, data) {
        expect(data).to.eql([ null ]);
      });
    });

    it('should remove the element from the set when lpop', function (done) {
      async.series([
        queue.lpush.bind(queue, data),
        queue.lpop.bind(queue, 1),
        driver.client.hget.bind(driver.client, nameSet, driver.shasum(data))
      ], function (err, results) {
        if (err) return done(err);
        expect(results[0]).to.equal(1);
        expect(results[1]).to.eql([data]);
        expect(results[2]).to.be.null;
        done();
      });
    });

    it('should process with multiple lpush and lpop', function (done) {
      async.series([
        queue.lpush.bind(queue, 'first'),
        queue.lpush.bind(queue, 'second'),
        queue.lpush.bind(queue, 'third'),
        queue.lpush.bind(queue, 'third'),
        queue.lpop.bind(queue, 4),
        driver.client.hget.bind(driver.client, nameSet, driver.shasum(data))
      ], function (err, results) {
        if (err) return done(err);
        expect(results).to.eql([
          1, 2, 3, 0,
          [ 'third', 'second', 'first', null ],
          null
        ]);
        done();
      });
    });

  });

});