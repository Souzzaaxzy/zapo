export { concatBytes, TEXT_DECODER, TEXT_ENCODER } from 'zapo-js/util';
export declare function readUInt32BE(buf: Uint8Array, offset: number): number;
export declare function readUInt32LE(buf: Uint8Array, offset: number): number;
export declare function writeUInt32LE(buf: Uint8Array, value: number, offset: number): void;
