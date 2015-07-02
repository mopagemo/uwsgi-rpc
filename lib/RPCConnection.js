var net = require('net');
var concat = require('concat-stream');
var RPCTransform = require('./RPCTransform');

function RPCConnection (host, port) {
    this.host = host;
    this.port = port;
}

RPCConnection.prototype.call = function (name, args, callback) {
    if (args.length > 254) {
        throw new Error('uSWGI has a 254 arguments per function maximum.');
    }

    args = args.map(function (value) {
        return '' + value;
    });

    var dataSize = (2 + name.length);
    for (var i = 0; i < args.length; i++) {
        var argLength = Buffer.byteLength(args[i], 'utf8');
        if (argLength > 65535) {
            throw new Error('Each RPC function argument has a 16 bit size limit (65535 bytes) in uWSGI.');
        }
        dataSize += 2 + argLength;
    }

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
        var argLength = Buffer.byteLength(args[i], 'utf8');
        body.writeUInt16LE(argLength, pos, 1);
        body.write(args[i], pos + 2, 'utf8');
        pos = pos + argLength + 2;
    }

    // Send data
    var connection = net.createConnection({ host: this.host, port: this.port });
    connection.write(header);
    connection.write(body);

    var concatStream = concat({ encoding: 'string' }, callback);
    connection.pipe(new RPCTransform()).pipe(concatStream);
};

module.exports = RPCConnection;