/* eslint-disable @typescript-eslint/no-floating-promises */

import type WebMscore from "webmscore";
import type { SynthRes } from "webmscore/schemas";
import rbTree from "functional-red-black-tree";
import { AudioContext } from "../utils/audio";

export interface AudioFragment {
  startTime: number; // in seconds
  endTime: number;
  duration: number;
  audioBuffer: AudioBuffer;
}

/**
 * Audio synthesizer with cache
 * (using Web Audio API)
 * (CPU sensitive)
 */
export class Synthesizer {
  private readonly CHANNELS = 2;
  private readonly FRAME_LENGTH = 512;
  private readonly SAMPLE_RATE = 44100; // 44.1 kHz

  private readonly BATCH_SIZE = 8; // number of chunks (512 frames) in a AudioFragment, to be played together
  private readonly SYNTH_FN_BATCH_SIZE = 32; // 0.3712 s, number of chunks to be synthed at once from webmscore `synthAudioBatch`
  private readonly PLAY_QUEUE_SIZE = 4;
  /**
   * The duration (s) of one AudioFragment
   * ~ 0.0116 s * `BATCH_SIZE`
   */
  private readonly FRAGMENT_DURATION =
    (this.FRAME_LENGTH / this.SAMPLE_RATE) * this.BATCH_SIZE;

  /**
   * See https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
   */
  private readonly GAIN_TIME_CONSTANT = 0.001; // 1ms * GAIN_TIME_N
  private readonly GAIN_TIME_N = 3;

  /**
   * index time positions (in seconds) to AudioFragments
   * (immutable)
   */
  private cache: rbTree.Tree<number, AudioFragment> | null = rbTree<
    number,
    AudioFragment
  >();

  public worklet: { cancel(): Promise<void> } | undefined;

  /**
   * The playback speed and pitch can be adjusted independently
   */
  public speed = 1.0;

  public destination: AudioNode = this.audioCtx.destination;

  constructor(
    private readonly mscore: WebMscore,
    /** the score's duration **in seconds** */
    private readonly duration: number,
    /** the current playback time **in seconds** */
    public time = 0,
    private readonly audioCtx = new AudioContext()
  ) {}

  /**
   * Synthesize audio fragments
   * @param onReady called once the synth function is ready
   * @param onUpdate called each time a fragment is processed, or error triggered
   */
  async startSynth(
    startTime: number,
    onUpdate?: (fragment: AudioFragment | undefined, ended: boolean) => any
  ): Promise<void> {
    let aborted = false;

    // cancel the previous synth worklet
    if (this.worklet) {
      await this.worklet.cancel();
    }

    // init the synth worklet
    const synthFn = await this.mscore.synthAudioBatch(
      startTime,
      this.SYNTH_FN_BATCH_SIZE
    );
    this.worklet = {
      async cancel(): Promise<void> {
        aborted = true;
        await synthFn(true /* cancel */);
      },
    };

    let synthResL: SynthRes[] = [];

    // synth loop
    while (true) {
      if (aborted) {
        // try to process the remaining `synthRes`es
        if (synthResL.length) {
          const [result] = this.buildFragment(synthResL);
          void onUpdate?.(result, true);
        } else {
          void onUpdate?.(undefined, true);
        }

        break;
      }

      // process synth
      // returns an array of SynthRes
      const synthResArr: SynthRes[] = await synthFn();

      if (synthResArr.some((r) => r.endTime < 0)) {
        // the score ends previously in past synth calls
        console.warn("The score has ended.");
        aborted = true;
        continue;
      }

      synthResL.push(...synthResArr);
      while (synthResL.length >= this.BATCH_SIZE) {
        const [result, existed] = this.buildFragment(
          synthResL.slice(0, this.BATCH_SIZE)
        );
        void onUpdate?.(result, existed);
        if (existed) {
          // cache exists for this playback time
          // so stop synth further
          await this.worklet.cancel(); // set aborted = true, and release resources
          break;
        }
        synthResL = synthResL.slice(this.BATCH_SIZE);
      }

      if (synthResArr.some((r) => r.done)) {
        // the score ends, no more fragments available
        aborted = true;
      }
    }
  }

  /**
   * Find the AudioFragment that its `startTime` is in (`time - FRAGMENT_DURATION`, `time`]
   */
  private findFragment(time: number): AudioFragment | undefined {
    const fragment: AudioFragment | undefined = this.cache?.le(time).value;
    if (fragment && fragment.startTime > time - this.FRAGMENT_DURATION) {
      return fragment;
    }
  }

