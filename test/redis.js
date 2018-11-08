var sinon = require('sinon');
var expect = require('chai').use(require('sinon-chai')).expect;
var redis = require('../lib/redis');
var legacyRedis = require('redis');

describe('Redis', function() {
  describe('#createClient', function() {
    beforeEach(function() {
      sinon.stub(legacyRedis, 'createClient').returns('redis client');
    });

    afterEach(function() {
      legacyRedis.createClient.restore();
    });

    it('should create a new redis client from a function', function() {
      var client = redis.createClient(function() {
        return 'foo';
      });

      expect(client).to.equal('foo');
    });

    it('should create a new redis client without options', function() {
      var client = redis.createClient();
      expect(client).to.equal('redis client');
    });

    it('should create a new redis client from options', function() {
      var client = redis.createClient({
        host: 'localhost',
        port: 6379,
        connect_timeout: 10,
      });

      expect(client).to.equal('redis client');
      expect(legacyRedis.createClient).to.be.calledWith(6379, 'localhost', {
        connect_timeout: 10,
      });
    });
  });
});
