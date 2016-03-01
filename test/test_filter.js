/*jslint node: true, expr: true */
/* global before, after, describe, it */
"use strict";
var assert = require("assert");
var expect = require("chai").expect;
var Promise = require('bluebird');
var should = require('should');
var _ = require('lodash');

var models = require('../lib/models');

describe.only('Stats filters', function() {
  it('should return correct date filter', function(done) {
    var tests = [
      {date: new Date(2016, 2, 1, 21, 26, 22), days: 1, expected: new Date(2016, 2, 1)},
      {date: new Date(2016, 2, 1, 21, 26, 22), days: 2, expected: new Date(2016, 1, 29)}, // leap day
      {date: new Date(2016, 2, 2, 21, 26, 22), days: 2, expected: new Date(2016, 2, 1)},
      {date: new Date(2016, 2, 31, 0, 26, 22), days: 31, expected: new Date(2016, 2, 1)},
    ];
    tests.forEach(function (test) {
      var result = models.getDateFilter(test.date, test.days);
      (result - test.expected).should.equal(0);
    });
    done();
  });
});

