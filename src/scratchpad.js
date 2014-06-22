'use strict';
var rest = require('./main')(require('http'));

var getUserSecret = function (id) {
	return 'secret';
};

rest.create(8888)

.method('get', '/user/:id', function (id, $auth) {
	id = $auth(getUserSecret);
	return {id: id};
});