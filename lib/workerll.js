var Deferred = require("jquery-deferred").Deferred;

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
   this.multiNumber = 1;
   
   this.initializeD = new Deferred();
   
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
      
      if(typeof options.multiNumber === "number")
      {
         this.multiNumber = options.multiNumber;
      }
   }
   
   if( this.multiNumber > 0 === false)
   {
      throw new Exception("Erreur, multi doit être supérieur à 0");
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
      return d.promise();
   }
   
   this.driver.initialize().done(d.resolve);
   
   return d.promise();
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
   
   this.initialize().done(function()
   {
      k.running = true;
      
      k.getNextValuesFromQueue().then(function(res)
      {
         if(res[0] === null)
         {
            if(k.waitTime === 0)
            {
               k.run.bind(k);
               return ;
            }
            
            setTimeout(k.run.bind(k), k.waitTime);
            return ;
         }
         
         k.callback(res, k.runCallback.bind(k), k);
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

Worker.prototype.getNextValuesFromQueue = function()
{
   return this.driver.getNextValuesFromQueue(this.queue, this.multiNumber);
};

/**
 * Arrêt du worker
 */
Worker.prototype.stop = function()
{
   this.started = false;
};

exports.Worker = Worker;