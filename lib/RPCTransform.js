var util = require('util');
var Transform = require('stream').Transform;
util.inherits(RPCTransform, Transform);

function RPCTransform (options) {
    if (!(this instanceof RPCTransform))
        return new RPCTransform(options);

    Transform.call(this, options);
    this._inBody = false;
    this._body = [];
    this._is64BitResponse = false;
    this._expectedBytes = -1;
    this._sentBytes = 0;
    this._buffer = new Buffer(0);
}

RPCTransform.prototype._transform = function (chunk, encoding, done) {
    if (this._inBody) {
        this.push(chunk);
        this._sentBytes = this._sentBytes + chunk.length;

        if (this._sentBytes > this._expectedBytes) {
            this.emit('error', new Error('Only ' + this._expectedBytes + ' bytes of data expected, at least ' + this._sentBytes + ' bytes received'));
        }
        return done();
    }

    this._buffer = Buffer.concat([this._buffer, chunk], this._buffer.length + chunk.length);

    if (!this._is64BitResponse && this._buffer.length >= 4) {
        var modifier1 = this._buffer.readUInt8(0);
        var modifier2 = this._buffer.readUInt8(3);

        if (modifier1 !== 173 || (modifier2 !== 0 && modifier2 !== 5)) {
            this.emit('error', new Error('Invalid uWSGI response header modifier.'));
        }

        this._expectedBytes = this._buffer.readUInt16LE(1);
        this._buffer = this._buffer.slice(4);

        this._is64BitResponse = (modifier2 === 5);
        this._inBody = (modifier2 === 0);
    }

    if (this._is64BitResponse && this._buffer.length >= this._expectedBytes) {
        var contentLengthStr = this._buffer.toString('utf8', 2, this._buffer.readUInt16LE(0) + 2);
        if (contentLengthStr !== "CONTENT_LENGTH") {
            this.emit(new Error('Extended uWSGI must contain string "CONTENT_LENGTH".'));
        }

        var length = 0;
        var start = this._buffer.readUInt16LE(0) + 4;
        var numDigits = this._expectedBytes - start;
        for (i = start; i < this._expectedBytes; i++) {
            length = length + (this._buffer.readUInt8(i) - 48) * Math.pow(10, numDigits - 1); // ASCII to int
            numDigits = numDigits - 1;
        }

        this._buffer = this._buffer.slice(this._expectedBytes);

        this._expectedBytes = length;
        this._inBody = true;
    }

    if (this._inBody && this._buffer.length > 0) {
        this.push(this._buffer);
    }

    done();
};

module.exports = RPCTransform;