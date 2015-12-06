/*jslint node: true, expr: true */
/* global before, after, describe, it */
"use strict";
var assert = require("assert");
var expect = require("chai").expect;
var fs = require('fs');
var Promise = require('bluebird');
var restify = require('restify');
var should = require('should');
var _ = require('lodash');

var app = require('../app');
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
var client = restify.createJsonClient({
  'url': 'http://127.0.0.1::' + config.server.port,
  'version': '*'
});
Promise.promisifyAll(client);

var TESTPLAYERS = ["foo", "bar", "baz"];
var FOO_PASS = "s3cr37";
var TESTSERIES = "testseries";

var adminToken;
var tokenToUse;

client.sendRequest = function () {
  var args = Array.prototype.slice.call(arguments);
  var method = args.shift();
  var path = args.shift();
  var methods = {GET: this.getAsync, POST: this.postAsync, DELETE: this.deleteAsync};
  var options = {
    path: path
  };
  if (!_.isEmpty(tokenToUse)) {
    _.assign(options, {headers: {"x-authentication": "PSGToken " + tokenToUse}});
  }
  args.unshift(options);
  return methods[method].apply(client, args);
};

before(function (done) {
  client.delAsync('/series/' + TESTSERIES)
    .then(function () {
      return client.delAsync('/player/' + TESTPLAYERS[1]);
    })
    .then(function () {
      client.sendRequest("POST", '/player/token', {name: "foo", password: FOO_PASS}, function(err, req, res, obj) {
          adminToken = obj.token;
          tokenToUse = adminToken;
          done();
      });
    })
    .catch(done);
});

describe('Server', function() {
  it('should respond to ping', function(done) {
    client.getAsync('/ping', function(err, req, res, obj) {
      assert.ifError(err);
      obj.message.should.equal('pong');
      done();
    })
    .catch(done);
  });
});

describe('CRUD', function() {
  it('should create player', function(done) {
    client.sendRequest('POST', '/player', {name: TESTPLAYERS[0], password: '53cr37' * 2}, function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
      done();
    })
    .catch(done);
  });

  it('should get player', function(done) {
    client.getAsync('/player/' + TESTPLAYERS[0])
      .then(function (result) {
        var obj = result[2];
        obj.code.should.equal('success');
        obj.player.name.should.equal(TESTPLAYERS[0]);
        obj.player.series.should.be.instanceof(Array).and.have.lengthOf(0);
        obj.player.stats.numberOfGames.should.equal(0);
        obj.player.stats.currentStreak.should.equal(0);
        done();
      })
      .catch(done);
  });

  it('should create series', function(done) {
    client.postAsync('/series', {name: TESTSERIES}, function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
      done();
    })
    .catch(done);
  });

  it('should list series', function(done) {
    client.getAsync('/series', function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
      obj.series.should.be.instanceof(Array);
      obj.series.length.should.be.aboveOrEqual(1);
      obj.series.should.containEql(TESTSERIES);
      done();
    })
    .catch(done);
  });

  it('should add player to series', function(done) {
    client.sendRequest('POST', '/player', {name: TESTPLAYERS[1], series: TESTSERIES}, function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
      obj.player.series.should.be.instanceof(Array).and.have.length(1);
      obj.player.series[0].should.equal(TESTSERIES);
      done();
    })
    .catch(done);
  });

  it('should fail adding player if series is missing', function(done) {
    client.sendRequest('POST', '/player', {name: TESTPLAYERS[1], series: "notfound"}, function(err, req, res, obj) {
      res.statusCode.should.equal(404);
      done();
    })
    .catch(done);
  });
});

