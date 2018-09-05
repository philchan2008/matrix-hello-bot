exports.runQuery = function(client, query, querySender, queryRoom) {
  var params, line;

  console.log('Dice called for ' + query);

  var numSides = 6;
  if (query && (params = query.match(/([0-9]+)/))) {
    numSides = params[1];
  }

  var result = Math.floor((Math.random()*numSides)+1);

  client.sendBotNotice(queryRoom.roomId, 'Our ' + numSides + '-sided dice rolled a ' + result + '.');
};

exports.getHelp = function(details) {
  return 'You can use !dice to roll a dice. If you specify a number after !dice, we will run a dice with the given number of sides.';
};
