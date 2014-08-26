'use strict';

//GMT/UTC timezone
process.env.TZ = 'Europe/Amsterdam';
var timeout = 1000 * 60 * 60 * 24;

var createHMAC = function createHMAC (secret) {
	return function (authObj, $body) {
		var crypto = require('crypto');
		var stream = crypto.createHmac('sha256', secret);

		//Feed method, timestamp and userid to HMAC stream
		stream.update('' + authObj.method, 'utf-8');
		stream.update('' + authObj.timestamp, 'utf-8');
		stream.update('' + authObj.id, 'utf-8');

		//Whole url with query string parameters
		stream.update('' + authObj.url);

		//Request body
		$body && $body.pipe(stream);

		return stream.digest('hex');
	};
};

var getUserObj = function getUserObj ($dup) {
	var retObj = {
			id: null,
			timestamp: null,
			hash: null
		},
		auth;

	if ($dup.headers.authorization) {
		//if ($dup.headers.authorization) {
			auth = $dup.headers.authorization.split('HMACSHA256');
		//} else {
		//	auth =  $dup.headers['x-authorization-1'].split('HMACSHA256');
		//	auth += $dup.headers['x-authorization-2'];
		//	auth += $dup.headers['x-authorization-3'];
		//	auth += $dup.headers['x-authorization-4'];
		//}
		
		if (auth.length > 1) {
			auth = auth[1].trim();
			retObj = JSON.parse(new Buffer(auth, 'base64').toString('ascii'));
		}
	}

	console.log(retObj);

	return retObj;
};

var createAuthHeader = function createAuthHeader (secret) {
	return function (authObj, $body) {
		return 'HMACSHA256 ' + new Buffer(JSON.stringify({
			timestamp: authObj.timestamp,
			id: authObj.id,
			hash: createHMAC(secret)(authObj, $body)
		})).toString('base64');
	};
};

var authHMAC = function authHMAC($dup) {
	return function (fetchUserById) {
		var authObj = getUserObj($dup);
	
		console.log('------------------------');
	
		var timestamp = authObj.timestamp;
		console.log(timestamp, Date.now(), Math.abs(Date.now() - timestamp));
		if (Math.abs(Date.now() - timestamp) > timeout) {
			//Request is to old
			console.error('OLD REQUEST!!!');
			return false;
		}

		var challange = authObj.hash;
		var secret = fetchUserById(authObj.id);

		console.log('RAW: ', secret, {
                        method: $dup.method,
                        timestamp: timestamp,
                        id: authObj.id,
                        url: $dup.url
                });
		console.log('challange: ', challange);

		var answer = createHMAC(secret)({
			method: $dup.method,
			timestamp: timestamp,
			id: authObj.id,
			url: $dup.url
		}, $dup);

		console.log('answer: ', answer);

		return challange === answer ? authObj.id : false;
	};
};



module.exports = {
	getUserObj: getUserObj,
	authHMAC: authHMAC,
	createHMAC: createHMAC,
	createAuthHeader: createAuthHeader
};

