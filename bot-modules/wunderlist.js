// Configuration
var config = require("../matrix-bot-config.js").wunderlist;

// Let's go...

var request = require('request');
var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database(config.sqliteDatabase);

// From: http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
var getGUID = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

var getUserToken = function(matrix_user, callback) {
  db.get("SELECT auth_token FROM auth_tokens WHERE matrix_user = ?", matrix_user, function(err, row) {
    if(row && row['auth_token']) {
      callback(row['auth_token']);
    } else {
      callback(undefined);
    }
  });
};

var findWunderlists = function(matrix_user, listSearch, callback) {
  getUserToken(matrix_user, function(auth_token) {
    if(!auth_token) {
      callback('Sorry, it was not possible to obtain an auth token.', undefined, undefined, undefined);
    } else {
      request({
        url: 'https://a.wunderlist.com/api/v1/lists',
        method: 'GET',
        headers: { 'X-Access-Token': auth_token, 'X-Client-ID': config.wunderlistClientID },
        json: true
      }, function(err, res, body) {
        if(err || !body || !Array.isArray(body)) {
          console.log('Wunderlist: Error retrieving lists:' + err);
          console.log(body);
          callback('Sorry, there was a problem obtaining your Wunderlist lists. Please try again!', undefined, undefined, undefined);
        } else {
          // Iterate over all lists and find matching titles
          var foundLists = body.filter(function(list) {
            return (list['title'].toUpperCase().indexOf(listSearch.toUpperCase()) >= 0);
          });

          if (foundLists.length == 0) {
            // No list found
            callback('I did not find a matching list for "' + listSearch + '"!', undefined, undefined, undefined);
          } else if (foundLists.length > 1) {
            // Multiple lists found
            callback('I found multiple matching lists. Please specify the exact title:\n- ' +
              foundLists.map(function(list) {
                return list['title'];
              }).join('\n- '), undefined, undefined);
          } else {
            // Exactly one list found - good!
            callback(undefined, foundLists[0]['id'], foundLists[0]['title'], auth_token);
          }
        }
      });
    }
  });
};


