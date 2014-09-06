'use strict';

var should = require('should');

var symRest = require('../../src/main'),
	http = require('http'),
	request = require('request'),
	symRest;


beforeEach(function () {
	symRest = symHttp(http);
});

afterEach(function () {
	if (symRest.server !== undefined) {
		symRest.server.close();
	}
});

describe('#symREST', function () {
	
});