/**
 * Redis queue driver
 */

var redis = require("redis"),
    deferred = require("deferred");
    redisDriver = {};

/**
 * Client redis
 * @var object
 */
redisDriver.client = null;

/**
 * Initialize deferred
 * @var deferred
 */
redisDriver.initializeD = deferred();

/**
 * Initialisation
 * @return promise
 */
redisDriver.initialize = function()
{
   var k = this, d = this.initializeD;
   
   k.client = redis.createClient(6379, 'arnold.lemonde-interactif.fr');

   k.client.select(3, function(err, res)
   {
      if(err) d.reject(err);
      
      d.resolve(res);
   });
   
   return d.promise;
};

/**
 * Retourne le nom complet de la queue
 */
redisDriver.getCompleteQueueName = function(queue)
{
   return "queue:notify:" + queue;
};

/**
 * Retourne la prochaîne valeur de la queue
 * @param string queue
 * @return promise
 */
redisDriver.getNextValueFromQueue = function(queue)
{
   var k = this, d = deferred();
   
   queue = k.getCompleteQueueName(queue);
   
   k.initialize().then(function()
   {
      k.client.lpop(queue, function(err, res)
      {
         if(err) d.reject(err);
         
         d.resolve(res);
      });
   });
   
   return d.promise;
};

exports.driver = redisDriver;