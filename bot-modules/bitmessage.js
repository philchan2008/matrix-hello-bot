// Bitmessage integration

// Configuration
var config = require('../matrix-bot-config.js').bitmessage;

// Needs XML-RPC to communicate with the Bitmessage API
var xmlrpc = require('xmlrpc');
var xmlrpcClient = xmlrpc.createClient(config.apiUrl);
var doNothing = function() { return; };

// Needs sqlite database to store bitmessage IDs and their status (as not fully supported via API yet)
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(config.sqliteDatabase);

// Required to convert Unicode to Base64 (as expected by BM API)
var base64 = require('base64-js');
var textEncoding = require('text-encoding');
var myEncoder = new textEncoding.TextEncoder();
var myDecoder = new textEncoding.TextDecoder();

var encodeString = function(str) {
  return base64.fromByteArray(myEncoder.encode(str));
};

var decodeString = function(str) {
  console.log('--- DECODE : SOURCE ---');
  console.log(str);
  console.log('-----------------------');

  return myDecoder.decode(base64.toByteArray(str.replace(/\n/g,"")));
};



exports.runQuery = function(client, query, querySender, queryRoom) {
  var req;

  console.log('Bitmessage: Received query "' + query + '"...');
  if(query && (req = query.match(/^(on|off|send)( +"?(BM-[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+|)"? +(.*)|)$/))) {
    if(req[1] == 'send') {
      console.log('Bitmessage: Processing send request...');
      if(!req[3] || !req[4]) {
        client.sendBotNotice(queryRoom.roomId, 'You have to specify the bitmessage ID and the message to be sent.');
      } else {
        var recipientId = req[3];
        var message = req[4];

        // Is bitmessage on for this room?
        db.all("SELECT * FROM bm_rooms WHERE active = 1 AND room = ?", queryRoom.roomId, function (err, rows) {
          if (rows && rows.length > 0) {
            // Ok, send the message using the API
            var senderId = rows[0]['bm_id'];

            // subject -> UTF-8 -> Base64
            var subjectBase64 = encodeString('Matrix message from ' + querySender + ' in ' + queryRoom.name);

            // message -> UTF-8 -> Base 64
            var messageBase64 = encodeString(message);

            // Sends a method call to the XML-RPC server
            xmlrpcClient.methodCall('sendMessage', [recipientId, senderId, subjectBase64, messageBase64], function (error, value) {
              if(error) {
                client.sendBotNotice(queryRoom.roomId, 'An error occured trying to deliver your message. Please try again.');
                console.log('An error occured communicating with Bitmessage API.');
                console.log(error);
              } else {
                // Results of the method response
                console.log('Method response for \'sendMessage\': ' + value);
              }
            });

          } else {
            client.sendBotNotice(queryRoom.roomId, 'Bitmessage is not active for this room. Run "!bitmessage on" first.');
          }
        });
      }
    } else if(req[1] == 'on') {
      console.log('Bitmessage: Processing on request...');

      // Do we already have an address in the database?
      db.all("SELECT * FROM bm_rooms WHERE room = ?", queryRoom.roomId, function (err, rows) {
        if (rows && rows.length > 0) {
          if (rows[0]['active'] == 0) {
            // Reactivate
            db.run("UPDATE bm_rooms SET active=1 WHERE room = ?", queryRoom.roomId, function (err) {
              if (err || this.changes === 0) {
                client.sendBotNotice(queryRoom.roomId, 'I could not reactivate bitmessage for this room because an error occured.');
                console.log(err);
              } else {
                client.sendBotNotice(queryRoom.roomId, 'This room is now listening to bitmessages at ' + rows[0].bm_id + '.');
              }
            });
          } else {
            // Do nothing
            client.sendBotNotice(queryRoom.roomId, 'This room is already listening to bitmessages at ' + rows[0].bm_id + '.');
          }
        } else {
          // We need to create a new addresse via the API...
          var myLabel = encodeString(queryRoom.roomId);

          xmlrpcClient.methodCall('createRandomAddress', [myLabel], function (error, value) {
            if (!error && value.match(/^BM-[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/)) {
              // ... and add to the database ...
              db.run("INSERT INTO bm_rooms (room, bm_id, active) VALUES (?, ?, 1)", queryRoom.roomId, value, function (err) {
                if (err) {
                  client.sendBotNotice(queryRoom.roomId, 'I could not store the bitmessage ID for this room because an error occured. Please try again later.');
                  console.log(err);
                } else {
                  client.sendBotNotice(queryRoom.roomId, 'This room is now listening to bitmessages at ' + value + '.');
                }
              });
            } else {
              client.sendBotNotice(queryRoom.roomId, 'An error occured trying to create a new bitmessage ID for this room. Please try again.');
              console.log('An error occured communicating with Bitmessage API.');
              console.log(error);
              console.log(value);
            }
          });
        }
      });

    } else if(req[1] == 'off') {
      console.log('Bitmessage: Processing off request...');

      // Mark as disabled in database (we do not want to delete it from PyBitmessage and at the moment there is
      // no way to disable it using the API)
      db.run("UPDATE bm_rooms SET active=0 WHERE active = 1 AND room = ?", queryRoom.roomId, function (err) {
        if (err) {
          client.sendBotNotice(queryRoom.roomId, 'I could not deactive bitmessage for this room because an error occured.');
          console.log(err);
        } else if (this.changes === 0) {
          client.sendBotNotice(queryRoom.roomId, 'Nice try, but bitmessage isn\'t active for this room so I cannot switch it off!');
        } else {
          client.sendBotNotice(queryRoom.roomId, 'Ok, I will keep the bitmessage ID for now but won\'t show anymore messages.');
        }
      });
    }

  }
};




// We use our web API to receive new message notifications (using the included shell script and curl)
exports.webRequest = function(client, path, query, res) {
  console.log('Bitmessage - Received web request for ' + path);

  if(path === 'newMessage' && query['secret_key'] && query['secret_key'] === config.webSecretKey) {
    // Ok, we retrieve all messages from the INBOX...
    xmlrpcClient.methodCall('getAllInboxMessages', [ ], function (error, value) {
      var parsedJSON = (value ? JSON.parse(value) : undefined);
      if(error || !parsedJSON || !Array.isArray(parsedJSON['inboxMessages'])) {
        // Fail silently
        console.log('An error occured communicating with Bitmessage API, trying to retrieve new messages.');
        console.log(error);
        console.log(value);
      } else {
        // Ok, iterate over all messages...
        parsedJSON['inboxMessages'].forEach(function(message) {
          // To which room is this message targeted?
          db.get('SELECT room FROM bm_rooms WHERE bm_id = ? AND active = 1', message['toAddress'], function(err, row) {
            if(err) {
              // If it fails, we fail silently and will retry when the next message has been received.
              console.log('Error retrieving room for bitmessage ID from database: ' + err);
            } else {
              // Ok, did we get a record and is the message not to be ignored (encodingType 0)?
              if(row && row['room'] && message['encodingType'] !== 0) {
                // Room is active. Post message to room and trash it if successful.
                var sendMessage;
                if(message['encodingType'] === 2) {
                  sendMessage = '[Bitmessage] ' + decodeString(message['subject']) + ' (from ' + message['fromAddress'] + ')\n' + decodeString(message['message']);
                } else {
                  sendMessage = '[Bitmessage] Message with unsupported encoding type received from ' + message['fromAddress'] + '.';
                }

                client.sendBotNotice(row['room'], sendMessage).then(function() {
                  // Ok, notice sending was successful, so we can trash the message.
                  xmlrpcClient.methodCall('trashMessage', [ message['msgid'] ], doNothing);
                });

              } else {
                // Ok, so this room is not active. We just trash the message so that it does not clutter the inbox.
                xmlrpcClient.methodCall('trashMessage', [ message['msgid'] ], doNothing);
              }
            }
          });
        });

      }
    });

    res.send('Done.');
  } else {
    res.send('Command unavailable.');
  }
};




exports.getHelp = function(details) {
  return 'I can help you send and receive messages on Bitmessage. You can use the following commands:\n' +
    '!bitmessage send <BM-ID> <Text> - sends the given text to the given bitmessage ID (only works if bitmessage is "on" for the room)\n' +
    '!bitmessage on - activates bitmessage for the room, returning a bitmessage ID on which the room can now send and receive bitmessages\n' +
    '!bitmessage off - deactivates bitmessage for the room, ignoring future bitmessages to the rooms bitmessage ID';
};
