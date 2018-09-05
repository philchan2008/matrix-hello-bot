// Traceroute

var exec = require('child_process').exec;


exports.runQuery = function(client, query, querySender, queryRoom) {
  var hostMatch, traceroute;

  console.log('Traceroute: Received query "' + query + '"...\n');
  if(query && (hostMatch = query.match(/[a-zA-Z0-9][a-zA-Z0-9\.\-]+/))) {
    // executes
    console.log('Traceroute: Running for ' + hostMatch[0] + '...');
    traceroute = exec("/usr/sbin/traceroute -m 30 -w 1 " + hostMatch[0], function (error, stdout, stderr) {
      var line = '';
      if (error !== null) {
        line = 'Traceroute error: ' + stderr;
      } else {
        line = 'Traceroute:\n' + stdout;
      }

      console.log(line);
      client.sendBotNotice(queryRoom.roomId, line);
    });
  }
};


exports.getHelp = function(details) {
  return 'You can use !traceroute followed by a hostname or IP address to execute a traceroute to the given host from our server. Note that this is IPv4 traceroute, so no IPv6 addresses are supported at the moment.';
};
