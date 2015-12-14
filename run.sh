#!/bin/bash
source ~/.nvm/nvm.sh
export PSG_APP_CONFIG="elsa.json"
node app.js >> /var/log/psg/api.log 2>&1
