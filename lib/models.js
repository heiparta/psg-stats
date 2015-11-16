/*jslint node: true */
"use strict";
var mongoose = require('mongoose');
var Promise = require('bluebird');
mongoose.Promise = Promise;
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
    name: {type: String, unique: true, required: true},
  },
  {
    toObject: {
      versionKey: false,
      virtuals: true,
      transform: function (game, ret, options) {
        delete ret._id;
      }
    }
  }
);

PlayerSchema.methods.numberOfGames = function (cb) {
  return this.model('Game').count({players: this.id});
};

PlayerSchema.methods.numberOfWins = function (cb) {
  return this.model('Game').count({winners: this.id});
};

PlayerSchema.methods.currentStreak = function (cb) {
  return 0;
};

PlayerSchema.methods.getStats = function (cb) {
  var promises = [this.numberOfGames(), this.numberOfWins(), this.currentStreak()];
  return Promise.all(promises)
    .then(function (values) {
      return {
        numberOfGames: values[0],
        numberOfWins: values[1],
        winPercentage: values[0] ? (values[1] / values[2]) : 0,
        currentStreak: values[2],
      };
    });
};

module.exports.Player = mongoose.model('Player', PlayerSchema);

var SeriesSchema = mongoose.Schema({
  name: {type: String, unique: true, required: true},
  players: [
    {type: mongoose.Schema.ObjectId, ref: 'Player'}
  ],
});
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
        ret.playersAway = _.map(ret.playersAway, function (p) {return p.name;});
        ret.playersHome = _.map(ret.playersHome, function (p) {return p.name;});
        ret.winners = _.map(ret.winners, function (p) {return p.name;});
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

