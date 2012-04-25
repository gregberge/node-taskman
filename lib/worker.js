/**
 * Node worker
 * Permet de dépiler une file d'attente
 * et d'éxécuter une fonction sur chacune des actions
 */

var Worker = function(fc)
{
   this.started = false;
   this.running = false;
   this.fc = fc;
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
   
   k.running = true;
   
   k.fc().then(function()
   {
      k.running = false;
      if(k.started === true)
      {
         k.run();
      }
   });
};

/**
 * Arrêt du worker
 */
Worker.prototype.stop = function()
{
   this.started = false;
};

exports.Worker = Worker;