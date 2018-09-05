#!/bin/sh

curl -XPOST -d '{"user":"<your user>", "password":"<your password>", "type":"m.login.password"}' "http://localhost:8008/_matrix/client/api/v1/register"
