// This file contains all configuration options for the individual
// modules

exports.base = {
  'botBaseUrl':       'https://matrix.org',
  'botUserId':        '<insert matrix user ID here>',
  'botPassword':      '<insert bot password here (currently only password auth supported)>',
  'localStorage':     '<insert path to use for localstorage (encryption keys) here, e.g. ./localstorage>'
};


// For bitmessage module
exports.bitmessage = {
  'apiUrl':          'http://<apiusername>:<apipassword>@<apiinterface>:<apiport>/',
  'webSecretKey':    '<insert secret key here (same as in shell script)>',
  'sqliteDatabase':  'bitmessage.sqlite'
};


// For calculate module
exports.calculate = {
  'wolframApiKey': '<insert Wolfram Alpha API key here>'
};


// For kanban module
exports.kanban = {
  'myServer':       '<insert URL for your hello-matrix-webinterface here>',
  'sqliteDatabase': 'kanban.sqlite'
};


// For senddm module
exports.senddm = {
  'secretKey':       '<insert secret key for HMAC to authorise DMs here>'
};


// For twitter module
exports.twitter = {
  consumer_key: '<insert Twitter consumer key here>',
  consumer_secret: '<insert Twitter consumer secret here>',
  access_token_key: '<insert Twitter access token key here>',
  access_token_secret: '<insert Twitter access token secret here>',
  sqliteDatabase: 'twitter.sqlite'
};


// For weather module
exports.weather = {
  'weatherApiKey': '<insert OpenWeatherMap API key here>'
};


// For webhook module
exports.webhook = {
  'myServer':                '<insert your webserver URL here (with https://)>',
  'sqliteDatabase':          'webhook.sqlite'
};


// For wunderlist module
exports.wunderlist = {
  'myServer':                '<insert your webserver URL here (with https://)>',
  'myServerWunderlist':      '<insert your webserver URL here (http only)>',
  'wunderlistClientID':      '<insert wunderlist client ID here>',
  'wunderlistClientSecret':  '<insert wunderlist client secret here>',
  'sqliteDatabase':          'wunderlist.sqlite'
};

