// Configuration
var config = require('../matrix-bot-config.js').vpn;

// Let's go...
var request = require('request');
var sqlite3 = require('sqlite3').verbose();
var q = require('q');
var qRequest = q.denodeify(request);

//var db = new sqlite3.Database(config.sqliteDatabase);
//var dbRun = q.denodeify(db.run.bind(db));
//var dbEach = q.denodeify(db.each.bind(db));


exports.getHelp = function(details) {
  return 'You can use !vpn manage your VPN keys:\n' +
<<<<<<< HEAD
         '!vpn renew - Renew vpn key. (Not yet finished)\n'
=======
         '!vpn renew - Renew vpn key. (Not yet finished)\n' +
         'Chat to #phil:flexhk.sky-computers.com for help.\n'
>>>>>>> 8f1aa5b4a9e121488768f9ff92ea3754447edbce
};
