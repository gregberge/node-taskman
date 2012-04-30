var redis = require("redis"),
    jQueryDeferred = require("jquery-deferred"),
    Deferred = require("jquery-deferred").Deferred;



/**
 * Redis queue driver
 */
var RedisDriver = function(config)
{
   this.port = config.port;
   this.host = config.host;
   this.db = config.db;
   this.client = null;
   this.initializeD = new Deferred();
};

/**
 * Initialisation
 */
RedisDriver.prototype.initialize = function()
{
   var d = this.initializeD;
   
   if(d.isResolved())
   {
      return d.promise();
   }
   
   this.client = redis.createClient(this.port, this.host);

   this.client.select(this.db, function(err, res)
   {
      if(err) d.reject(err);
      
      d.resolve(res);
   });
   
   return d.promise();
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
 * @param int multiNumber
 * @return promise
 */
RedisDriver.prototype.getNextValuesFromQueue = function(queue, multiNumber)
{
   var k = this, d = new Deferred(), replies = [], i, lpopd, last;
   
   queue = this.getCompleteQueueName(queue);
   
   lpopd = function()
   {
      var ds = new Deferred();
      
      k.client.lpop(queue, function(err, rep)
      {
         if(rep) replies.push(rep);
         ds.resolve();
      });
      
      return ds.promise();
   };
   
   this.initialize().done(function()
   {
      for(i = 0; i < multiNumber; i++)
      {
         last = lpopd();
      }
      
      last.done(function(){d.resolve(replies);});
   });
   
   return d.promise();
};

exports.RedisDriver = RedisDriver;