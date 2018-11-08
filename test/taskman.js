var expect = require('chai').expect;
var taskman = require('..');
var TQueue = require('../lib/queue');
var TWorker = require('../lib/worker');

describe('Taskman', function() {
  describe('#createQueue', function() {
    it('should create a new queue without options', function() {
      var queue = taskman.createQueue('myQueue');
      expect(queue).to.be.instanceOf(TQueue);
    });

    it('should create a new queue with options', function() {
      var queue = taskman.createQueue('myQueue', { unique: true });
      expect(queue).to.be.instanceOf(TQueue);
    });
  });

  describe('#createWorker', function() {
    var queue;

    beforeEach(function() {
      queue = taskman.createQueue('myQueue');
    });

    it('should create a new worker without options', function() {
      var worker = taskman.createWorker(queue);
      expect(worker).to.be.instanceOf(TWorker);
    });

    it('should create a new worker with options', function() {
      var worker = taskman.createWorker(queue, {
        dataPerTick: 10,
        loopSleepTime: 1,
        name: 'test',
        pauseSleepTime: 1,
        type: 'FIFO',
      });
      expect(worker).to.be.instanceOf(TWorker);
    });
  });
});
