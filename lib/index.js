var deferred = require('deferred');

/**
 * Node worker
 * Permet de dépiler une file d'attente
 * et d'éxécuter une fonction sur chacune des actions
 */
var Worker = function(queue, callback, driver, options)
{
   this.queue = queue;
   this.callback = callback;

   this.started = false;
   this.running = false;
   this.driver = driver;
   this.waitTime = 4000;
   this.sleepTime = 0;
   
   this.initializeD = deferred();
   
   if(typeof options !== "undefined" && options)
   {
      if(typeof options.waitTime === "number")
      {
         this.waitTime = options.waitTime;
      }
      
      if(typeof options.sleepTime === "number")
      {
         this.sleepTime = options.sleepTime;
      }
   }
};

/**
 * Initialisation
 * @return promise
 */
Worker.prototype.initialize = function()
{
   var d = this.initializeD;
   
   if(d.resolved)
   {
      return d.promise;
   }
   
   this.driver.initialize().then(d.resolve);
   
   return d.promise;
};

/**
 * Démarrage du worker
 */
Worker.prototype.start = function()
{
   if(this.started === false)
   {
      this.started = true;
      
      if(this.running === false)
      {
         this.run();
      }
   }
};

/**
 * Process du worker
 */
Worker.prototype.run = function()
{
   var k = this;
   
   this.initialize().then(function()
   {
      k.running = true;
      
      k.getNextValueFromQueue().then(function(res)
      {
         if(res === null)
         {
            setTimeout(k.run.bind(k), k.waitTime);
            return ;
         }
         
         k.callback(res, k.runCallback.bind(k));
      });
   });
};

/**
 * Fonction appelé après la fin du run
 */
Worker.prototype.runCallback = function()
{
   this.running = false;
   
   if(this.started === true)
   {
      setTimeout(this.run.bind(this), this.sleepTime);
   }
};

Worker.prototype.getNextValueFromQueue = function()
{
   return this.driver.getNextValueFromQueue(this.queue);
};

/**
 * Arrêt du worker
 */
Worker.prototype.stop = function()
{
   this.started = false;
};

exports.Worker = Worker;
exports.RedisDriver = require("./driver/redis").RedisDriver;