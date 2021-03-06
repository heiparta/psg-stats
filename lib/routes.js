/*jslint node: true */
"use strict";

var crypto = require('./crypto');
var models = require('./models');
var mongoose = require('mongoose');
var Promise = require('bluebird');
var restify = require('restify');
var _ = require('lodash');

var roleIsSufficient = function (role, requiredRole) {
  if (requiredRole === "admin") {
    return role === "admin";
  }
  return _.findIndex(["admin", "user"], role) !== -1;
};

module.exports.require_auth = function (requiredRole) {
  return function (req, res, next) {
    if (_.isEmpty(req.headers["x-authentication"])) {
      return next(new restify.ForbiddenError('Authorization required'));
    }
    var tokenString = req.headers["x-authentication"].split(" ")[1];
    models.Token.findOne({token: tokenString})
      .populate(['user'])
      .then(function (token) {
        if (token === null) {
          return next(new restify.ForbiddenError('Permission denied'));
        }
        if (!roleIsSufficient(token.user.role, requiredRole)) {
          return next(new restify.ForbiddenError('Permission denied'));
        }
        return next();
      })
      .catch(function (err) {
        req.log.error(err);
        next(err);
      });
  };
};

module.exports.get_player = function (req, res, next) {
  var response = {code: "success"};
  models.Player.findOne({name: req.params.name.toLowerCase()})
    .populate('series')
    .then(function (player) {
      if (player === null) {
        throw new restify.NotFoundError('Player not found');
      }
      response.player = player.toObject();
      return player.getStats({days: req.params.stats_days});
    })
    .then(function (stats) {
      response.player.stats = stats;
      res.send(response);
      return next();
    })
    .catch(function (err) {
      req.log.error(err);
      next(err);
    });
};

module.exports.create_player = function (req, res, next) {
  var player = new models.Player({displayname: req.params.name, name: req.params.name.toLowerCase()});
  player.save()
    .catch(models.MongoError, function (err) {
      return models.Player.findOne({name: req.params.name.toLowerCase()});
    })
    .then(function (player) {
      req.log.info("Added player", player.name);
      if (!_.isEmpty(req.params.series)) {
        // Maintain two-way link between Player and Series
        req.log.debug("Adding series to player", player.name);
        return models.Series.findOne({name: req.params.series})
          .then(function (series) {
            if (series === null) {
              throw new restify.NotFoundError('Series not found');
            }
            if (_.includes(_.map(series.players, function (v) { return String(v); }), player.id)) {
              return Promise.resolve();
            }
            req.log.debug("Adding player", player.name, "to series", series.name);
            series.players.push(player.id);
            return series.save()
              .catch(function (err) {
                req.log.error(err);
                return next(err);
              });
          })
          .then(function (series) {
            if (series && !player.series.some(function (s) { return s.equals(series.id); })) {
              player.series.push(series.id);
              return player.save();
            } else {
              return Promise.resolve();

            }
          })
          .then(function () {
            // Need to query the model back to get .series populated
            return models.Player.findOne({_id: player.id}).populate('series');
          })
          .then(function (player) {
            res.send({code: "success", player: player.toObject()});
            return next();
          });
      } else {
        res.send({code: "success", player: player.toObject()});
        return next();
      }
    })
    .catch(models.ValidationError, function (err) {
      req.log.error("Validation failed", err.errors);
      next(err);
    })
    .catch(function (err) {
      req.log.error(err);
      next(err);
    });
};

module.exports.create_player_token = function (req, res, next) {
  var player;
  if (_.isEmpty(req.params.password)) {
    throw new restify.BadRequestError('Missing password');
  }
  models.Player.findOne({name: req.params.name.toLowerCase()})
    .then(function (result) {
      if (result === null) {
        throw new restify.NotFoundError('Player not found');
      }
      player = result;
      return crypto.validateUser(player, req.params.password);
    })
    .then(function () {
      var token = new models.Token({user: player.id});
      return token.save();
    })
    .then(function (token) {
      res.send({code: "success", user: player.displayname, token: token.token});
      return next();
    })
    .catch(function (err) {
      req.log.error(err);
      next(err);
    });
};

module.exports.delete_player = function (req, res, next) {
  models.Player.findOne({name: req.params.name.toLowerCase()}).remove()
    .then(function (result) {
      if (result.n === 1) {
        req.log.info("Deleted player", req.params.name.toLowerCase());
      }
      res.send({code: "success"});
      return next();
    })
    .catch(next);
};

module.exports.get_series_list = function (req, res, next) {
  var response = {code: "success"};
  models.Series.find()
    .then(function (series) {
      response.series = _.pluck(series, "name");
      res.send(response);
      return next();
    })
    .catch(function (err) {
      req.log.error(err);
      next(err);
    });
};

