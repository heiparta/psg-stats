var assert = require("assert");
var expect = require("chai").expect;
var fs = require('fs');
var Promise = require('bluebird');
var restify = require('restify');
var should = require('should');

var app = require('../app');
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
var client = restify.createJsonClient({
  'url': 'http://127.0.0.1::' + config.server.port,
  'version': '*'
});
Promise.promisifyAll(client);

var TESTPLAYERS = ["foo", "bar"];
var TESTSERIES = "testseries";

before(function (done) {
  client.delAsync('/series/' + TESTSERIES)
    .then(function () {
      client.delAsync('/player/' + TESTPLAYERS[1])
        .then(function () {
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
    client.postAsync('/player', {name: TESTPLAYERS[0]}, function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
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

  it('should add player to series', function(done) {
    client.postAsync('/player', {name: TESTPLAYERS[1], series: TESTSERIES}, function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
      obj.series.should.equal(TESTSERIES);
      done();
    })
    .catch(done);
  });

  it('should fail adding player if series is missing', function(done) {
    client.postAsync('/player', {name: TESTPLAYERS[1], series: "notfound"}, function(err, req, res, obj) {
      res.statusCode.should.equal(404);
      done();
    })
    .catch(done);
  });
});

describe.only("Games", function () {
  var testGame = {
    series: TESTSERIES,
    teamAway: "VAN",
    teamHome: "MTL",
    goalsAway: 42,
    goalsHome: 1,
  };
  var gameId;

  before(function (done) {
    client.postAsync('/series', {name: TESTSERIES}, function(err, req, res, obj) {
      assert.ifError(err);
      obj.code.should.equal('success');
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
        done();
      })
      .catch(done);
  });
});
