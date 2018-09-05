// Weather

var config = require('../matrix-bot-config.js').weather;
var request = require('request');

var formatTime = function(dt) {
  var dd = dt.getUTCDate();
  if (dd<10) dd = '0' + dd;

  var mm = dt.getUTCMonth() + 1; // now moths are 1-12
  if (mm<10) mm= '0' + mm;

  var hh = dt.getUTCHours();
  if(hh<10) hh = '0' + hh;

  var minutes = dt.getUTCMinutes();
  if(minutes<10) minutes = '0' + minutes;

  return dd + '.' + mm + '. ' + hh + ':' + minutes;
}

exports.runQuery = function(client, query, querySender, queryRoom) {
  if(!query) {
    client.sendBotNotice(queryRoom.roomId, 'Please specify the city for which you want a forecast.');
  }

  request({url: 'http://api.openweathermap.org/data/2.5/forecast?q=' + encodeURIComponent(query) + '&mode=json&units=metric&appid=' + encodeURIComponent(config.weatherApiKey), method: 'GET', json: true }, function (error, response, body) {
    if (!error && response.statusCode == 200 && body && body['city'] && body['list'] && Array.isArray(body['list'])) {
      console.log('Weather data:')
      console.log(body);

      var line = 'Forecast for ' + body['city']['name'] + ', ' + body['city']['country'] + ':\n';

      body['list'].filter(function(d, i) {
        return (i <= 8 || (i % 8) === 0);
      }).forEach(function(d) {
          line += formatTime(new Date(d['dt']*1000)) + ': ' +  Math.round(d['main']['temp']) + '°C, ' + d['weather'][0]['description'] + '\n';
      });

      line += '[From OpenWeatherMap, all times in UTC]';

      console.log(line);
      client.sendBotNotice(queryRoom.roomId, line);

    } else if (!error && response.statusCode == 200 && body && body['cod'] && body['cod'] !== '200') {
      console.log(body['message'] + ' (' + body['cod'] + ')');
      client.sendBotNotice(queryRoom.roomId, body['message']);
    } else {
      console.log('An error occured obtaining weather data:\n' + body);
      client.sendBotNotice(queryRoom.roomId, 'An error occured obtaining weather data:\n' + body);
    }
  })
};



exports.getHelp = function(details) {
  return 'You can use !weather followed by a city to get weather details for the given city (powered by OpenWeatherMap).';
};
