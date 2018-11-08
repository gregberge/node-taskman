var expect = require('chai').use(require('sinon-chai')).expect;
var sinon = require('sinon');
var EventEmitter = require('events').EventEmitter;
var util = require('../lib/util');

describe('Util', function() {
  describe('#wrapCallback', function() {
    var emitter, onErrorSpy;

    beforeEach(function() {
      onErrorSpy = sinon.spy();
      emitter = new EventEmitter();
      emitter.on('error', onErrorSpy);
    });

    it('should call callback if present', function() {
      var callback = sinon.spy();
      util.wrapCallback(emitter, callback)('err', 'res');

      expect(callback).to.be.calledWith('err', 'res');
      expect(onErrorSpy).to.not.be.called;
    });

    it('should call emitter else', function() {
      util.wrapCallback(emitter)('err');
      expect(onErrorSpy).to.be.calledWith('err');
    });

    it('should not call emitter if there is no error', function() {
      util.wrapCallback(emitter)();
      expect(onErrorSpy).to.not.be.called;
    });
  });
});
