/*jslint node: true */
"use strict";

var bunyan = require('bunyan');
var fs = require('fs');

var configFile = './config.json';
if (process.argv.length > 2) {
  configFile = process.argv[2];
}

var config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
var log = bunyan.createLogger({
  name: config.server.name,
  stream: process.stdout,
  level: config.log.level
});

var Server = require('./lib/server');


var server = new Server(config.server, log);
server.run();

function shutdown() {
  server.shutdown(function(status) {
    console.log("Exiting process");
    process.exit();
  });
}

process.on('SIGHUP', function() {
  console.log("Shutting down");
  shutdown();
});

process.on('SIGTERM', function() {
  console.log("Shutting down");
  shutdown();
});
