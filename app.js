/*jslint node: true */
"use strict";

var bunyan = require('bunyan');
var config = require('./lib/config');

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