module.exports.get_series = function (req, res, next) {
  var response = {code: "success"};
  models.Series.findOne({name: req.params.name})
    .populate('players')
    .then(function (series) {
      if (series === null) {
        throw new restify.NotFoundError('Series not found');
      }
      response.series = series.toObject();
      return Promise.all(_.map(series.players, function (p) {
        return p.getStats({days: req.params.stats_days});
      }));
    })
    .then(function (stats) {
      response.series.players = _.map(response.series.players, function (player, index) {
        return {name: player, stats: stats[index]};
      });
      res.send(response);
      return next();
    })
    .catch(function (err) {
      req.log.error(err);
      next(err);
    });
};

module.exports.get_series_games = function (req, res, next) {
  var response = {code: "success"};
  models.Series.findOne({name: req.params.name})
    .then(function (series) {
      if (series === null) {
        throw new restify.NotFoundError('Series not found');
      }
      return models.Game.find({series: series.id})
        .sort({ date: -1 })
        .limit(5)
        .populate('playersAway playersHome winners');
    })
    .then(function (games) {
      response.games = _.map(games, function (game) { return game.toObject(); });
      res.send(response);
      return next();
    })
    .catch(function (err) {
      req.log.error(err);
      next(err);
    });
};

module.exports.create_series = function (req, res, next) {
  var series = new models.Series(req.params);
  series.save()
    .then(function () {
      req.log.info("Added series", series.name);
      res.send({code: "success"});
      return next();
    })
    .catch(models.MongoError, function (err) {
      // Series already exists
      res.send({code: "success"});
      return next();
    })
    .catch(next);
};

module.exports.delete_series = function (req, res, next) {
  var series;
  models.Series.findOne({name: req.params.name})
    .then(function (result) {
      if (!result) {
        res.send({code: "success"});
        return next();
      }
      series = result;
      return models.Game.find({series: series.id}).remove();
    })
    .then(function () {
      return series.remove();
    })
    .then(function (result) {
      if (result.n === 1) {
        req.log.info("deleted series", req.params.name);
      }
      res.send({code: "success"});
      return next();
    })
    .catch(next);
};

module.exports.get_game = function (req, res, next) {
  models.Game.findById(req.params.game)
    .populate('series playersAway playersHome winners')
    .then(function (game) {
      if (game === null) {
        throw new restify.NotFoundError("Game not found");
      }
      res.send({
        code: "success",
        game: game.toObject()
      });
      return next();
    })
    .catch(next);
};

module.exports.add_game = function (req, res, next) {
  var game,
    gameParams,
    gamePromise,
    autoFields = ["teamAway", "teamHome", "goalsAway", "goalsHome"],
    playersAway = req.params.playersAway ? req.params.playersAway.split(',') : [],
    playersHome = req.params.playersHome ? req.params.playersHome.split(',') : [];

  gameParams = _.pick(req.params, autoFields);

  if (!_.isEmpty(req.params.game)) {
    req.log.info("Updating old game", req.params.game);
    gamePromise = models.Game.findById(req.params.game);
  } else {
    gamePromise = Promise.resolve();
  }
  gamePromise
    .then(function (result) {
      if (req.params.game && !result) {
        throw new restify.NotFoundError("Game not found");
      } else {
        game = result || new models.Game(gameParams);
        _.merge(game, gameParams);
        req.log.debug("Game", game);
        return models.Series.findOne({name: req.params.series}).populate('players');
      }
    })
    .then(function (series) {
      if (series === null) {
        throw new restify.NotFoundError('Series not found');
      }
      req.log.debug("Found series", series.name, series.players);
      game.series = series.id;
      game.playersAway = mongoose.Types.Array([]);
      game.playersHome = mongoose.Types.Array([]);
      _.forEach(playersAway, function (name) {
        var playerIndex = _.findIndex(series.players, {name: name.toLowerCase()});
        if (playerIndex === -1) {
          throw new restify.BadRequestError('Player ' + name + ' does not belong to series ' + series.name);
        }
        game.playersAway.push(series.players[playerIndex].id);
      });
      _.forEach(playersHome, function (name) {
        var playerIndex = _.findIndex(series.players, {name: name.toLowerCase()});
        if (playerIndex === -1) {
          throw new restify.BadRequestError('Player ' + name + ' does not belong to series ' + series.name);
        }
        game.playersHome.push(series.players[playerIndex].id);
      });
      return game.save();
    })
    .then(function () {
      req.log.info("Added game", game.id);
      res.send({code: "success", game: game.id});
      return next();
    })
    .catch(models.ValidationError, function (err) {
      req.log.error("Validation failed", err.errors);
      next(err);
    })
    .catch(function (err) {
      req.log.error(err);
      next(err);
    });

};
