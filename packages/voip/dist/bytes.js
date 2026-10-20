"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEXT_ENCODER = exports.TEXT_DECODER = exports.concatBytes = void 0;
exports.readUInt32BE = readUInt32BE;
exports.readUInt32LE = readUInt32LE;
exports.writeUInt32LE = writeUInt32LE;
var util_1 = require("zapo-js/util");
Object.defineProperty(exports, "concatBytes", { enumerable: true, get: function () { return util_1.concatBytes; } });
Object.defineProperty(exports, "TEXT_DECODER", { enumerable: true, get: function () { return util_1.TEXT_DECODER; } });
Object.defineProperty(exports, "TEXT_ENCODER", { enumerable: true, get: function () { return util_1.TEXT_ENCODER; } });
function ensureBounds(buf, offset, size) {
    if (!Number.isInteger(offset) || offset < 0 || offset + size > buf.length) {
        throw new RangeError(`byte access out of range: offset ${offset}, size ${size}, length ${buf.length}`);
    }
}
function readUInt32BE(buf, offset) {
    ensureBounds(buf, offset, 4);
    return (((buf[offset] << 24) |
        (buf[offset + 1] << 16) |
        (buf[offset + 2] << 8) |
        buf[offset + 3]) >>>
        0);
}
function readUInt32LE(buf, offset) {
    ensureBounds(buf, offset, 4);
    return ((buf[offset] |
        (buf[offset + 1] << 8) |
        (buf[offset + 2] << 16) |
        (buf[offset + 3] << 24)) >>>
        0);
}
function writeUInt32LE(buf, value, offset) {
    ensureBounds(buf, offset, 4);
    buf[offset] = value & 0xff;
    buf[offset + 1] = (value >> 8) & 0xff;
    buf[offset + 2] = (value >> 16) & 0xff;
    buf[offset + 3] = (value >> 24) & 0xff;
}
