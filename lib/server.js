/*jslint node: true */
"use strict";
var fs = require('fs');
var Promise = require('bluebird');
var restify = require('restify');
var routes = require('./routes');

var crypto = require('../lib/crypto');
var models = require('../lib/models');

function Server(config, log) {
  var self = this;
  this.config = config;
  this.log = log;
}

Server.prototype.init = function () {
  var self = this;
  Promise.each(self.config.credentials, function (user) {
    return models.Player.findOneAndUpdate(
      {name: user.name},
      {name: user.name, role: user.role || 'user'},
      {new: true, upsert: true}
    )
      .then(function (saved) {
        return crypto.saveUser(saved, user.password);
      });
  });
};

Server.prototype.run = function () {
  var self = this;
  var options = {
    log: self.log,
  };
  self.init();
  if (this.config.https) {
    options.certificate = fs.readFileSync(this.config.https.certificate);
    options.ca = fs.readFileSync(this.config.https.ca);
    options.key = fs.readFileSync(this.config.https.key);
  }
  var server = this.server = restify.createServer(options);
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.dateParser(60));
  server.use(restify.queryParser());
  server.use(restify.jsonp());
  server.use(restify.CORS());
  server.use(restify.fullResponse());
  server.use(restify.gzipResponse());
  server.use(restify.bodyParser());
  server.use(restify.requestLogger());

  server.get('/ping', function(req, res, next) {
    res.send({status: 'success', 'message': 'pong'});
    next();
  });

  server.get('/player/:name', routes.get_player);
  server.post('/player', routes.require_auth("admin"), routes.create_player);
  server.post('/player/token', routes.create_player_token);
  server.del('/player/:name', routes.delete_player);

  server.get('/series', routes.get_series_list);
  server.get('/series/:name', routes.get_series);
  server.get('/series/:name/games', routes.get_series_games);
  server.post('/series', routes.create_series);
  server.del('/series/:name', routes.delete_series);

  server.get('/game/:game', routes.get_game);
  server.post('/game', routes.add_game);

  server.on('uncaughtException', function (req, res, route, err) {
    self.log.error("uncaughtException:", err);
    res.send(err);
  });

  self.log.info('Starting app');
  server.listen(self.config.port, function() {
    self.log.info('%s listening at %s', self.config.name, server.url);
  });

};

Server.prototype.shutdown = function (callback) {
  this.log.info('Shutting down', this.name);
  if (this.server) {
    this.server.close(callback);
  } else {
    callback();
  }
};

module.exports = Server;
