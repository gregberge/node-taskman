var redis = require("redis"),
    deferred = require("deferred");


/**
 * Redis queue driver
 */
var RedisDriver = function(config)
{
   this.port = config.port;
   this.host = config.host;
   this.db = config.db;
   this.client = null;
   this.initializeD = deferred();
};

/**
 * Initialisation
 */
RedisDriver.prototype.initialize = function()
{
   var d = this.initializeD;
   
   this.client = redis.createClient(this.port, this.host);

   this.client.select(this.db, function(err, res)
   {
      if(err) d.reject(err);
      
      d.resolve(res);
   });
   
   return d.promise;
};

/**
 * Retourne le nom complet de la queue
 * @return string
 */
RedisDriver.prototype.getCompleteQueueName = function(queue)
{
   return "queue:" + queue;
};


/**
 * Retourne la prochaîne valeur de la queue
 * @param string queue
 * @return promise
 */
RedisDriver.prototype.getNextValueFromQueue = function(queue)
{
   var k = this, d = deferred();
   
   queue = this.getCompleteQueueName(queue);
   
   this.initialize().then(function()
   {
      k.client.lpop(queue, function(err, res)
      {
         if(err) d.reject(err);
         
         d.resolve(res);
      });
   });
   
   return d.promise;
};

exports.RedisDriver = RedisDriver;