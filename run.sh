#!/bin/bash
source ~/.nvm/nvm.sh
node app.js elsa.json >> /var/log/psg/api.log 2>&1
