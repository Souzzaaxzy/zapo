export { concatBytes, TEXT_DECODER, TEXT_ENCODER } from 'zapo-js/util';
function ensureBounds(buf, offset, size) {
    if (!Number.isInteger(offset) || offset < 0 || offset + size > buf.length) {
        throw new RangeError(`byte access out of range: offset ${offset}, size ${size}, length ${buf.length}`);
    }
}
export function readUInt32BE(buf, offset) {
    ensureBounds(buf, offset, 4);
    return (((buf[offset] << 24) |
        (buf[offset + 1] << 16) |
        (buf[offset + 2] << 8) |
        buf[offset + 3]) >>>
        0);
}
export function readUInt32LE(buf, offset) {
    ensureBounds(buf, offset, 4);
    return ((buf[offset] |
        (buf[offset + 1] << 8) |
        (buf[offset + 2] << 16) |
        (buf[offset + 3] << 24)) >>>
        0);
}
export function writeUInt32LE(buf, value, offset) {
    ensureBounds(buf, offset, 4);
    buf[offset] = value & 0xff;
    buf[offset + 1] = (value >> 8) & 0xff;
    buf[offset + 2] = (value >> 16) & 0xff;
    buf[offset + 3] = (value >> 24) & 0xff;
}
