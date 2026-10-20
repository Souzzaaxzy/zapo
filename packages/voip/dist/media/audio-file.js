"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeAudioFile = decodeAudioFile;
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const util_1 = require("zapo-js/util");
const bytes_js_1 = require("../bytes.js");
const FFMPEG_BIN = 'ffmpeg';
const MAX_DECODE_BYTES = 128 * 1024 * 1024;
const MAX_STDERR_CHARS = 16 * 1024;
const ffmpegProbeCache = new Map();
function probeBinary(bin) {
    return new Promise((resolve) => {
        (0, node_child_process_1.execFile)(bin, ['-version'], { timeout: 5000 }, (err) => resolve(!err));
    });
}
async function hasFfmpeg(bin) {
    let available = ffmpegProbeCache.get(bin);
    if (available === undefined) {
        available = await probeBinary(bin);
        if (available) {
            ffmpegProbeCache.set(bin, available);
        }
    }
    return available;
}
/** Decodes an audio file to mono float PCM at `sampleRate` through ffmpeg. */
async function decodeAudioFile(audioPath, sampleRate) {
    try {
        await (0, promises_1.access)(audioPath);
    }
    catch {
        throw new Error(`File not found: ${audioPath}`);
    }
    if (!(await hasFfmpeg(FFMPEG_BIN))) {
        throw new Error('ffmpeg not found on PATH (install ffmpeg to load audio files)');
    }
    const pcmData = await decodeWithFFmpeg(audioPath, sampleRate);
    return int16ToFloat32(pcmData);
}
function int16ToFloat32(pcmData) {
    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
        float32[i] = pcmData[i] / 32768.0;
    }
    return float32;
}
async function decodeWithFFmpeg(inputPath, sampleRate) {
    return new Promise((resolve, reject) => {
        const proc = (0, node_child_process_1.spawn)(FFMPEG_BIN, [
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            inputPath,
            '-ac',
            '1',
            '-ar',
            String(sampleRate),
            '-acodec',
            'pcm_s16le',
            '-f',
            's16le',
            'pipe:1'
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks = [];
        let decodedBytes = 0;
        let stderr = '';
        let aborted = false;
        proc.stdout?.on('data', (chunk) => {
            if (aborted)
                return;
            decodedBytes += chunk.length;
            if (decodedBytes > MAX_DECODE_BYTES) {
                aborted = true;
                proc.kill('SIGKILL');
                reject(new Error(`ffmpeg output exceeded ${MAX_DECODE_BYTES} bytes: ${inputPath}`));
                return;
            }
            chunks.push((0, util_1.toBytesView)(chunk));
        });
        proc.stderr?.on('data', (chunk) => {
            stderr = (stderr + bytes_js_1.TEXT_DECODER.decode(chunk)).slice(0, MAX_STDERR_CHARS);
        });
        proc.on('error', (err) => reject(new Error(`ffmpeg not available (install ffmpeg on PATH): ${err.message}`)));
        proc.on('close', (code) => {
            if (aborted)
                return;
            if (code !== 0) {
                reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
                return;
            }
            const pcmBytes = (0, bytes_js_1.concatBytes)(chunks);
            resolve(new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength >> 1));
        });
    });
}
