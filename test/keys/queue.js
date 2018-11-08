var queueKey = require('../../lib/keys/queue');
var expect = require('chai').expect;

describe('Queue key', function() {
  describe('#formatList', function() {
    it('should format key', function() {
      expect(queueKey.formatList('test')).to.equal('queue:test');
    });
  });

  describe('#formatSet', function() {
    it('should format key', function() {
      expect(queueKey.formatSet('test')).to.equal('unique:test');
    });
  });
});
