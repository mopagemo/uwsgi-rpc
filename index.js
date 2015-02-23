var net = require('net');
var RPCTransform = require('./lib/RPCTransform');

var client = net.connect({ host: '172.16.10.4', port: 9001 });

var call = function (name, args) {
	var dataSize = (2 + name.length);
	for (var i = 0; i < args.length; i++) {
		dataSize += 2 + args[i].length;
	}

	// uWSGI RPC source: https://github.com/unbit/uwsgi/blob/ed2ca5d33325dc925f6fc5558d0b817447327049/core/rpc.c
	// Create uwsgi packet header (http://uwsgi-docs.readthedocs.org/en/latest/Protocol.html)
	var header = new Buffer(4);
	header.writeUInt8(173, 0);
	header.writeUInt16LE(dataSize, 1);
	header.writeUInt8(0, 3);

	// Create data packet
	var body = new Buffer(dataSize);
	// Write function name to buffer
	body.writeUInt16LE(name.length, 0);
	body.write(name, 2, name.length, 'utf8');

	// Write arguments to buffer
	var pos = name.length + 2;
	for (i = 0; i < args.length; i++) {
		body.writeUInt16LE(args[i].length, pos, 1);
		body.write(args[i], pos + 2, 'utf8');
		pos = pos + args[i].length + 2;
	}

	// Send data
	client.write(header);
	client.write(body);
	var stream = client.pipe(new RPCTransform()).pipe(process.stdout);
};

// CLI
if (require.main === module) {
	var functionName = process.argv[2];
	var args = [].concat(process.argv);
	args.splice(0, 3);

	if (!functionName) {
		throw new Error('No RPC function name was passed on the CLI.');
	}
	call(functionName, args);
}

module.exports = call;