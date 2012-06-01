/**
 * Worker
 * Pop a queue to execute some task
 */

var defaultOptions = {
   type : 'right',
   loopSleepTime : 5,
   waitingTimeout : 30
};

var extend = function(target)
{
   var ar = [];
   ar.slice.call(arguments, 1).forEach(function(source) {
      for (key in source)
        if (source[key] !== undefined)
          target[key] = source[key];
   });
   
   return target;
};

/**
 * Create worker
 * @param Queue queue Queue
 * @param object driver Driver
 * @param function action Action 
 */
var Worker = function(queue, driver, action, options)
{
   this.queue = queue;
   this.driver = driver;
   this.action = action;
   this.options = extend(defaultOptions, options);
};


exports.Worker = Worker;