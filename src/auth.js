'use strict';

//GMT/UTC timezone
process.env.TZ = 'Europe/Amsterdam';
var timeout = 1000 * 60 * 15;

var createHMAC = function createHMAC (secret) {
	return function (authObj, $body) {
		var crypto = require('crypto');
		var stream = crypto.createHmac('sha256', secret);

		//Feed method, timestamp and userid to HMAC stream
		stream.update('' + authObj.method, 'utf-8');
		stream.update('' + authObj.timestamp, 'utf-8');
		stream.update('' + authObj.userId, 'utf-8');

		//Whole url with query string parameters
		stream.update('' + authObj.url);

		//Request body
		$body.pipe(stream);

		return stream.digest('hex');
	};
};

var getUserObj = function getUserObj ($dup) {
	var retObj = {
			userId: null,
			timestamp: null,
			hash: null
		},
		auth;
	
	if ($dup.headers.authorization) {
		auth = $dup.headers.authorization.split('HMACSHA256');
		
		if (auth.length > 1) {
			auth = auth[1].trim();
			retObj = JSON.parse(new Buffer(auth, 'base64').toString('ascii'));
		}
	}
	return retObj;
};

var createAuthHeader = function createAuthHeader (secret) {
	return function (authObj, $body) {
		return 'HMACSHA256 ' + new Buffer(JSON.stringify({
			timestamp: authObj.timestamp,
			userId: authObj.userId,
			hash: createHMAC(secret)(authObj, $body)
		})).toString('base64');
	};
};

var authHMAC = function authHMAC($dup) {
	return function (fetchUserById) {
		var authObj = getUserObj($dup);
		
		var timestamp = authObj.timestamp;
		if (Math.abs(Date.now() - timestamp) > timeout) {
			//Request is to old
			return false;
		}

		var challange = authObj.hash;
		var secret = fetchUserById(authObj.userId);

		var answer = createHMAC(secret)({
			method: $dup.method,
			timestamp: timestamp,
			userId: authObj.userId,
			url: $dup.url
		}, $dup);

		return challange === answer ? authObj.userId : false;
	};
};



module.exports = {
	getUserObj: getUserObj,
	authHMAC: authHMAC,
	createHMAC: createHMAC,
	createAuthHeader: createAuthHeader
};