describe("Authentication", function () {

  before(function (done) {
    tokenToUse = null;
    done();
  });

  after(function (done) {
    tokenToUse = adminToken;
    done();
  });

  it('should create token', function(done) {
    client.sendRequest("POST", '/player/token', {name: "foo", password: FOO_PASS}, function(err, req, res, obj) {
      res.statusCode.should.equal(200);
      obj.code.should.equal('success');
      obj.token.should.be.ok;
      adminToken = obj.token;
      done();
    })
    .catch(done);
  });

  it('should succeed allowed operations without token', function(done) {
    client.sendRequest('GET', '/player/foo', function(err, req, res, obj) {
      res.statusCode.should.equal(200);
      obj.code.should.equal('success');
      obj.player.name.should.be.ok;
      done();
    })
    .catch(done);
  });

  it('should fail admin operations without token', function(done) {
    client.sendRequest('POST', '/player', {name: "notAllowed"}, function(err, req, res, obj) {
      res.statusCode.should.equal(403);
      obj.code.should.equal('ForbiddenError');
      done();
    })
    .catch(done);
  });

  it('should succeed admin operations', function(done) {
    tokenToUse = adminToken;
    client.sendRequest('POST', '/player', {name: "adminCreatedMe"}, function(err, req, res, obj) {
      res.statusCode.should.equal(200);
      obj.code.should.equal('success');
      done();
    })
    .catch(done);
  });
});

describe("Games", function () {
  var testGame = {
    series: TESTSERIES,
    teamAway: "VAN",
    teamHome: "MTL",
    goalsAway: 42,
    goalsHome: 1,
    playersAway: "foo,baz",
    playersHome: "bar",
  };
  var gameId;

  before(function (done) {

    client.postAsync('/series', {name: TESTSERIES})
      .then(function () {
        var promises = [];
        _.forEach(TESTPLAYERS, function (name) {
          promises.push(client.sendRequest('POST', '/player', {name: name, series: TESTSERIES}));
        });
        return Promise.all(promises);
      })
      .then(function () {
        done();
      })
      .catch(done);
  });

  it('should create game', function (done) {
    client.postAsync('/game', testGame)
      .then(function (result) {
        var req = result[0],
          res = result[1],
          obj = result[2];
        obj.code.should.equal('success');
        gameId = obj.game;
        done();
      })
      .catch(done);
  });

  it('should get game', function (done) {
    assert(gameId);
    client.getAsync('/game/' + gameId)
      .then(function (result) {
        var req = result[0],
          res = result[1],
          obj = result[2];
        obj.code.should.equal('success');
        obj.game.id.should.equal(gameId);
        obj.game.goalsAway.should.equal(testGame.goalsAway);
        obj.game.series.should.equal(TESTSERIES);
        done();
      })
      .catch(done);
  });

  it('should update game', function (done) {
    assert(gameId);
    var updatedGame = testGame;
    updatedGame.game = gameId;
    updatedGame.goalsAway = 0;

    client.postAsync('/game', updatedGame)
      .then(function (result) {
        var req = result[0],
          res = result[1],
          obj = result[2];
        obj.code.should.equal('success');
        obj.game.should.equal(gameId);
        return client.getAsync('/game/' + gameId);
      })
      .then(function (result) {
        // Updated game should have correct data
        var req = result[0],
          res = result[1],
          obj = result[2];
        obj.game.goalsAway.should.equal(0);
        obj.game.playersAway.should.be.instanceof(Array).and.have.lengthOf(2);
        _.difference(obj.game.playersAway, ["foo", "baz"]).should.have.lengthOf(0);
        obj.game.series.should.equal(TESTSERIES);
        obj.game.winners.should.be.instanceof(Array).and.have.lengthOf(1);
        obj.game.winners[0].should.equal('bar');
        done();
      })
      .catch(done);
  });

  it('player should have updated stats', function(done) {
    client.getAsync('/player/' + TESTPLAYERS[1])
      .then(function (result) {
        var obj = result[2];
        obj.code.should.equal('success');
        obj.player.name.should.equal(TESTPLAYERS[1]);
        obj.player.stats.numberOfGames.should.equal(1);
        obj.player.stats.numberOfWins.should.equal(1);
        obj.player.stats.currentStreak.should.equal(1);
        done();
      })
      .catch(done);
  });

  it('should get series', function(done) {
    client.getAsync('/series/' +  TESTSERIES, function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
      obj.series.name.should.equal(TESTSERIES);
      obj.series.players.should.be.instanceof(Array).and.have.length(3);
      var findPlayer = function (players, name) {
        return _.find(obj.series.players, function (p) {
          return p.name === name;
        });
      };
      findPlayer(obj.series.players, "foo").stats.numberOfWins.should.equal(0);
      findPlayer(obj.series.players, "bar").stats.numberOfWins.should.equal(1);
      done();
    })
    .catch(done);
  });
});
