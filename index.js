/**
 * Module for calling RPC functions registered in uWSGI (http://uwsgi-docs.readthedocs.org/en/latest/RPC.html).
 *
 */

var net = require('net');
var RPCConnection = require('./lib/RPCConnection');

var rpc = new RPCConnection({ host: '172.16.10.4', port: 9001 });

// CLI
if (require.main === module) {
	var functionName = process.argv[2];
	var args = [].concat(process.argv);
	args.splice(0, 3);

	if (!functionName) {
		throw new Error('No RPC function name was passed on the CLI.');
	}
	rpc.call(functionName, args, function (response) {
		console.log(response);
	});
}

module.exports = RPCConnection;