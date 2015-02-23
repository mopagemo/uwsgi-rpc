/**
 * Module for calling RPC functions registered in uWSGI (http://uwsgi-docs.readthedocs.org/en/latest/RPC.html).
 *
 */

var RPCConnection = require('./lib/RPCConnection');

// CLI
if (require.main === module) {
	var yargs = require('yargs');
	var pkg = require('./package.json');

	var argv = yargs
		.usage('Call an RPC function registered in uWSGI.\nUsage: $0 [options] function [args...]')
		.version(pkg.version)
		.option('h', {
			alias: 'host',
			demand: false,
			describe: 'RPC server host',
			type: 'string',
			default: 'localhost'
		})
		.option('p', {
			alias: 'port',
			demand: true,
			describe: 'RPC server port',
			type: 'number'
		})
		.require(1, 'No remote function name was specified.')
		.argv;

	var rpc = new RPCConnection({ host: argv.host, port: argv.port });
	var functionName = argv._[0];
	var args = argv._.slice(1);

	rpc.call(functionName, args, function (response) {
		console.log(response);
	});
}

module.exports = RPCConnection;