exports.runQuery = function(client, query, querySender, queryRoom) {
  var req;

  console.log('Wunderlist: Received query "' + query + '"...');
  if(query && (req = query.match(/(".*?"|[^"\s]+)(?=\s*|\s*$)/g))) {
    if(req[0] === 'login') {
      // Initiate login sequence
      console.log('Wunderlist: Received login request...');

      // Is user already logged in to Wunderlist?
      getUserToken(querySender, function(auth_token) {
        if(auth_token) {
          // User already logged in, ask user to log out first.
          client.sendBotNotice(queryRoom.roomId, 'It seems you are already logged into Wunderlist. Please use !wunderlist logout if you want to logout and try to log in again.');
        } else {
          // Okay, proceed with login.

          // Add new auth request and return URL for logging into Wunderlist...
          var auth_request = getGUID();

          db.run("INSERT INTO auth_requests (id, matrix_user, room_id, secret_key, requested_at) VALUES (?, ?, ?, ?, ?)", auth_request, querySender, queryRoom.roomId, getGUID(), new Date(), function(err) {
            if(err) {
              console.log('An error occured with SQLite3: ' + err);
              client.sendBotNotice(queryRoom.roomId, 'An error occured obtaining the authentication request.');
            } else {
              // Return the URL the user can use to authenticate with Wunderlist...
              client.sendBotNotice(queryRoom.roomId, 'Please authenticate with Wunderlist here: ' + config.myServer + 'login?auth_request=' + encodeURIComponent(auth_request));
            }
          });

        }
      });

    } else if(req[0] === 'logout') {
      // Logout user
      db.run("DELETE FROM auth_tokens WHERE matrix_user=?", querySender, function(err) {
        if(err) {
          console.log('An error occured with SQLite3: ' + err);
          client.sendBotNotice(queryRoom.roomId, 'An error occured trying to log you out. Please get in touch with my supervisor.');
        } else {
          client.sendBotNotice(queryRoom.roomId, 'You are no longer logged into Wunderlist (we have thrown away your authentification token).');
        }
      });
    } else if(req[0] === 'add') {
      // Add new item
      if(!req[1] || !req[2]) {
        client.sendBotNotice(queryRoom.roomId, 'You have to specify the list to be added to and the text of the item.'); // TODO: support default lists
      } else {
        var listSearch = req[1].match(/^"?(.*?)"?$/)[1];
        var itemToAdd = req[2].match(/^"?(.*?)"?$/)[1];

        // If there is text that is not escaped with quotes, add it to the task title anyways
        for(var i = 3;i < req.length;i++) {
          itemToAdd += ' ' + req[i];
        }

        findWunderlists(querySender, listSearch, function(err, listId, listTitle, auth_token) {
          if(err) {
            client.sendBotNotice(queryRoom.roomId, err);
          } else {
            request(
              {
                url: 'https://a.wunderlist.com/api/v1/tasks',
                method: 'POST',
                headers: { 'X-Access-Token': auth_token, 'X-Client-ID': config.wunderlistClientID },
                json: true,
                body: { list_id: listId, title: itemToAdd }
              }
              , function(err, res, body) {
                if(err) {
                  console.log('Wunderlist: An error occured adding task: ' + err);
                  client.sendBotNotice(queryRoom.roomId, 'An error occured trying to add your task. Please try again later!');
                } else {
                  client.sendBotNotice(queryRoom.roomId, '[' + listTitle + '] ' + itemToAdd);
                }

              }
            );
          }
        });
      }
    } else if(req[0] === 'follow') {
      if(!req[1]) {
        client.sendBotNotice(queryRoom.roomId, 'You have to specify the list you want to follow in this room.');
      } else {
        var listSearch = req[1].match(/^"?(.*?)"?$/)[1];
        findWunderlists(querySender, listSearch, function(err, listId, listTitle, auth_token) {
          if(err) {
            client.sendBotNotice(queryRoom.roomId, err);
          } else {
            // TODO: Do we already have a webhook on this list?
            db.all("SELECT * FROM monitors WHERE matrix_user = ? AND list_id = ?", querySender, listId, function(err, rows) {
              if(rows && rows.length > 0) {
                // Webhook already exists - maybe just need to add new room to it
                if (rows.filter(function(d) { return d['matrix_room'] == queryRoom.roomId; }).length >= 1) {
                  // Room already exists - we are done
                  client.sendBotNotice(queryRoom.roomId, 'We are already following the list ' + listTitle + '.');
                } else {
                  // Add new room
                  db.run("INSERT INTO monitors (matrix_room, matrix_user, list_id, list_title, webhook_id, secret_key) VALUES (?, ?, ?, ?, ?, ?)", queryRoom.roomId, querySender, listId, listTitle, rows[0]['webhook_id'], rows[0]['secret_key'], function(err) {
                    if(err) {
                      console.log('SQLite error: ' + err);
                      client.sendBotNotice(queryRoom.roomId, 'An error occurde while trying to follow ' + listTitle + '. Please try again later.');
                    } else {
                      client.sendBotNotice(queryRoom.roomId, 'We are now following the list ' + listTitle + '.');
                    }
                  });
                }

              } else {
                // No webhook exists yet - obtain new webhook and add this room
                var secret_key = getGUID();
                request(
                  {
                    url: 'https://a.wunderlist.com/api/v1/webhooks',
                    method: 'POST',
                    headers: { 'X-Access-Token': auth_token, 'X-Client-ID': config.wunderlistClientID },
                    json: true,
                    body: { list_id: listId, url: config.myServerWunderlist + 'monitor?key=' + secret_key, processor_type: 'generic', configuration: '' }
                  }
                  , function(err, res, body) {
                    if(err) {
                      console.log('Wunderlist: An error occured obtaining the webhook for ths list: ' + err);
                      client.sendBotNotice(queryRoom.roomId, 'An error occured trying to obtain notifications from Wunderlist. Please try again later!');
                    } else {
                      console.log('Received reply from Wunderlist: ');
                      console.log(body);

                      db.run("INSERT INTO monitors (matrix_room, matrix_user, list_id, list_title, webhook_id, secret_key) VALUES (?, ?, ?, ?, ?, ?)", queryRoom.roomId, querySender, listId, listTitle, body['id'], secret_key, function(err) {
                        if(err) {
                          console.log('SQLite error: ' + err);
                          client.sendBotNotice(queryRoom.roomId, 'An error occurde while trying to follow ' + listTitle + '. Please try again later.');
                        } else {
                          client.sendBotNotice(queryRoom.roomId, 'We are now following the list ' + listTitle + '.');
                        }
                      });
                    }
                  }
                );

              }
            });
          }
        });
      }
    } else if(req[0] === 'unfollow') {
      if(!req[1]) {
        client.sendBotNotice(queryRoom.roomId, 'You have to specify the list you want to unfollow in this room.');
      } else {
        var listSearch = req[1].match(/^"?(.*?)"?$/)[1];
        findWunderlists(querySender, listSearch, function(err, listId, listTitle, auth_token) {
          if(err) {
            client.sendBotNotice(queryRoom.roomId, err);
          } else {
            db.get('SELECT * FROM monitors WHERE matrix_room = ? AND matrix_user = ? AND list_id = ?', queryRoom.roomId, querySender, listId, function(err, row) {
              if(err) {
                console.log('Wunderlist: An error occured obtaining the monitors for ths list: ' + err);
                client.sendBotNotice(queryRoom.roomId, 'An error occured trying to obtain existing follows. Please try again later!');
              } else if(!row) {
                client.sendBotNotice(queryRoom.roomId, 'You are not currently following the list ' + listTitle + '.');
              } else {
                var myWebhook = row['webhook_id'];

                db.serialize(function() {
                  db.run("DELETE FROM monitors WHERE matrix_room = ? AND matrix_user = ? AND list_id = ? AND webhook_id = ?", queryRoom.roomId, querySender, listId, myWebhook);
                  db.get("SELECT * FROM monitors WHERE webhook_id = ?", myWebhook, function(err, row) {
                    if(err) {
                      console.log('Wunderlist: An error occured: ' + err);
                      client.sendBotNotice(queryRoom.roomId, 'An error occured trying to obtain existing follows. Please try again later!');
                    } else {
                      if(!row) {
                        // Webhook is no longer needed - remove from Wunderlist
                        request(
                          {
                            url: 'https://a.wunderlist.com/api/v1/webhooks/' + myWebhook,
                            method: 'DELETE',
                            headers: { 'X-Access-Token': auth_token, 'X-Client-ID': config.wunderlistClientID }
                          }
                          , function(err, res, body) {
                            if(err) {
                              console.log('Wunderlist: An error occured removing the webhook for ths list: ' + err);
                              client.sendBotNotice(queryRoom.roomId, 'An error occured removing the webhook from Wunderlist. Please try again later!');
                            } else {
                              client.sendBotNotice(queryRoom.roomId, 'We are now no longer following ' + listTitle + '.');
                            } // TODO: We need some kind of reversals / retries here - what happens if we have already deleted the monitor-entry but webhook removal fails?
                          }
                        );
                      } else {
                        client.sendBotNotice(queryRoom.roomId, 'We are now no longer following ' + listTitle + '.');
                      }
                    }
                  });
                });
              }
            });
          }
        });
      }
    } else {
      client.sendBotNotice(queryRoom.roomId, 'I did not understand this request. Call !help wunderlist for more details.');
    }
  } else {
    client.sendBotNotice(queryRoom.roomId, 'I did not understand this request. Call !help wunderlist for more details.');
  };


/*
  var wunderlistAPI = new WunderlistSDK({
    'accessToken': 'a user access_token',
    'clientID': 'your client_id'
  });

  wunderlistAPI.http.lists.all()
    .done(function (lists) {
      // do stuff
    })
    .fail(function () {
      console.error('there was a problem');
    });
*/

};

exports.webRequest = function(client, path, query, res) {
  console.log('Wunderlist - Received web request for ' + path);

  if(path === 'login' && query['auth_request']) {
    db.get("SELECT matrix_user, room_id, secret_key FROM auth_requests WHERE id = ?", query['auth_request'], function(err, row) {
      if(row && row['matrix_user']) {
        // Ok, let's start OAuth procedure by redirecting to Wunderlist...
        res.redirect('https://www.wunderlist.com/oauth/authorize?client_id=' + encodeURIComponent(config.wunderlistClientID) + '&redirect_uri=' + encodeURIComponent(config.myServer + 'process_login?auth_request=' + encodeURIComponent(query['auth_request'])) + '&state=' + encodeURIComponent(row['secret_key']));
      } else {
        res.send('Authentication request invalid. Please try again in Matrix.');
      }
    });
  } else if(path === 'process_login' && query['auth_request'] && query['state'] && query['code']) {
    db.get("SELECT matrix_user, room_id, secret_key FROM auth_requests WHERE id = ?", query['auth_request'], function(err, row) {
      if(row && row['matrix_user'] && row['secret_key'] === query['state']) {
        // Ok, let's exchange the code for an access token... (asymmetric)
        request({
          url: 'https://www.wunderlist.com/oauth/access_token',
          method: 'POST',
          json: true,
          body: {
            client_id: config.wunderlistClientID,
            client_secret: config.wunderlistClientSecret,
            code: query['code']
          }
        }, function(err, res, body) {
          if(err || !body || !body['access_token']) {
            console.log('Wunderlist: Error retrieving access token:' + err);
            client.sendBotNotice(row['room_id'], 'Sorry, there was a problem obtaining your Wunderlist access token. Please try again!');
          } else {
            db.run('INSERT INTO auth_tokens (matrix_user, auth_token, obtained_at) VALUES (?, ?, ?)', row['matrix_user'], body['access_token'], new Date(), function(err) {
              if(err) {
                console.log('Wunderlist: Error writing to database:');
                console.log(err);
                client.sendBotNotice(row['room_id'], 'Sorry, there was a problem storing your Wunderlist access token. Please try again!');
              } else {
                client.sendBotNotice(row['room_id'], 'Thank you! Your matrix user is now authenticated for use with Wunderlist.');
              }
            });
          }
        });

        res.send('Thank you. Your matrix user is now authenticated for use with Wunderlist.');
      } else {
        res.send('Authentication request invalid. Please try again in Matrix.');
      }
    });
  } else if(path === 'monitor') {
    console.log('Received webhook from Wunderlist.');

    if(query.key && res.req.body && res.req.body.client && res.req.body.subject && res.req.body.before && res.req.body.after && res.req.body.operation) {
      var listId = res.req.body.after.list_id;
      var secretKey = query.key;

      db.each("SELECT * FROM monitors WHERE list_id=? AND secret_key=?", listId, secretKey, function(err, row) {
        // TODO: error handling
        if(!err && row) {
          // TODO: other changes handling
          if(res.req.body.operation === 'create') {
            // New task
            client.sendBotNotice(row['matrix_room'], '[' + row['list_title'] + '] New task: ' + res.req.body.after.title);
          } else if(res.req.body.operation === 'update' && res.req.body.before.completed === false && res.req.body.after.completed === true) {
            // Task completed
            // TODO: who completed task?
            client.sendBotNotice(row['matrix_room'], '[' + row['list_title'] + '] Completed: ' + res.req.body.after.title);
          }
        }
      });
    }


    console.log('----- WUNDERLIST WEBHOOK BODY -----');
    console.log(res.req.body);

    res.send('Done.');
  } else {
    res.send('Command unavailable.');
  }
};


exports.getHelp = function(details) {
  return 'I can help you keep track of your Wunderlist todos. You can use the following commands:\n' +
         '!wunderlist add "<List Name>" <New Todo> - adds <New Todo> to your list <List Name>\n' +
         '!wunderlist follow "<List Name>" - makes me follow the given list and to announce new and completed tasks\n' +
         '!wunderlist unfollow "<List Name>" - makes me unfollow the given list\n\n' +
         'I will authenticate with your Wunderlist account using OAuth. For this, the first time you want to use Wunderlist, you need to authenticate using "!wunderlist login". If you want me to remove your authorization, call "!wunderlist logout".';
};
