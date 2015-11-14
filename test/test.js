var assert = require("assert");
var expect = require("chai").expect;
var fs = require('fs');
var restify = require('restify');

var app = require('../app');
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
var client = restify.createJsonClient({
  'url': 'http://127.0.0.1::' + config.server.port,
  'version': '*'
});

describe('Server', function() {
  it('should respond to ping', function(done) {
    var r = client.get('/ping', function(err, req, res, obj) {
      assert.ifError(err);
      obj.message.should.equal.to('pong');
    });
    done();
  });
});


