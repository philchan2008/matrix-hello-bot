// Wolfram Alpha integration


var request = require('request');
var xmlParseString = require('xml2js').parseString;
var config = require('../matrix-bot-config.js').calculate;

// http://api.wolframalpha.com/v2/query?appid=xxx&input=35%20USD%20to%20CHF&format=plaintext


exports.runQuery = function(client, query, querySender, queryRoom) {
  request('http://api.wolframalpha.com/v2/query?appid=' + config.wolframApiKey + "&input=" + encodeURIComponent(query) + "&format=plaintext", function (error, response, body) {
    if (!error && response.statusCode == 200) {
      xmlParseString(body, function (err, result) {
        var line = '';

        if(err) {
          line = 'An error occured when parsing XML data: ' + err;
        } else if(!result['queryresult'] || !result['queryresult']['pod']) {
          console.log('Received error XML from WolframAlpha: ' + body);
          line = 'Wolfram Alpha did not understand your query. Maybe rephrase it? You can try your query on the web at https://www.wolframalpha.com/input/?i=' + encodeURIComponent(query);	
        } else {
          console.log('Received valid XML data from WolframAlpha: ' + body);

          var plaintexts = [];

          result['queryresult']['pod'].forEach(function(d) {
            //console.log("Found pod: " + JSON.stringify(d));
            if(d['$'] && d['$']['primary'] && d['$']['primary'] === 'true') {
              //console.log("Found primary pod.");
              d['subpod'].forEach(function(subpod) {

                //console.log("Found subpod: " + JSON.stringify(subpod));
                if(subpod['plaintext']) {
                  //console.log("Found plaintext: " + JSON.stringify(subpod['plaintext']));
                  plaintexts = plaintexts.concat(subpod['plaintext']);
                }
              });
            }
          });

          line = query + ' = ' + (plaintexts.length > 1 ? '\n' : '') + plaintexts.join('\n') + '\n[Results from WolframAlpha]';
        }

        console.log(line);
        client.sendBotNotice(queryRoom.roomId, line);
      });
    } else {
      console.log('An error occured calculating:\n' + body);
      client.sendBotNotice(queryRoom.roomId, 'An error occured calculating:\n' + body);
    }


  })
};


exports.getHelp = function(details) {
  return 'You can use !calculate followed by keywords understood by WolframAlpha to obtain a result for the given computation. Example queries include:\n' +
         '!calculate 3 + 5 (which returns 8)\n' +
         '!calculate 3m in feet (which returns 9.843 feet)\n' +
         '!calculate height of the Eiffel tower (which returns 324 meters)';
};
