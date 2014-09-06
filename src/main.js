'use strict';

var symHttp = require('symphony-http'),
	httpDuplex = require('http-duplex'),
	http = require('http'),
	urlParse = require('url').parse,
	_ = require('lodash'),
	urlPattern = require('url-pattern'),
	symInject = require('symphony-injector'),
	JSONStream = require('JSONStream'),
	$bluebird = require('bluebird'),
	auth = require('./auth');


module.exports = function (webServer) {
	var server = symHttp(webServer),
		$inject = new symInject(),
		checkHeaders = function (dup, ignore) {
			if (dup.response.finished && !ignore) {
				console.trace();
				console.error('Headers allready sent', dup);
			}
			return dup.response.finished && !ignore;
		},
		$err = function ($dup) {
			return function () {
				var args = [].slice.call(arguments),
					err;
				
				if (typeof args[0] === 'number' && typeof args[1] === 'string') {
					err = {code: args[0], msg: args[1]};
				} else  {
					err = args[0];
				}

				if (err) {
					console.error('Error', err);
					if (!server.checkHeaders($dup)) {
						$dup.statusCode = err.code || 500;
						$dup.end('{"code": ' + $dup.statusCode + ', "msg": "'  + (err.msg || http.STATUS_CODES[$dup.statusCode]) + '"}');
					}

					if ($dup.statusCode === 500) {
						console.log(err.trace);
					}
				}
			};
		},
		$auth = function ($dup) {
			return function (fn, callback) {
				var userObj = auth.getUserObj($dup),
					retVal,
					e;

				if (!userObj || !userObj.id) {
					//User object is missing
					e = new Error(http.STATUS_CODES[401] + '\nUserObj is invalid in authorization header.');
					e.code = 401;
					throw e;
				}

				retVal = fn(userObj.id);

				if (!retVal || typeof retVal.then !== 'function') {
					retVal = $bluebird(function (reject, resolve) {
						resolve(retVal);
					});
				}

				return retVal.then(function (secret) {
					var userId = auth.authHMAC($dup)(secret);

					if (!server.checkHeaders($dup)) {
						if (userId) {
							return userId;
						} else {
							//Throw error user does not exist
							e = new Error(http.STATUS_CODES[401]);
							e.code = 401;
							throw e;
						}
					}
				});
			};
		};

	server.$inject = $inject;
	server.checkHeaders = checkHeaders;

	$inject.service('$bluebird', $bluebird);
	$inject.service('_', _);

	//Register HTTP methods
	_.forEach(server.headers, function (v, k) {
		k = k.toLowerCase();
		server[k] = server.method.bind(server, k);
	});

	server.requestHandler = function (req, res) {
		var dup = httpDuplex(req, res),
			url = urlParse(req.url, true),
			method = req.method.toUpperCase();

		_.forEach(server.headers, function (v, k) {
			dup.setHeader(k, v);
		});

		if (server.methodEmitter.hasOwnProperty(method)) {
			if (!server.methodEmitter[method].emit(url.pathname, dup, url)) {
				dup.statusCode = 404;
				dup.end('{"code": 404, "msg": "' + http.STATUS_CODES[404] + '"}');
			}
		} else {
			dup.statusCode = 405;
			dup.end('{"code": 405, "msg": "' + http.STATUS_CODES[405] + '"}');
		}
	};

	server.method = function (method, template, callback) {
		var pattern = urlPattern.newPattern(template);

		if (typeof method !== 'string') {
			throw new Error('Method expected to be string, ' + typeof method + ' given.');
		}

		if (typeof callback !== 'function') {
			throw new Error('Callback expected to be function, ' + typeof callback + ' given.');
		}
		method = method.toUpperCase();
		if (this.methods.indexOf(method) < 0) {
			console.error('Non standard HTTP verb! Add it to methods array if you want to support it (NOT RECOMMENDED!. If you do add some new verb, HTTPS is recommended to elimenate problems with bad proxies.)');
			throw new Error('Non standard HTTP verb!');
		}

		this.methodEmitter[method].on(pattern.regex, function (dup, url) {
			var urlParams = pattern.match(url.pathname) || {};
			var query = url.query || {};

			var streamData = '';
			
			var $body = dup.pipe(JSONStream.parse('*'));

			dup.on('data', function (data) {
				if (data) {
					streamData += data;
				}
			});
			dup.on('end', function (data) {
				try {
					$inject.remove('$locals');
					$inject.remove('$dup');
					$inject.remove('$err');
					$inject.remove('$auth');
					$inject.remove('$body');
					var body = streamData.length > 0 ? JSON.parse(streamData) : {},
						retVal = $inject.inject(callback,
							_.merge(urlParams, body, query, {
							'$dup': dup ,
							'$err': $err(dup),
							'$auth': $auth(dup),
							'$body': $body
						}));

					if (!server.checkHeaders(dup, true)) {
						if (!retVal) {
							//No data
							dup.end();
						} else if (retVal.Readable) {
							//Is stream
							retVal.pipe(dup);
						} else if (typeof retVal === 'string' || retVal instanceof Buffer) {
							dup.end(retVal);
						} else if (typeof retVal === 'object') {
							if (retVal && typeof retVal.then) {
								retVal
								.then(function (data) {
									dup.end(JSON.stringify(data));
								})
								.catch(function (e) {
									$err(dup)(e);
								});
							} else {
								try {
									dup.end(JSON.stringify(retVal));
								} catch (e) {
									$err(dup)(e);
								}
							}
						}
					}
				} catch (e) {
					$err(dup)(e);
				}
			});
		});

		return this;
	};

	server.methods.forEach(function (m) {
		server[m.toLowerCase()] = server.method.bind(server, m);
	});

	return server;
};
