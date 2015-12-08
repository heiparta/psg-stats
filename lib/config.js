/*jslint node: true */
"use strict";
var fs = require('fs');

var configFile = process.env.PSG_APP_CONFIG || './config.json';
module.exports = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

