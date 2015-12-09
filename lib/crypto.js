/*jslint node: true */
"use strict";

var bcrypt = require('bcrypt');
var models = require('./models');
var restify = require('restify');

var Credentials = models.Credentials;

module.exports.saveUser = function (user, password) {
  var salt = bcrypt.genSaltSync();
  var hash = bcrypt.hashSync(password, salt);
  return Credentials.findOneAndUpdate({user: user.id}, {user: user.id, password_hash: hash, salt: salt}, {new: true, upsert: true});
};

module.exports.validateUser = function (user, password) {
  return Credentials.findOne({user: user.id})
    .then(function (creds) {
      if (creds === null) {
        throw new restify.ForbiddenError('Authentication failed');
      }
      if (creds.password_hash !== bcrypt.hashSync(password, creds.salt)) {
        throw new restify.ForbiddenError('Authentication failed');
      }
      return {user: creds.user.toString()};
    });
};

