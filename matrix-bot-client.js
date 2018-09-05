// Loading our configuration file
var config = require('./matrix-bot-config.js').base;

// Load required modules
var q = require('q');

// We use the matrix SDK that needs to be set by the requiring module
exports.matrixSDK = {};

// We use a matrix client that needs to be set by the requiring module
exports.matrixClient = {};


/*

 The sendBotNotice(room, message) function sends a notice to the given room.

 It is basically a wrapper around the matrix client sendNotice function with a catch for catching
 UnknownDeviceErrors.

 */
exports.sendBotNotice = function(roomId, message) {
  // Obtain a transaction ID.
  var txnId = exports.matrixClient.makeTxnId();

  return exports.matrixClient.sendNotice(roomId, message, txnId).catch(function(err) {

    if(err.name == 'UnknownDeviceError') {
      console.log('UnknownDeviceError caught. Will resend pending event...');

      // Okay. We set all devices found as known, send a warning and then retry the sent message.
      var warningText = 'WARNING: I have found new devices which I will now encrypt my messages to:';
      Object.keys(err.devices).forEach(function(userId) {
        warningText = warningText + '\n- ' + userId + ': ';
        Object.keys(err.devices[userId]).forEach(function(deviceId, idx) {
          warningText = warningText + (idx > 0 ? ', ' : '') + deviceId;

          // Set device as known!
          exports.matrixClient.setDeviceKnown(userId, deviceId);
        });
      });

      // Send warning notice.
      exports.sendBotNotice(roomId, warningText);


      // Okay. We retry the sent message.
      var room = exports.matrixClient.getRoom(roomId);

      room.getLiveTimeline().getEvents().forEach(function(evt) {
        if(evt._txnId === txnId) {
          return exports.matrixClient.resendEvent(evt, room);
        }
      });

    } else {
      // We do not handle this error
      return q.reject(err);
    }
  });
};




/*

 The sendDM(toUser, message) function sends a "direct message" to the given user.

 Direct messages are sent via 1:1 chats where the bot has admin level (power level 100) and the user has
 only "user" level. The idea is that the user should not be able to invite others or change room settings
 such that confidentiality is ensured.

 We keep track of all existing 1:1 chats that satisfy these properties, such that we can use those, and will
 create a new room (and invite the user) if no such chat exists yet.

 */
exports.sendDM = function(toUser, message) {
  return getDMRoom(toUser).then(function(roomId) {
    exports.matrixClient.sendTextMessage(roomId, message);
  });
}

// Helper function that returns a promise to a DM-suitable room.
var getDMRoom = function(userId) {
  // Do we already have a suitable room for direct messages to this user?
  var suitableRoom = exports.matrixClient.getRooms().find(function(room) {
    // This room is a DM room if and only if all three requirements are satisfied:
    // a) Only the bot and the other user are participating
    // b) The bot has power level >= 90
    // c) The user has power level 0
    // d) Invites into this room require at least power level 90

    var joinedMembers = room.getJoinedMembers();

    if(joinedMembers.length !== 2) {
      return false;
    }

    var isSuitable = true;
    room.getJoinedMembers().forEach(function(member) {
      if(member.userId === config.botUserId) {
        // This is us. Do we have sufficient power?
        if(member.powerLevelNorm < 90) { isSuitable = false; }
      } else if(member.userId === userId) {
        // This is the other person. Do they have sufficiently little power?
        if(member.powerLevelNorm !== 0) { isSuitable = false; }
      } else {
        // This is another person. This means the room is definitely not suitable.
        isSuitable = false;
      }
    });

    // What is the power level required to invite others in this room?
    var power_levels_event = room.getLiveTimeline().getState(exports.matrixSDK.EventTimeline.FORWARDS).getStateEvents('m.room.power_levels', '');

    // DEBUG DEBUG
    console.log('Received power_levels_event for room ' + room.roomId + '.');
    console.log(power_levels_event);
    // DEBUG DEBUG

    if(!power_levels_event || !power_levels_event.getContent().invite || power_levels_event.getContent().invite < 90) {
      // Required power level to invite others is lower than 90.
      isSuitable = false;
    }

    return isSuitable;
  });

  if(suitableRoom !== undefined) {
    // Return resolved promise to existing room
    return q(suitableRoom.roomId);
  } else {
    // We do not yet have a suitable room but need to create one
    return exports.matrixClient.createRoom({
      visibility: 'private',
      invite: [userId],
      name: config.botUserId
    }).then(function(res) {
      // Ok, we have the room. Now we need to change the required power levels.
      // Change required power level for invites to 100.
      powerLevelContent = {"ban":     50,
                           "kick":    50,
                           "redact":  50,
                           "invite": 100,
                           "events_default": 0,
                           "state_default": 50,
                           "users_default": 0,
                           "users": {
                           }, 
                           "events": {
                             "m.room.avatar": 50,
                             "m.room.name": 50,
                             "m.room.canonical_alias": 50,
                             "m.room.history_visibility": 100,
                             "m.room.power_levels": 100
                           }
                          };

      powerLevelContent.users[config.botUserId] = 100;

      return exports.matrixClient.sendStateEvent(res.room_id, 'm.room.power_levels', powerLevelContent).then(
        function() {
          return res.room_id;
        }
      );
    });

  }
};
