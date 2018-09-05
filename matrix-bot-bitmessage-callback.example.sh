#!/usr/bin/env bash

if [ "$1" = "newMessage" ]; then
  curl -s "<URL of your matrix bot here>/bitmessage/newMessage?secret_key=<defined secret key here>" >/dev/null
fi
