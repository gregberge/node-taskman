var parser = require('../../lib/parsers/json');
var expect = require('chai').expect;

describe('JSON parser', function() {
  describe('#format', function() {
    it('should catch errors', function(done) {
      // Create a circular structure.
      var obj = {};
      obj.obj = obj;

      parser.format(obj, function(err) {
        expect(err).to.exist;
        done();
      });
    });

    it('should format data', function(done) {
      var obj = { foo: 'bar' };

      parser.format(obj, function(err, data) {
        if (err) return done(err);
        expect(data).to.equal('{"foo":"bar"}');
        done();
      });
    });
  });

  describe('#parse', function() {
    it('should catch errors', function(done) {
      parser.parse('{foo:bar}', function(err) {
        expect(err).to.exist;
        done();
      });
    });

    it('should parse data', function(done) {
      parser.parse('{"foo":"bar"}', function(err, data) {
        if (err) return done(err);
        expect(data).to.eql({ foo: 'bar' });
        done();
      });
    });
  });
});
