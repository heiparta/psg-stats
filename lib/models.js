var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
var _ = require('lodash');

mongoose.connect('mongodb://localhost/test');

module.exports.MongoError = function (e) {
  return _.startsWith(e.message, 'E11000 ');
};

var PlayerSchema = mongoose.Schema({
  name: {type: String, unique: true, required: true},
});
module.exports.Player = mongoose.model('Player', PlayerSchema);

var SeriesSchema = mongoose.Schema({
  name: {type: String, unique: true, required: true},
  players: [
    {type: mongoose.Schema.ObjectId, ref: 'Player'}
  ],
});
module.exports.Series = mongoose.model('Series', SeriesSchema);

var GameSchema = mongoose.Schema({
  date: {type: Date, default: Date.now},
  series: {type: mongoose.Schema.ObjectId, ref: 'Series', required: true},
  teamAway: {type: String, required: true},
  teamHome: {type: String, required: true},
  goalsAway: {type: Number, min: 0, required: true},
  goalsHome: {type: Number, min: 0, required: true},
  playersAway: [
    {type: mongoose.Schema.ObjectId, ref: 'Player'}
  ],
  playersHome: [
    {type: mongoose.Schema.ObjectId, ref: 'Player'}
  ],
});
module.exports.Game = mongoose.model('Game', GameSchema);

