/*
   "webhook" module

   Allows users to set-up generic webhooks that when triggered will send a message (based on a user-configurable
   template) to the given room. Supports integration with a variety of services.
 */


// Configuration
var config = require("../matrix-bot-config.js").webhook;


// Required modules
var sqlite3 = require('sqlite3').verbose();
var q = require('q');

var db = new sqlite3.Database(config.sqliteDatabase);
var dbRun = q.denodeify(db.run.bind(db));
var dbGet = q.denodeify(db.get.bind(db));
var dbEach = q.denodeify(db.each.bind(db));


// From: http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
var getGUID = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};


// Main code that is triggered when a !webhook request is received
exports.runQuery = function(client, query, querySender, queryRoom) {
  console.log('Webhook: Received query "' + query + '"...\n');

  // Does the user have power level 100 in the room?
  if(queryRoom.getMember(querySender).powerLevelNorm !== 100) {
    client.sendBotNotice(queryRoom.roomId, 'You need to have administrator privileges (power level 100) in this room in order to manage the defined webhooks.');
    return;
  }

  // If yes: generate temporary request GUID...
  var adminId = getGUID();
  var currTime = new Date();

  // ... add it to the database ...
  dbRun('INSERT INTO admin_requests (id, matrix_user, room_id, room_name, type, valid_until, requested_at) VALUES (?, ?, ?, ?, "login", ?, ?)', adminId, querySender, queryRoom.roomId, queryRoom.name, new Date(currTime.getTime() + (15*60*1000)), currTime)
    .then(function() {
      // ... and send it to the requestor via DM.
      return client.sendDM(querySender, 'You can manage the webhooks for the room "' + queryRoom.name + '" using the following temporary URL, valid for 15 minutes: ' + config.myServer + 'admin/?admin_request=' + encodeURIComponent(adminId));
    })
    .catch(function(err) {
      console.log('Error while generating admin_request for webhook:');
      console.log(err);

      client.sendBotNotice(queryRoom.roomId, 'An error occured while trying to grant acesss to the webhook management. Please try again later or get help in #hello-matrix-bot@matrix.org.');
    })
    .done();
};


