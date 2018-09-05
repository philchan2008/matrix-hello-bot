/*
   "senddm" module

   Sets up a webhook that allows to trigger the bot to send a direct message (in a 1:1 chat)
   to a specified matrix user (MXID). Can be used e.g. for providing login URLs.
 */


// Configuration
var config = require("../matrix-bot-config.js").senddm;


// Required modules
var jsSHA = require("jssha");


// Process these web requests.
exports.webRequest = function(client, path, query, res) {
  console.log('SendDM: Received web request for ' + path);
  
  // We don't do anything if we dont have a secret key set (or it is the default).
  if(config === undefined || config.secretKey === undefined || config.secretKey === '' ||
     config.secretKey === '<insert secret key for HMAC to authorise DMs here>') {
      console.log('WARNING: Someone has tried to access the senddm module but no secret key is set!');
      console.log('WARNING: We have cancelled the request.');
  
      res.status(404);
      res.send('This function is disabled.');
      return;
  }

  if(path === 'send') {
      // Parse data provided...
      var sendData = (res.req.method === 'POST' ? res.req.body : query);

      // Valid MXID? (From Matrix spec and https://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address)
      var validMxidRe = /^@([\x21-\x7E]+):(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
      
      // Valid data provided?
      if(sendData.recipient === undefined || sendData.message === undefined || sendData.hmac === undefined || !validMxidRe.test(sendData.recipient)) {
        res.status(403);
        res.send('Invalid data.');
        return;        
      } else {
        // Compute HMAC.
        var shaObj = new jsSHA("SHA-512", "TEXT");
        shaObj.setHMACKey(config.secretKey, "TEXT");
        shaObj.update(sendData.recipient);
        shaObj.update(sendData.message);
        var hmac = shaObj.getHMAC("HEX");
        
        if(sendData.hmac !== hmac) {
          res.status(403);
          res.send('Invalid key.');
          return;          
        } else {
          // Send direct message...
          client.sendDM(sendData.recipient, sendData.message);

          // Send "OK." response.
          res.send('OK.');
          
          return;
        }
      }
      
  } else {
    console.log('senddm: Received unknown command.');
    console.log(res.req);
    res.send('Unknown command.');
  }
};





// What to display in the help function.
exports.getHelp = function(details) {
  return 'This is a module that is only used by the bot operator. It allows the operator to send direct messages to specified Matrix users.';
};
