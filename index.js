var net = require('net');

var client = net.connect({ host: '172.16.10.4', port: 9001 });

var response = null;
var position = 0;
var is64BitResponse = false;
client.on('data', function (data) {
	var offset = 0;

	if (response === null) {
		if (data.readUInt8(0) !== 173 || (data.readUInt8(3) !== 0 && data.readUInt8(3) !== 5)) {
			throw new Error('Invalid response', data.toJSON());
		}

		if (data.readUInt8(3) === 5) {
			is64BitResponse = true;
		}

		var responseLength = data.readUInt16LE(1);
		response = new Buffer(responseLength);
		offset = 4;

		if (data.length <= offset) {
			return;
		}
	}

	if (is64BitResponse === true) {
		var contentLengthStr = data.toString('utf8', 2, data.readUInt16LE(0) + 2);
		if (contentLengthStr !== "CONTENT_LENGTH") {
			throw new Error('Invalid response', data.toJSON());
		}
		var length = 0;
		var start = data.readUInt16LE(0) + 4;
		var numDigits = response.length - start;
		for (i = start; i < response.length; i++) {
			length = length + (data.readUInt8(i) - 48) * Math.pow(10, numDigits - 1); // ASCII to int
			numDigits = numDigits - 1;
		}
		offset = response.length;
		response = new Buffer(length);
		is64BitResponse = false;
	}

	data.copy(response, position, offset);
	position = position + data.length - offset;

	if (position === response.length) {
		console.log(response.toString('utf8'));
		client.end();
	}
});

var call = function (name, args) {
	var ulen = name.length;
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
	body.writeUInt16LE(ulen, 0);
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