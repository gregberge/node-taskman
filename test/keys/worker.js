var workerKey = require('../../lib/keys/worker');
var expect = require('chai').expect;

describe('Worker key', function() {
  describe('#formatHash', function() {
    it('should format key', function() {
      expect(workerKey.formatHash('test', 'w1')).to.equal('worker:test:w1');
    });
  });
});
