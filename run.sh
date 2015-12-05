#!/bin/bash
source ~/.nvm/nvm.sh
node app.js >> /var/log/psg/api.log 2>&1
