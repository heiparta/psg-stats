/*jslint node: true */
"use strict";
var mongoose = require('mongoose');
var Promise = require('bluebird');
mongoose.Promise = Promise;
var uuid = require('uuid');
var _ = require('lodash');

mongoose.connect('mongodb://localhost/test');

module.exports.MongoError = function (e) {
  return _.startsWith(e.message, 'E11000 ');
};

module.exports.ValidationError = function (e) {
  return _.has(e, 'name') && e.name === "ValidationError";
};

module.exports.Id = mongoose.Schema.ObjectId;

var PlayerSchema = mongoose.Schema(
  {
    name: {type: String, lowercase: true, trim: true, unique: true, required: true},
    displayname: {type: String, required: true},
    role: {type: String},
    series: [
      {type: mongoose.Schema.ObjectId, ref: 'Series'}
    ],
  },
  {
    toObject: {
      versionKey: false,
      transform: function (player, ret, options) {
        ret.series = _.map(ret.series, function (s) {return s.name;});
        delete ret._id;
        ret.name = ret.displayname;
        delete ret.displayname;
      }
    }
  }
);

PlayerSchema.methods.won = function (game) {
  var self = this;
  return game.winners.some(function (p) { return p.equals(self.id); });
};

PlayerSchema.methods.numberOfGames = function (params, cb) {
  params = _.cloneDeep(params) || {};
  params.players = this.id;
  return this.model('Game').count(params);
};

PlayerSchema.methods.numberOfWins = function (params, cb) {
  params = _.cloneDeep(params) || {};
  params.winners = this.id;
  return this.model('Game').count(params);
};

PlayerSchema.methods.currentStreak = function (params, cb) {
  // Returns positive Number for winning streak and negative for losing streak
  // First, find all games of player
  var self = this;
  params = _.cloneDeep(params) || {};
  params.players = self.id;
  return self.model('Game').find(params)
    .sort({'date': -1})
    .populate('winners')
    .then(function (games) {
      var streak = 0;
      var isWinning;
      if (_.isEmpty(games)) {
        return streak;
      }
      isWinning = self.won(games[0]);
      // Find first game that has different result
      streak = _.findIndex(games, function(g) {
        return isWinning !== self.won(g);
      });
      if (streak === -1) {
        // Corner case, all games belong to streak
        streak = games.length;
      }
      if (!isWinning) {
        streak *= -1;
      }
      return streak;
    });
};

var getDateFilter = module.exports.getDateFilter = function (date, days) {
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1)); // Minus one due to resetting to midnight
    return date;
};

PlayerSchema.methods.getStats = function (params, cb) {
  var queryParams;
  var queryDate = new Date();
  if (params && params.days) {
    queryParams = {
      date: {"$gte": getDateFilter(queryDate, params.days)}
    };
  }

  var promises = [this.numberOfGames(queryParams), this.numberOfWins(queryParams), this.currentStreak(queryParams)];
  return Promise.all(promises)
    .then(function (values) {
      return {
        numberOfGames: values[0],
        numberOfWins: values[1],
        winPercentage: Math.floor(1000 * (values[0] ? (values[1] / values[0]) : 0)) / 10,
        currentStreak: values[2],
      };
    });
};

module.exports.Player = mongoose.model('Player', PlayerSchema);

var getDefaultExpiry = function () {
  return new Date() + (60 * 60 * 24 * 30);
};

var TokenSchema = mongoose.Schema(
  {
    user: {type: mongoose.Schema.ObjectId, ref: 'Player', required: true},
    token: {type: String, default: uuid.v4, required: true},
    expires_at: {type: Date, default: getDefaultExpiry, required: true},
  }
);

module.exports.Token = mongoose.model('Token', TokenSchema);

var CredentialsSchema = mongoose.Schema(
  {
    user: {type: mongoose.Schema.ObjectId, ref: 'Player', required: true},
    password_hash: {type: String, required: true},
    salt: {type: String, required: true},
  }
);

module.exports.Credentials = mongoose.model('Credentials', CredentialsSchema);

var SeriesSchema = mongoose.Schema(
  {
    name: {type: String, unique: true, required: true},
    players: [
      {type: mongoose.Schema.ObjectId, ref: 'Player'}
    ],
  },
  {
    toObject: {
      versionKey: false,
      transform: function (obj, ret, options) {
        ret.players = _.map(ret.players, function (p) {return p.displayname || p.name;});
        delete ret._id;
      }
    }
  }
);

module.exports.Series = mongoose.model('Series', SeriesSchema);

var GameSchema = mongoose.Schema(
  {
    date: {type: Date, default: Date.now},
    series: {type: mongoose.Schema.ObjectId, ref: 'Series', required: true},
    teamAway: {type: String, required: true},
    teamHome: {type: String, required: true},
    goalsAway: {type: Number, min: 0, required: true},
    goalsHome: {type: Number, min: 0, required: true},
    players: [
      {type: mongoose.Schema.ObjectId, ref: 'Player'}
    ],
    winners: [
      {type: mongoose.Schema.ObjectId, ref: 'Player'}
    ],
    playersAway: [
      {type: mongoose.Schema.ObjectId, ref: 'Player'}
    ],
    playersHome: [
      {type: mongoose.Schema.ObjectId, ref: 'Player'}
    ],
  },
  {
    toObject: {
      versionKey: false,
      transform: function (game, ret, options) {
        ret.id = ret._id;
        ret.playersAway = _.map(ret.playersAway, function (p) {return p.displayname || p.name;});
        ret.playersHome = _.map(ret.playersHome, function (p) {return p.displayname || p.name;});
        ret.winners = _.map(ret.winners, function (p) {return p.displayname || p.name;});
        if (ret.series !== undefined) {
          ret.series = ret.series.name;
        }
        delete ret._id;
      }
    }
  }
);

GameSchema.pre('save', function (next) {
  this.playersAway.sort();
  this.playersHome.sort();
  this.players = this.playersAway.concat(this.playersHome);
  this.winner = (this.goalsAway > this.goalsHome) ? "A" : "H";
  this.winners = (this.goalsAway > this.goalsHome) ? this.playersAway : this.playersHome;
  next();
});

module.exports.Game = mongoose.model('Game', GameSchema);

