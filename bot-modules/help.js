///// CONFIGURATION OF HELP MODULES

var helpModules = {};

var bitmessage = require("./bitmessage.js");
//helpModules['bitmessage'] = bitmessage.getHelp;

var calculate = require("./calculate.js");
//helpModules['calculate'] = calculate.getHelp;

var dice = require("./dice.js");
helpModules['dice'] = dice.getHelp;

var kanban = require("./kanban.js");
//helpModules['kanban'] = kanban.getHelp;

var senddm = require("./senddm.js");
//helpModules['senddm'] = senddm.getHelp;

var traceroute = require("./traceroute.js");
helpModules['traceroute'] = traceroute.getHelp;

var weather = require("./weather.js");
helpModules['weather'] = weather.getHelp;

var weather = require("./webhook.js");
helpModules['webhook'] = weather.getHelp;

var whois = require("./whois.js");
helpModules['whois'] = whois.getHelp;

var wunderlist = require("./wunderlist.js");
//helpModules['wunderlist'] = wunderlist.getHelp;


exports.runQuery = function(client, query, querySender, queryRoom) {
  var params, line;

  console.log('Helped called for ' + query);

  if(query && (params = query.match(/([a-zA-Z0-9]+)( (.+))?/))) {
    if(helpModules[params[1]]) {
      line = helpModules[params[1]](params[3]);
    } else {
      line = 'Hello there! Unfortunately, the module "' + params[1] + '" does not yet exist...';
    }
  } else {
    line = 'Hello there! I am providing the following helpful features (just call help with the individual module to get additional information):\n\n';

    Object.keys(helpModules).forEach(function(k) {
      line += '!help ' + k + '\n';
    });
    
    line += '\nIf you want me to help you in your own Matrix room, just invite me and I will join automatically. You do no longer want me in your room? Just kick me out.';
  }

  console.log(line);
  client.sendBotNotice(queryRoom.roomId, line);
};
