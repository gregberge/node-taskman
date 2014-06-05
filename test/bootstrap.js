// chai
chai = require('chai');
expect = chai.expect;
chai.Assertion.includeStack = true;

// sinon
sinon = require('sinon');
chai.use(require('sinon-chai'));
chai.use(require('chai-things'));

var base = __dirname + '/../lib/';

app = {
  base: base,
  config: require('./config')
};