// Code for all the web interface requests
exports.webRequest = function(client, path, query, res) {
  var admin, webhookPath, adminPromise, adminRequest;
  console.log('Webhook: Received web request for ' + path);

  if(admin = path.match(/^admin\/([a-zA-Z0-9_\-]*)$/)) {
    // Is the admin request or session key valid?
    adminPromise = dbGet('SELECT * FROM admin_requests WHERE id=? AND valid_until >= ?', (query['admin_request'] || res.req.body['admin_request']), new Date()).then(function(row) {
      if(!row ||!row['room_id']) {
        return q.reject('The provided request key is invalid.');
      }


      // Is this a login key? If yes we will need to create a longer lasting, new session key.
      if(row['type'] === 'login') {
        adminRequest = getGUID();
        var currTime = new Date();
        return dbRun('INSERT INTO admin_requests (id, matrix_user, room_id, room_name, type, valid_until, requested_at) VALUES (?, ?, ?, ?, "session", ?, ?)', adminRequest, row['matrix_user'], row['room_id'], row['room_name'], new Date(currTime.getTime() + (24*60*60*1000)), currTime).then(
          function() {
            return row;
          }
        );
      } else {
        adminRequest = (query['admin_request'] || res.req.body['admin_request']);
      }

      return row;

    }, function(err) {
      console.log('[Webhook] Database error occured when retrieving admin key:');
      console.log(err);

      return q.reject('A database error occured. Please try again later.');
    });

    adminPromise.then(function(sessionData) {
      var formPromise;

      // Display main admin site
      var showIndex = function(notice) {
        var webhookList = [];

        return dbEach('SELECT * FROM webhooks WHERE room_id=?', sessionData['room_id'], function(err, row) {
          webhookList.push({
            id: row.id,
            room_id: row.room_id,
            name: row.name,
            last_triggered: row.last_triggered
          });
        }).then(function() {
          res.render('webhook/admin_index', {
            admin_request: adminRequest,
            session_data: sessionData,
            webhook_list: webhookList,
            notice: notice
          });
        });
      };

      // Display main admin site
      var webhookId = admin[1];

      if (webhookId === '') {
        return showIndex('');
      } else {
        if (res.req.method === 'POST' && webhookId !== 'new' && res.req.body['action'] === 'delete') {
          // Delete web hook
          return dbRun('DELETE FROM webhooks WHERE room_id=? AND id=?', sessionData['room_id'], webhookId)
            .then(function() {
              return showIndex('The specified webhook has been removed.');
            });

        } else if(res.req.method === 'POST') {
          // Store changes to new/edited web hook

          // Validate form data
          var formData = {
            name: res.req.body.name,
            template: res.req.body.template,
            active: (res.req.body.active === 'yes' ? true : false)
          };

          if(formData.name === '' || formData.template === '') {
             formData.notice = 'You have to provide a name and a template for the webhook.';
             formPromise = q(formData);
          } else {
            // Everything ok. Proceed.
            if(webhookId === 'new') {
              // New entry. Generate GUID and store to database.
              var newId = getGUID();

              formPromise = dbRun(
                'INSERT INTO webhooks (id, room_id, name, template, active, added_by, added_at, last_modified_by, last_modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                newId,
                sessionData['room_id'],
                formData.name,
                formData.template,
                formData.active,
                sessionData['matrix_user'],
                new Date(),
                sessionData['matrix_user'],
                new Date()
              ).then(
                function() {
                  webhookId = newId;
                  formData.notice = 'The webhook has been added and is now active.';
                  return formData;
                }
              );

            } else {
              // Existing entry. Update entry.
              formPromise = dbRun(
                'UPDATE webhooks SET name=?, template=?, active=?, last_modified_by=?, last_modified_at=? WHERE id=? AND room_id=?',
                formData.name,
                formData.template,
                formData.active,
                sessionData['matrix_user'],
                new Date(),
                webhookId,
                sessionData['room_id']
              ).then(
                function() {
                  formData.notice = 'The webhook has been updated.';
                  return formData;
                }
              );
            }
          }

        } else if (webhookId !== 'new') {
          // Edit existing web hook - obtain content from database
          formPromise = dbGet('SELECT * FROM webhooks WHERE room_id=? AND id=?', sessionData['room_id'], admin[1]).then(
            function(row) {
              if(!row || !row['id']) {
                return q.reject('The specified webhook does not exist for your room.');
              }

              return row;
            }
          );
        } else {
          // Nothing to do. Provide webhookData with sensible defaults.
          formPromise = q({
            active: true
          });
        }

        // Display new/edit form for web hook
        return formPromise.then(function(formData) {
          res.render('webhook/admin_form', {
            my_server: config.myServer,
            admin_request: adminRequest,
            webhook_id: webhookId,
            session_data: sessionData,
            form_data: formData
          });
        });

      }
    }).catch(function(err) {
      console.log('Sending back error message: %s', err);
      res.send('An error occured:' + err);
    }).done();

  } else if(webhookPath = path.match(/^([a-zA-Z0-9]+\-[a-zA-Z0-9]+\-[a-zA-Z0-9]+\-[a-zA-Z0-9]+\-[a-zA-Z0-9]+)$/)) {
    // Obtain webhook from database...
    dbGet('SELECT * FROM webhooks WHERE active=1 AND id=?', webhookPath[1]).then(function(webhook) {
      if(!webhook || !webhook['id']) {
        return q.reject('Webhook ' + webhookPath[1] + ' does not exist.');
      }

      // Output.
      console.log('Webhook %s has been called as %s.', webhook['id'], res.req.method);

      // Parse data provided...
      var webhookData = (res.req.method === 'POST' ? res.req.body : query);


      // Parse template using regexp replace with function call...
      var messageToSend = webhook['template'].replace(/{{([^\}]+)}}/g, function(match, parameter) {
        var paramSplit = parameter.split('/');

        var ret = webhookData[paramSplit[0]];
        var i = 1;

        while(i < paramSplit.length && ret !== undefined) {
          ret = ret[paramSplit[i]];
          ++i;
        }

        // If the parameter has not been provided in the webhook data, we will not replace it
        return (ret === undefined ? match : ret);
      });

      // Send to room...
      client.sendBotNotice(webhook['room_id'], messageToSend + '\n\n[Webhook: ' + webhook['name'] + ']');

      // Send "OK." response.
      res.send('OK.');

      // Return webhook ID.
      return(webhook['id']);

    }).then(
      function(webhookId) {
        // Webhook received, so we will asynchronously update the database.
        return dbRun('UPDATE webhooks SET last_triggered=? WHERE id=?', new Date(), webhookId);
      },
      function(err) {
        console.log('[Webhook] An ERROR occured while trying to process webhook request:');
        console.log(err);

        // Send error response.
        res.send('ERROR: ' + err);
      }
    ).done();

    // Done.


  } else {
    console.log('Webhook: Received unknown command.');
    console.log(res.req);
    res.send('Unknown command.');
  }
};



exports.getHelp = function(details) {
  return 'You can use !webhook to administer the webhooks for this room. You need to be an administrator for this room (power level 100) to be able to modify webhooks. If you are, you will receive a web link for the configuration as private message.';
};
