'use strict';

var should = require('should');

var symHttp = require('../../src/main'),
	http = require('http'),
	request = require('request'),
	symServer;


beforeEach(function () {
	symServer = symHttp(http);
});

afterEach(function () {
	if (symServer.server !== undefined) {
		symServer.server.close();
	}
});

describe('#symHttp', function () {
	describe('#factory', function () {
		it('should return an object', function () {
			symServer.should.be.an.object;
			symServer.should.have.property('server');
			symServer.should.have.property('methodEmitter');
			symServer.should.have.property('requestHandler');
			symServer.should.have.property('create');
			symServer.should.have.property('methods');
			symServer.should.have.property('headers');
			symServer.should.have.property('method');
		});
	});
	
	describe('#create', function () {
		it('should return 404 when route is not defined', function (done) {
			symServer.create(18888);
			
			request({
				url: 'http://localhost:18888/test',
				headers: {
				}
			}, function (error, response, body) {
				(error === null).should.be.ok;
				response.statusCode.should.be.eql(404);

				response.headers.should.have.property('x-frame-options', 'SAMEORIGIN');
				response.headers.should.have.property('content-type', 'application/json');
				response.headers.should.have.property('strict-transport-security', 'max-age=31536000; includeSubDomains');
				response.headers.should.have.property('x-xss-protection', '1; mode=block');
				
				var data = JSON.parse(body);
				
				data.code.should.be.eql(404);
				data.msg.should.be.eql('Not Found');
				
				done();
			});
		});
		
		it('should return 405 when method is not defined', function (done) {
			symServer.create(18888);
			
			request({
				method: 'MOVE',
				url: 'http://localhost:18888/test',
				headers: {
				}
			}, function (error, response, body) {
				(error === null).should.be.ok;
				response.statusCode.should.be.eql(405);

				response.headers.should.have.property('x-frame-options', 'SAMEORIGIN');
				response.headers.should.have.property('content-type', 'application/json');
				response.headers.should.have.property('strict-transport-security', 'max-age=31536000; includeSubDomains');
				response.headers.should.have.property('x-xss-protection', '1; mode=block');
				
				var data = JSON.parse(body);
				
				data.code.should.be.eql(405);
				data.msg.should.be.eql('Method Not Allowed');
				
				done();
			});
		});
	});
	
	describe('#method', function () {
		it('should return 200 and data when route is defined', function (done) {
			symServer.create(18888);
			
			symServer.method('get', /test/, function (dup, query, hash) {
				dup.end(JSON.stringify({
					code: 200,
					msg: 'Ok'
				}));
			});
			
			request({
				url: 'http://localhost:18888/test',
				headers: {
				}
			}, function (error, response, body) {
				(error === null).should.be.ok;
				response.statusCode.should.be.eql(200);
				
				response.headers.should.have.property('x-frame-options', 'SAMEORIGIN');
				response.headers.should.have.property('content-type', 'application/json');
				response.headers.should.have.property('strict-transport-security', 'max-age=31536000; includeSubDomains');
				response.headers.should.have.property('x-xss-protection', '1; mode=block');

				var data = JSON.parse(body);
				
				data.code.should.be.eql(200);
				data.msg.should.be.eql('Ok');
				
				done();
			});
		});
		
		it('should throw an error when method is not a string', function () {
			symServer.create(18888);
			
			(function () {
				symServer.method(123, /test/, function () {});
			}).should.throw('Method expected to be string, number given.');
		});
		
		it('should throw an error when regexp is not a RegExp object', function () {
			symServer.create(18888);
			
			(function () {
				symServer.method('get', 123, function () {});
			}).should.throw('regexp expected to be a RegExp object, number given.');
		});
		
		it('should throw an error when callback is not a function', function () {
			symServer.create(18888);
			
			(function () {
				symServer.method('get', /test/, 123);
			}).should.throw('Callback expected to be function, number given.');
		});
		
		it('should throw an error when trying to register a method of an unsupported http verb', function () {
			symServer.create(18888);
			
			(function () {
				symServer.method('WHUT', /test/, function () {});
			}).should.throw('Non standard HTTP verb!');
		});
	});
});