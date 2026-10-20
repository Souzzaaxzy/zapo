import { type Logger } from 'zapo-js';
import { type AudioSender, type WaAudioEngineConfig } from '../types.js';
export interface WaAudioEngineOptions extends Partial<WaAudioEngineConfig> {
    readonly logger?: Logger;
    /** Clock the pacers run on and stamp capture with, in ms; `performance.now` by default. */
    readonly now?: () => number;
}
/**
 * The audio clock of a call carried in Node and its outbound source. Both pacers move every
 * chunk the elapsed time owes, so a late or coarse timer costs no audio.
 */
export declare class WaAudioEngine {
    private readonly logger;
    private readonly now;
    private audioSender;
    private audioBuffer;
    private audioPosition;
    private audioFinished;
    private onAudioFinished;
    private playbackInterval;
    private playbackStartMs;
    /** Playback time the clock has accounted for since it started: pulled or forgiven. */
    private playbackSamples;
    private playbackStalls;
    private captureInterval;
    private captureStartMs;
    /** Capture time the clock has accounted for since it started: handed over or forgiven. */
    private captureSamples;
    private captureChunks;
    private captureStalls;
    private readonly sampleRate;
    private readonly captureChunkSize;
    private readonly outputSize;
    private readonly intervalMs;
    private playoutSource;
    private playbackSink;
    private silenceMode;
    private externalMode;
    private liveWritePos;
    private extStarted;
    private readonly extPreBufferSize;
    private readonly extTargetBuffer;
    private readonly extTargetMs;
    private readonly extHighWater;
    private readonly extMaxBuffer;
    private extSkipCount;
    private extDropCount;
    private readonly captureChunkBuffer;
    private readonly silenceChunkBuffer;
    private readonly playbackOutputBuffer;
    constructor(config?: WaAudioEngineOptions);
    setAudioSender(sender: AudioSender): void;
    setOnAudioFinished(callback: (() => void) | null): void;
    /** Leaving external mode drops the live ring, so its stale samples never replay as a file. */
    setExternalMode(enabled: boolean): void;
    /**
     * Appends live PCM and returns the buffered level in ms. Bounded: an oversized chunk keeps
     * its tail and overflow drops the oldest samples.
     */
    feedExternalAudio(data: Float32Array): number;
    getLiveBufferMs(): number;
    /** Live-feed backpressure in ms: pause a producer at `pauseMs`, resume at `resumeMs`. */
    static feedWatermarksMs(): {
        pauseMs: number;
        resumeMs: number;
    };
    loadAudioFile(audioPath: string): Promise<void>;
    /** Where playback pulls decoded audio from: fills the buffer, returns the real samples. */
    setPlayoutSource(source: ((out: Float32Array) => number) | null): void;
    startPlayback(): void;
    /** Pulls every block of playback time owed since the clock started, however late the timer. */
    private tickPlayback;
    stopPlayback(): void;
    /** Receives paced playback in the engine's own buffer, overwritten by the next pull. */
    setPlaybackSink(sink: ((pcm: Float32Array) => void) | null): void;
    /** Starts the capture clock on warmup silence; {@link startCapture} later keeps this clock. */
    startSilenceCapture(): void;
    /**
     * Switches capture to the real source (live feed, file from its start, or silence), keeping
     * a warmup clock so the stamps stay one timeline. A no-op once the real source runs.
     */
    startCapture(): void;
    private startCaptureClock;
    /** Hands over every capture chunk owed since the clock started, stamped on that clock. */
    private tickCapture;
    private sendCaptured;
    /** Whole chunks a clock started at `startMs` owes beyond the `doneSamples` it covered. */
    private chunksOwed;
    private stopCapture;
    /** Stops both clocks and releases the loaded audio, which can run to hundreds of MB. */
    stop(): void;
    private getNextChunk;
}
