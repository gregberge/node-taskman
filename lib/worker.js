/**
 * Node worker
 * Permet de dépiler une file d'attente
 * et d'éxécuter une fonction sur chacune des actions
 */

var deferred = require('deferred'),
    redisDriver = require('./driver/redis').driver;

var Worker = function(queue, callback)
{
   this.queue = queue;
   this.callback = callback;

   this.started = false;
   this.running = false;
   this.driver = null;
   this.initializeD = deferred();
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
   
   // Driver par défaut redis
   if(this.driver === null)
   {
      this.driver = redisDriver;
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
         k.callback(res).then(function()
         {
            k.running = false;
            if(k.started === true)
            {
               k.run();
            }
         });
      });
   });
};

Worker.prototype.getNextValueFromQueue = function()
{
   return this.driver.getNextValueFromQueue(k.queue);
};

/**
 * Arrêt du worker
 */
Worker.prototype.stop = function()
{
   this.started = false;
};

exports.Worker = Worker;