// Whois

var exec = require('child_process').exec;


exports.runQuery = function(client, query, querySender, queryRoom) {
  var hostMatch, traceroute;

  console.log('Whois: Received query "' + query + '"...\n');
  if(query && (hostMatch = query.match(/[a-zA-Z0-9][a-zA-Z0-9\.\-]+/))) {
    // executes
    console.log('Whois: Running for ' + hostMatch[0] + '...');
    exec("/usr/bin/whois " + hostMatch[0], function (error, stdout, stderr) {
      var line = '';
      if (error !== null) {
        line = 'Whois error: ' + stderr;
      } else {
        line = 'Whois:\n' + stdout;
      }

      console.log(line);
      client.sendBotNotice(queryRoom.roomId, line);
    });
  }
};

exports.getHelp = function(details) {
  return 'You can use !whois followed by a domain name to get whois data for the given domain.';
};
