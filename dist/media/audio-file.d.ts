/** Decodes an audio file to mono float PCM at `sampleRate` through ffmpeg. */
export declare function decodeAudioFile(audioPath: string, sampleRate: number): Promise<Float32Array>;
