/*jslint node: true, expr: true */
/* global before, describe, it */
"use strict";
var assert = require("assert");
var expect = require("chai").expect;
var fs = require('fs');
var mongoose = require('mongoose');
var Promise = require('bluebird');
var restify = require('restify');
var should = require('should');
var _ = require('lodash');

var crypto = require('../lib/crypto');
var models = require('../lib/models');

var PASS = "s3cr37";
var user;

before(function (done) {
  models.Player.findOneAndUpdate({name: 'foobar'}, {name: 'foobar'}, {upsert: true})
    .then(function (saved) {
      user = saved;
      done();
    })
    .catch(done);
});

describe('Crypto', function() {
  it('should save user credentials', function(done) {
    crypto.saveUser({id: user.id}, PASS)
      .then(function (creds) {
        creds.salt.should.be.ok;
        creds.password_hash.should.be.ok;
        done();
      })
      .catch(done);
  });

  it('should validate user', function(done) {
    crypto.validateUser(user, PASS)
      .then(function (result) {
        result.user.should.equal(user.id);
        done();
      })
      .catch(done);
  });

  it('should not validate with wrong pass', function(done) {
    crypto.validateUser(user, 'incorrect')
      .then(function (result) {
        done(new Error("Should have failed"));
      })
      .catch(restify.ForbiddenError, function () {
        done();
      })
      .catch(done);
  });
});

