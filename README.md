# “Hello Matrix" Bot test
This project is a simple attempt at providing a friendly face to as many popular services as possible, making them accessible from any [Matrix](http://www.matrix.org/)room. “Hello Matrix” is written as NodeJS application, building on [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk), the JavaScript SDK from the creators of Matrix. It is a hobby project and as such far from feature complete, in fact it is all very basic right now - hopefully this will change over the coming months.

You can either use the “Hello Matrix” bot running on our server (see below for details; just invite @hello-matrix:matrix.org into your Matrix room) or you can check out the code from this repository and run your own instance of “Hello Matrix” (also providing your own API keys to the services you want to use).

“Hello Matrix” currently supports the following services:
- Sending and receiving messages using [Bitmessage](https://bitmessage.org/)
- Numeric calculations using [Wolfram Alpha](https://www.wolframalpha.com/)
- Throwing the dice (generating a random number)
- Adding tasks to your Kanban board from [Kanban Tool](http://kanbantool.com/) and getting notified of task status changes
- Tracerouting a given IP
- Weather from [OpenWeatherMap](http://openweathermap.org/)
- Defining arbitrary web hooks that, when triggered, send a configurable message to your room
- Using a specific webhook to send direct messages (private 1:1 chats) to Matrix users
- Providing WHOIS information on a domain or IP address
- Adding tasks and monitoring progress on [Wunderlist](https://www.wunderlist.com/) lists

The goal is to add at least generic web hook functionality in the coming months, which would immediately make a large number of other integrations possible. We’ll keep you updated on any progress.

## Use active @hello-matrix:matrix.org
If you want to use the “Hello Matrix” instance running on our server, just invite the user @hello-matrix:matrix.org into a Matrix room. The bot should automatically join the room and afterwards respond to the commands given below. By asking `!help` Hello Matrix will respond with the command he understands at the moment.

The advantage of using our instance is of course that you do not have to install and maintain anything on your own server. However, there are also a few disadvantages which might encourage you to run your own instance as explained below:
- “Hello Matrix” is a hobby project of ours. So while we try to keep him up and running, we cannot guarantee that there won’t be any (prolonged) outages.
-  Many of the services above use (free) APIs which only permit a given number of requests per month. If the number of API requests has been exceeded, these commands will stop working (e.g. Wolfram Alpha, OpenWeatherMap).
- By inviting our bot into your rooms, all the messages you or others send in these rooms will be relayed to our server in Canada (such that Hello Matrix can respond to your commands). While we do not store any of the messages, you should nevertheless be aware of this potential privacy impact.
- Related to the last point, our Hello Matrix lives on the matrix.org home server. This means that if you run your own home server, by inviting Hello Matrix into your rooms these rooms will be synced to matrix.org and that server will store a complete history of these rooms as well.


## Install your own “Hello Matrix” bot
If the points above have made you interested in running your own Hello Matrix bot, you are welcome to do so - either for your private use or as a public bot that others can talk to as well (note that at the moment you cannot really restrict usage of the bot).
You can clone our gitlab repository:

```
git clone https://gitlab.com/argit/hello-matrix-bot.git
```

Afterwards, you need to obtain the Node packages (such as matrix-js-sdk) required to run Hello Matrix. Make sure you have installed the latest version of [Node](https://nodejs.org/en/), which should come with the npm package manager. Then change into the hello-matrix-bot directory and run:

```
npm install
```

Now you are ready to set-up the configuration for your Hello Matrix bot. Copy the `matrix-bot-config.example.js` file in the main directory as `matrix-bot-config.js` in the same directory. Afterwards you need to edit these file to provide the user credentials which Hello Matrix should use to authenticate with the home server you want to use and also to provide a variety of API keys required for the different services. The section on Hello Matrix configuration below explains the different configuration options.

If you do not need some of these services and thus do not want to go through the hassle of obtaining API keys for them, you can just ignore that part of the settings and comment out their `require(...)` calls in the main `matrix-bot.js` file. Note that if you also want to hide them from the `!help` command, you need to also comment out the two lines corresponding to the module in the `bot-modules/help.js` file.

Some modules use SQLite databases to persist data such as authentication tokens or which data Hello Matrix needs to monitor. To create empty databases for all current modules, you need to ensure that the `sqlite3` utility is installed and in your path and then run the following shell script from the main Hello Matrix path:

```
./create_databases.sh
```

Hello Matrix comes with a web server to support web hooks and various authentication schemes. By default, the server listens on port 3001 on `localhost` only. The idea is that you can put a reverse proxy (such as nginx or the awesome [Caddy](https://caddyserver.com/)) in front of Hello Matrix to run multiple services on the same host and also to provide TLS encryption (which you should!). Please refer to the documentation of your favorite reverse proxy for details on how to proxy a URL of your choice to `http://localhost:3001/`.

Finally, you can launch your very own Hello Matrix bot using the start command:

```
npm start
```


### Hello Matrix Configuration Keys
The file `matrix-bot-config.js` knows the following configuration options for the different modules:

- `base`module, `botbaseUrl`: The base URL of the Matrix home server where the bot should live.
- `base`module, `botUserId`: The full matrix username (e.g. `@hello-matrix:matrix.org`) of your instance. This username needs to exist at the given home server, so you must have manually registered it beforehand.
- `base`module, `botAccessToken`: As Matrix supports a variety of authentication methods, it internally uses access tokens to authenticate requests. The easiest way to obtain an access token for your bot is to use the provided shell script `get_access_token.sh`. You need to fill in the username (just the part before the `:`) and password of the user you created and (if you are not using the matrix.org home server) need to change the API URL such that it points to your home server. The script will show a JSON snippet of which you want to extract the `access_token` property to copy it into `botAccessToken` in the configuration.

- `bitmessage` module: For Bitmessage configuration see the separate section below that explains the details of getting Bitmessage up and running.

- `calculate` module: This module hands any calculations off to Wolfram Alpha, using their [public API](http://products.wolframalpha.com/api/). This requires an API key, which you can get for free from their website for non-commercial development use and up to 2’000 calls per month. This key needs to be entered into the `wolframApiKey` parameter.

- `kanban` module, `myServer`:  This module integrates with [Kanban Tool](http://kanbantool.com/). As it uses the integrated web server of Hello Matrix for authentication purposes, you need to provide the URL your reverse proxy forwards to `http://localhost:3001/matrix-bot/kanban/` (see above). For example, for our public instance this is set as `"https://one.hello-matrix.net/matrix-bot/kanban/"`.
- `kanban` module, `sqliteDatabase`: The Kanban module stores persistent information (which boards to monitor and authentication credentials) in an SQLite database. This parameter specifies the path to the database, relative to the main folder, which you should have created before using the `create_databases.sh` shell script (see above). The shell script by default creates `kanban.sqlite`.

- `senddm` module: You need to provide a random `secretKey`. With this key, you can compute an HMAC hash that authorizes you to send messages to arbitrary Matrix users using the `/matrix-bot/senddm/send` web endpoint (to use `senddm`, you need to pass a full MXID as `recipient`, a text for your message as `message` and the hex-encoded SHA512 HMAC for the concatenation of `recipient` and `message` as `hmac`; you can pass these three parameters either as a `GET` query string or via `POST` as JSON data).

- `twitter` module: Please ignore the configuration options there for now. The Twitter module is not yet operational.

- `weather` module: This module uses the OpenWeatherMap API. You can get a free API key from their website and need to paste this key into the `weatherApiKey` configuration option.

- `webhook` module, `myServer` option: For providing the configuraiton interface and for actually receiving the web hook triggers, this module uses the integrated web server. For this configuration option, you need to provide the URL your reverse proxy forwards to `http://localhost:3001/matrix-bot/webhook/` (see above). For example, for our public instance this is set as `"https://one.hello-matrix.net/matrix-bot/webhook/"`.
- `webhook` module, `sqliteDatabase` option: The webhook module stores the configured webhooks in an SQLite database. This parameter specifies the path to the database, relative to the main folder, which you should have created before using the `create_databases.sh` shell script (see above). The shell script by default creates `webhook.sqlite`.

- `wunderlist` module, `myServer` option: This module integrates with [Wunderlist](https://www.wunderlist.com/). As it uses the integrated web server of Hello Matrix for authentication purposes, you need to provide the URL your reverse proxy forwards to `http://localhost:3001/matrix-bot/wunderlist/` (see above). For example, for our public instance this is set as `"https://one.hello-matrix.net/matrix-bot/wunderlist/"`.
- `wunderlist` module, `myServerWunderlist` option: We use callbacks from Wunderlist to notify rooms of completed tasks. Unfortunately, in our testing the Wunderlist API did not support https connections to our endpoint. If the same problem happens for you, you can use this option to provide an http url to the endpoint in `myServer`. For example, for our public instance this is set as `"http://one.hello-matrix.net/matrix-bot/wunderlist/"` (note the missing `s`).
- `wunderlist` module, `wunderlistClientID` option: The [Wunderlist API](https://developer.wunderlist.com/) requires a client ID that can be obtained by registering for free on their developer portal.
- `wunderlist` module, `wunderlistClientSecret` option: The [Wunderlist API](https://developer.wunderlist.com/) requires a client secret that can be obtained by registering for free on their developer portal.
- `wunderlist` module, `sqliteDatabase` option: The Wunderlist module stores persistent information (authentication credentials) in an SQLite database. This parameter specifies the path to the database, relative to the main folder, which you should have created before using the `create_databases.sh` shell script (see above). The shell script by default creates `wunderlist.sqlite`.


### Bitmessage configuration
Integration with Bitmessage requires a running [PyBitmessage](https://bitmessage.org/wiki/Main_Page) instance on the server where the bot is running. You need to enable the API as explained in Bitmessage’s [API Reference](https://bitmessage.org/wiki/API_Reference).

For receiving messages, Bitmessage calls a shell script that needs to be specified as `apinotifypath` in the PyBitmessage configuration. Hello Matrix comes with `matrix-bot-bitmessage-callback.example.sh` which you can adapt for your use case. This shell script uses `curl` to call a webhook running on Hello Matrix’s integrated web server.

You need to specify the URL your reverse proxy listens on (see above) in the example shell script and also a predetermined secret key that is used to make sure that only your shell script is being able to route messages.

When PyBitmessage is up and running, the API configured, the callback shell script set-up and specified in `apinotifypath`, it is time to complete the Hello Matrix configuration. For the `bitmessage` module, it expects the following options:

- `apiUrl`: You should specify the URL, including username and password components, that can be used to access PyBitmessage’s API. Based on the PyBitmessage configuration, you would replace all the parts: `http://<apiusername>:<apipassword>@<apiinterface>:<apiport>/`
- `webSecretKey`: The secret key that is used to authenticate web hook requests, must be the same as specified in the callback shell script.
- `sqliteDatabase`: The bitmessage module stores persistent information (bitmessage adresses to rooms) in an SQLite database. This parameter specifies the path to the database, relative to the main folder, which you should have created before using the `create_databases.sh` shell script (see above). The shell script by default creates `bitmessage.sqlite`.


## Usage Instructions
Hello Matrix generally explains himself. Just invite him (`@hello-matrix:matrix.org` or your own instance) into a Matrix room. He will automatically join and monitor the room for commands, which should all start with an exclamation mark (`!`).

If you want to know what commands Hello Matrix understands, you can ask by calling for help:

```
!help
```

If you have identified an interesting feature set, you can get more help into how to use this specific functionality by calling help with the name of the feature:

```
!help feature
```

Hello Matrix will respond with an explanation of all the commands to be performed for the Wunderlist integration.


## Current Limitations
At the moment, the following is unsupported by this bot:
- The bot does not know how to leave rooms - you have to ban him to keep him out of any room you have invited him into.
- The bot cannot be restricted to only respond to joins by approved users. This means that when you set-up your own bot, everyone can invite him into new rooms and use the provided functionality.


## Roadmap
There are a lot of cool integrations that would be interesting to add, but for the moment the following items are high on the agenda and will be implemented "as time permits" in this order:

1. Zapier integration
2. Gitlab integration
3. Support for providing statistics on room discussion, similar to what [pisg](http://pisg.sourceforge.net/) does for IRC chats
4. Simple reminder / alarm clock functionality


## Questions?
If you have any questions, feel free to join [\#hello-matrix-bot:matrix.org](https://matrix.to/#/#hello-matrix-bot:matrix.org) for answers. If any questions come up frequently, we will add them here.