  /**
   * Build AudioFragment from the list of `SynthRes`es, and load it to cache
   * @returns the AudioFragment processed, and `true` if the AudioFragment exists in cache
   */
  private buildFragment(
    synthResL: SynthRes[]
  ): [AudioFragment, boolean /* existed */] {
    const startTime = synthResL[0].startTime;
    const endTime = synthResL.slice(-1)[0].endTime;

    // skip if the AudioFragment exists in cache
    let existed = false;
    if (this.findFragment(endTime)) {
      existed = true;
    }

    // create AudioBuffer
    // AudioBuffers can be reused for multiple plays of the sound
    const buf = this.audioCtx.createBuffer(
      // Safari does not support `AudioBuffer` constructor
      this.CHANNELS, // numberOfChannels
      this.FRAME_LENGTH * synthResL.length, // length
      this.SAMPLE_RATE // sampleRate
    );

    for (let i = 0; i < synthResL.length; i++) {
      const synthRes = synthResL[i];
      const bufOffset = i * this.FRAME_LENGTH;

      // copy data to the AudioBuffer
      // audio frames are non-interleaved float32 PCM
      const chunk = new Float32Array(synthRes.chunk.buffer);

      for (let c = 0; c < this.CHANNELS; c++) {
        const chanChunk = chunk.subarray(
          c * this.FRAME_LENGTH,
          (c + 1) * this.FRAME_LENGTH
        );
        buf.copyToChannel(chanChunk, c, bufOffset);
      }
    }

    // add to cache
    const fragment: AudioFragment = {
      audioBuffer: buf,
      startTime,
      endTime,
      duration: endTime - startTime,
    };
    this.cache = this.cache?.insert(startTime, fragment) ?? null;

    return [fragment, existed];
  }

  /**
   * Play a single AudioFragment,
   * the promise resolves once the entire fragment has been played
   */
  private playFragment(
    f: AudioFragment,
    when = this.audioCtx.currentTime
  ): Promise<void> {
    return new Promise((resolve) => {
      // granular synthesis

      const speed = this.speed;
      const end = when + f.duration / speed;

      let source: AudioBufferSourceNode | undefined;
      for (; when < end; when += f.duration) {
        const sourceEnd = Math.min(when + f.duration, end);

        let dest = this.destination;
        if (speed !== 1.0) {
          // not default speed
          // smoothing
          //
          // think of a simple sine wave
          //  .-.   -.
          // /   \    \
          //      '-   '-'
          // discontinuity -> audible clicks
          //
          // reduce the amplitude (gain) at the point of discontinuity
          //  -> less discontinuous
          //  -> smoother
          const gainNode = this.audioCtx.createGain();
          gainNode.gain.value = 0;
          gainNode.gain.setTargetAtTime(1, when, this.GAIN_TIME_CONSTANT);
          gainNode.gain.setTargetAtTime(
            0,
            sourceEnd - this.GAIN_TIME_CONSTANT * this.GAIN_TIME_N,
            this.GAIN_TIME_CONSTANT
          );
          gainNode.connect(dest);
          dest = gainNode;
        }

        // An AudioBufferSourceNode can only be played once
        source = this.audioCtx.createBufferSource();
        source.buffer = f.audioBuffer;
        source.connect(dest);

        source.start(when);
        source.stop(sourceEnd);
      }

      void source?.addEventListener("ended", () => resolve(), { once: true });
    });
  }

  /**
   * @param onUpdate called each time a fragment is played (the playback time updates)
   * @returns the promise resolves once the score ended, or user aborted
   */
  async play(
    abort?: AbortSignal,
    onUpdate?: (time: number) => any
  ): Promise<void> {
    const queue = new Array<Promise<void>>();

    let ctxTime = 0;
    let played = 0;
    const resetClock = (): void => {
      // reset the playback clock
      ctxTime = this.audioCtx.currentTime;
      played = 0;
    };
    resetClock();

    let speed = this.speed;

    while (true) {
      if (
        this.time >= this.duration || // the score ends
        abort?.aborted // user aborted
      ) {
        return;
      }

      let fragment = this.findFragment(this.time);
      if (!fragment) {
        // get the synth worklet ready for this playback time, and get its first fragment processed
        const [f, ended] = await new Promise(
          (
            resolve: (args: [AudioFragment | undefined, boolean]) => void,
            reject
          ) => {
            this.startSynth(this.time, (...args) => resolve(args)).catch(
              reject
            );
          }
        );
        if (ended || !f) {
          return;
        } else {
          fragment = f;
          resetClock();
        }
      }

      if (speed !== this.speed) {
        // playback speed has changed
        resetClock();
        speed = this.speed;
      }

      let when = ctxTime + (played * this.FRAGMENT_DURATION) / speed;
      if (this.audioCtx.currentTime > when) {
        // current time is ahead of scheduled time (`when`)
        resetClock();
        when = ctxTime;
      }

      if (queue.length > this.PLAY_QUEUE_SIZE) {
        // wait the previous play request to be finished
        await queue.shift();
      }

      // update the playback time
      this.time = fragment.endTime;
      void onUpdate?.(this.time);

      // request to play one fragment
      queue.push(this.playFragment(fragment, when));
      played++;
    }
  }

  async destroy(): Promise<void> {
    this.cache = null;
    await this.worklet?.cancel();
    await this.audioCtx.close();
  }
}
