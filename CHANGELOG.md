# Changelog for "Hello Matrix" Bot

## Changes in v0.0.5 (2017-08-13)

- Updated dependencies for newer versions of matrix-js-sdk (so you need to run "npm install" again!)
- Bugfixes such that the bot doesn't crash if the homeserver isn't available for short periods of time
- Bugfix for a bug that meant the bot didn't recognize messages send to itself if the user-id parameter
  wasn't written exactly the way expected by the server; now we use the server-provided user-id instead
- New "senddm.js" module that provides a private webhook to send direct messages from the bot to any
  Matrix user (if you want to use it, you need to update your config file, see example config)


## Changes in v0.0.4 (2017-06-03)

- Quick fix pinning matrix-js-sdk to 0.7.4 until we have figured out how best to upgrade to 0.7.10 (with libolm removed)
- Small bugfixes


## Changes in v0.0.3 (2017-03-21)

- Support for end-to-end encryption!
- _NOTE:_ You need to change your configuration file, as the bot will now use username / password login instead of access tokens and requires a local storage folder; also re-run `npm install` as `matrix-js-sdk` needs to be updated and `node-localstorage` to be installed.


## Changes in v0.0.2 (2016-11-18)

- Kanban Tool integration now supports following boards for changes
- Hello Matrix can now send direct messages to individual users (being used for login notifications etc.)
- Hello Matrix no longer responds to stale messages when being restarted
- New !webhook functionality to set up arbitrary webhooks that get bridged into the room


## Changes in v0.0.1 (2016-11-09)

- Initial release
