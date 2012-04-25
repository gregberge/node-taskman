/**
 * Gestionnaire de queue
 */

var deferred = require('deferred'),
    redisQueueDriver = require('./driver/redis').driver;
    queueHandler = {};

queueHandler.driver = null;
queueHandler.initializeD = deferred();

/**
 * Initialisation de la queue
 * @return promise
 */
queueHandler.initialize = function()
{
   var d = this.initializeD;
   
   if(this.driver === null)
   {
      this.driver = redisQueueDriver;
   }
   
   redisQueueDriver.initialize().then(d.resolve);
   
   return d.promise;
};

/**
 * Connexion
 */
queueHandler.getNextValueFromQueue = function(queue)
{
   var k = this, d = deferred();
   
   queueHandler.initialize().then(function()
   {
      k.driver.getNextValueFromQueue(queue).then(d.resolve);
   });
   
   return d.promise;
};

exports.handler = queueHandler;