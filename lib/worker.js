/**
 * Worker
 * Pop a queue to execute some task
 */

var defaultOptions = {
   type : 'FIFO',
   loopSleepTime : 0,
   pauseSleepTime : 5,
   waitingTimeout : 1,
   dataPerTick : 1,
   expire : 17280000
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
 * @param string name Worker name
 * @param function action Action 
 * @param object options Options
 */
var Worker = function(queue, driver, name, action, options)
{
   this.queue = queue;
   this.driver = driver;
   this.action = action;
   this.options = extend(defaultOptions, options);
   this.completeName = this.queue.getName() + ":" + name;
   this.initialized = false;
};

/**
 * Status "STARTED"
 * @type string
 */
Worker.STATUS_STARTED = 'STARTED';

/**
 * Status "PAUSED"
 * @type string
 */
Worker.STATUS_PAUSED = 'PAUSE';

/**
 * Status "WORKING"
 * @type string
 */
Worker.STATUS_WORKING = 'WORKING';

/**
 * Status "WAITING"
 * @type string
 */
Worker.STATUS_WAITING = 'WAITING';

/**
 * Status "SLEEPING"
 * @type string
 */
Worker.STATUS_SLEEPING = 'SLEEPING';

/**
 * Type "FIFO"
 * @type string
 */
Worker.TYPE_FIFO = 'FIFO';

/**
 * Type "LIFO"
 * @type string
 */
Worker.TYPE_LIFO = 'LIFO';

/**
 * Initialize the worker
 */
Worker.prototype.initialize = function(callback)
{
   if(this.initialized)
   {
      callback();
      return ;
   }
   
   var callbackCount = 6, k = this;
   
   var inc = function(err, res)
   {
      if(err)
      {
         callback(err, res);
         return;
      }
      
      callbackCount--;
      
      if(callbackCount === 0)
      {
         k.initialized = true;
         callback();
      }
   };
   
   this.driver.initialize(function(){
      k.setWaitingTimeout(k.options.waitingTimeout, inc);
      k.setLoopSleepTime(k.options.loopSleepTime, inc);
      k.setPauseSleepTime(k.options.pauseSleepTime, inc);
      k.setDataPerTick(k.options.dataPerTick, inc);
      k.setAction(k.action, inc);
      k.setType(k.options.type, inc);
      k.setLanguage();
      k.setProcessId();
   });
};

/**
 * Start the worker
 * @param function callback Callback
 */
Worker.prototype.start = function(callback)
{
   var k = this;
   
   this.initialize(function()
   {
      k.setStatus(Worker.STATUS_STARTED, callback);
      
      var endDate = new Date(new Date().getTime() + k.options.expire).toJSON();
      k.setEndDate(endDate);
      
      k.process();
   });
};

/**
 * Pause the worker
 * @param function callback Callback
 */
Worker.prototype.pause = function(callback)
{
   var k = this;
   
   this.initialize(function()
   {
      k.setStatus(Worker.STATUS_PAUSED, callback);
   });
};

/**
 * Stop the worker
 * @param function callback Callback
 */
Worker.prototype.stop = function(callback)
{
   var k = this;
   
   this.initialize(function()
   {
      k.setEndDate(null, callback);
   });
};

/**
 * Process of the worker
 */
Worker.prototype.process = function()
{
   var k = this;
   
   this.getInfos(function(err, infos)
   {
      if(infos.end_date === "" || infos.end_date === null || new Date().getTime() > new Date(infos.end_date).getTime())
      {
         process.nextTick(function(){
            process.exit(0);
         });
      }
            
      if(infos.status === Worker.STATUS_PAUSE)
      {
         var pauseTime = infos.pause_sleep_time * 1000;
         Worker.prototype.setEndDate(new Date(new Date().getTime() + pauseTime).toJSON());
         setTimeout(k.process.bind(k), pauseTime);
         return;
      }
      
      if(infos.type === Worker.TYPE_FIFO)
         typeFunction = "lpop";
      else
         typeFunction = "rpop";
      
      k.queue[typeFunction](infos.data_per_tick, function(err, result)
      {
         if(result[0] === null)
         {
            setTimeout(k.process.bind(k), infos.waiting_timeout * 1000);
            k.setStatus(Worker.STATUS_WAITING);
            return ;
         }
         
         var callback = function() {
            
            if(infos.loop_sleep === 0)
            {
               k.process.bind(k)();
               return ;
            }
            
            setTimeout(k.process.bind(k), infos.loop_sleep * 1000);
            k.setStatus(Worker.STATUS_SLEEPING);
         };
         
         k.setStatus(Worker.STATUS_WORKING);
         k.action.call(null, result, callback, k);
      });
   });
};

/**
 * Set the status of the worker
 * @param string status Worker status
 * @param function callback Callback
 */
Worker.prototype.setStatus = function(status, callback)
{
   this.driver.hset(this.completeName, 'status', status, callback);
   
   var now = new Date(), date = now.toJSON();
   
   this.driver.hset(this.completeName, 'status_changedate', date);
   
   if(status === Worker.STATUS_WORKING)
   {
      this.driver.hincrby(this.completeName, 'cpt_action', 1);
   }
   
   if(status === Worker.STATUS_STARTED)
   {
      this.driver.hset(this.completeName, 'cpt_action', 0);
      this.driver.hset(this.completeName, 'start_date', date);
   }
};

/**
 * Set the end date
 * @param string date Date in format JSON
 * @param function callback Callback
 */
Worker.prototype.setEndDate = function(date, callback)
{
   this.driver.hset(this.completeName, 'end_date', date, callback);
};

/**
 * Set the loop sleep time of the worker
 * @param number time Time in seconds
 * @param function callback Callback
 */
Worker.prototype.setLoopSleepTime = function(time, callback)
{
   this.driver.hset(this.completeName, 'loop_sleep', time, callback);
};

/**
 * Set the pause sleep time of the worker
 * @param number time Time in seconds
 * @param function callback Callback
 */
Worker.prototype.setPauseSleepTime = function(time, callback)
{
   this.driver.hset(this.completeName, 'pause_sleep_time', time, callback);
};

/**
 * Set the number of data to get per tick
 * @param number number Data per tick
 * @param function callback Callback
 */
Worker.prototype.setDataPerTick = function(number, callback)
{
   this.driver.hset(this.completeName, 'data_per_tick', number, callback);
};


/**
 * Set the waiting timeout of the worker
 * @param number timeout Timeout in seconds
 * @param function callback Callback
 */
Worker.prototype.setWaitingTimeout = function(timeout, callback)
{
   this.driver.hset(this.completeName, 'waiting_timeout', timeout, callback);
};

/**
 * Set the action of the worker
 * @param function action Action
 * @param function callback Callback
 */
Worker.prototype.setAction = function(action, callback)
{
   this.action = action;
   this.driver.hset(this.completeName, 'action', action.toString(), callback);
};

/**
 * Set the type of the worker (FIFO, LIFO)
 * @param string type Type
 * @param function callback Callback
 */
Worker.prototype.setType = function(type, callback)
{
   this.driver.hset(this.completeName, 'type', type, callback);
};

/**
 * Set the language to "nodejs"
 * @param function callback Callback
 */
Worker.prototype.setLanguage = function(callback)
{
   this.driver.hset(this.completeName, 'language', "nodejs", callback);
};

/**
 * Set the pid
 * @param function callback Callback
 */
Worker.prototype.setProcessId = function(callback)
{
   this.driver.hset(this.completeName, 'process_id', process.pid, callback);
};

/**
 * Return the complete name of the worker
 * @return string The complete name of the worker
 */
Worker.prototype.getCompleteName = function()
{
   return this.driver.getCompleteWorkerName(this.completeName);
};

/**
 * Get worker infos
 * @param function callback Callback
 */
Worker.prototype.getInfos = function(callback)
{
   this.driver.hgetall(this.completeName, callback);
};


exports.Worker = Worker;