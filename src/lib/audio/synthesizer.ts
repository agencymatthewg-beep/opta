/**
 * Audio Synthesizer
 *
 * Generates audio using Web Audio API oscillators and effects.
 * All sounds are synthesized programmatically - no external audio files needed.
 *
 * Sound design follows DESIGN_SYSTEM.md Part 11: "Crystalline + Spatial"
 * - Glass-like chimes and resonant tones
 * - Echoing, void-like acoustic space
 * - Beautiful tones floating in infinite dark
 */

import type { SoundName } from './types';

/**
 * Create a simple convolver reverb impulse response
 */
function createReverbImpulse(
  audioContext: AudioContext,
  duration: number = 0.5,
  decay: number = 2.0
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      // Exponential decay with some randomness for natural reverb
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  return impulse;
}

/**
 * Synthesizer class for generating sounds
 */
export class AudioSynthesizer {
  private audioContext: AudioContext;
  private reverbBuffer: AudioBuffer | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Initialize reverb (call after user interaction)
   */
  async initReverb(): Promise<void> {
    if (!this.reverbBuffer) {
      this.reverbBuffer = createReverbImpulse(this.audioContext, 0.8, 2.5);
    }
  }

  /**
   * Create a reverb node
   */
  private createReverb(): ConvolverNode | null {
    if (!this.reverbBuffer) return null;

    const convolver = this.audioContext.createConvolver();
    convolver.buffer = this.reverbBuffer;
    return convolver;
  }

  /**
   * Create a compressor to prevent clipping
   */
  private createCompressor(): DynamicsCompressorNode {
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    return compressor;
  }

  /**
   * Synthesize a ring wake-up sound
   * Soft "whoosh" rising tone (300ms)
   */
  synthesizeRingWake(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const duration = 0.3;

    // Main rising oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + duration);

    // Secondary harmonic
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(400, now);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + duration);

    // Noise for "whoosh" texture
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Filter for noise
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(4000, now + duration);
    noiseFilter.Q.value = 0.5;

    // Gains
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(volume * 0.5, now + duration * 0.3);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0, now);
    osc2Gain.gain.linearRampToValueAtTime(volume * 0.25, now + duration * 0.4);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.15, now + duration * 0.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Connect
    osc.connect(oscGain);
    osc2.connect(osc2Gain);
    noise.connect(noiseFilter).connect(noiseGain);

    oscGain.connect(destination);
    osc2Gain.connect(destination);
    noiseGain.connect(destination);

    // Play
    osc.start(now);
    osc2.start(now);
    noise.start(now);
    osc.stop(now + duration);
    osc2.stop(now + duration);
    noise.stop(now + duration);
  }

  /**
   * Create a looping ring hum oscillator node
   * Returns a source node that can be stopped
   */
  createRingHumSource(destination: AudioNode, volume: number): OscillatorNode {
    const ctx = this.audioContext;

    // Very low subtle hum
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 80;

    // LFO for subtle modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Main gain
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.15;

    // Subtle tremolo
    const tremolo = ctx.createOscillator();
    tremolo.type = 'sine';
    tremolo.frequency.value = 2;

    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = volume * 0.05;

    tremolo.connect(tremoloGain);
    tremoloGain.connect(gain.gain);

    osc.connect(gain);
    gain.connect(destination);

    osc.start();
    lfo.start();
    tremolo.start();

    return osc;
  }

  /**
   * Create a processing pulse source
   */
  createProcessingSource(destination: AudioNode, volume: number): OscillatorNode {
    const ctx = this.audioContext;

    // Pulsing tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;

    // LFO for pulsing
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 2; // Pulse rate

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = volume * 0.5;

    const mainGain = ctx.createGain();
    mainGain.gain.value = 0;

    lfo.connect(lfoGain);
    lfoGain.connect(mainGain.gain);

    osc.connect(mainGain);
    mainGain.connect(destination);

    osc.start();
    lfo.start();

    return osc;
  }

  /**
   * Synthesize ring explosion sound
   * Sharp transient + low rumble + reverb tail (500ms total)
   */
  synthesizeRingExplosion(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Initial sharp transient (impact)
    const transient = ctx.createOscillator();
    transient.type = 'square';
    transient.frequency.setValueAtTime(800, now);
    transient.frequency.exponentialRampToValueAtTime(50, now + 0.05);

    const transientGain = ctx.createGain();
    transientGain.gain.setValueAtTime(volume * 0.8, now);
    transientGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    // Low rumble body (200ms)
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(60, now);
    rumble.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.02);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    // Sub bass for depth
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 40;

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.03);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    // Compressor to prevent clipping
    const compressor = this.createCompressor();

    // Reverb for tail
    const reverb = this.createReverb();

    // Dry/wet mix
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.6;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.4;

    // Connect transient
    transient.connect(transientGain);
    transientGain.connect(compressor);

    // Connect rumble
    rumble.connect(rumbleGain);
    rumbleGain.connect(compressor);

    // Connect sub
    sub.connect(subGain);
    subGain.connect(compressor);

    // Dry path
    compressor.connect(dryGain);
    dryGain.connect(destination);

    // Wet path (reverb)
    if (reverb) {
      compressor.connect(reverb);
      reverb.connect(wetGain);
      wetGain.connect(destination);
    }

    // Play
    transient.start(now);
    rumble.start(now);
    sub.start(now);

    transient.stop(now + 0.1);
    rumble.stop(now + 0.3);
    sub.stop(now + 0.35);
  }

  /**
   * Synthesize ring sleep sound
   * Descending tone fade (400ms)
   */
  synthesizeRingSleep(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const duration = 0.4;

    // Main descending oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + duration);

    // Secondary harmonic
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(900, now);
    osc2.frequency.exponentialRampToValueAtTime(200, now + duration);

    // Gains with fade out
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(volume * 0.25, now);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Filter for softening
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + duration);

    // Connect
    osc.connect(oscGain);
    osc2.connect(osc2Gain);
    oscGain.connect(filter);
    osc2Gain.connect(filter);
    filter.connect(destination);

    // Play
    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration);
    osc2.stop(now + duration);
  }

  /**
   * Synthesize UI click sound
   * Soft tick (50ms)
   */
  synthesizeUIClick(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Sharp attack oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    // High-pass filter for click character
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Synthesize UI hover sound
   * Very subtle blip (30ms)
   */
  synthesizeUIHover(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Synthesize UI success sound
   * Ascending crystalline chime (200ms)
   */
  synthesizeUISuccess(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Three-note ascending chime
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
    const delays = [0, 0.06, 0.12];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const startTime = now + delays[i];
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  /**
   * Synthesize UI error sound
   * Low tone (150ms)
   */
  synthesizeUIError(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Low descending tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Synthesize UI toggle sound
   * Mechanical click (40ms)
   */
  synthesizeUIToggle(destination: AudioNode, volume: number): void {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Two quick clicks for mechanical feel
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.value = 1500;

    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 800;

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(volume * 0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(volume * 0.25, now + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    // Bandpass for click character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 2;

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(destination);

    osc1.start(now);
    osc2.start(now + 0.015);
    osc1.stop(now + 0.02);
    osc2.stop(now + 0.04);
  }

  /**
   * Create ambient hum source
   * Sci-fi computer hum with subtle modulation
   */
  createAmbientHumSource(destination: AudioNode, volume: number): OscillatorNode {
    const ctx = this.audioContext;

    // Base hum (very low)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;

    // Harmonic
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 120;

    // High harmonic for "air" feel
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = 240;

    // Slow LFO for subtle modulation over time
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Gains (very low volumes)
    const gain1 = ctx.createGain();
    gain1.gain.value = volume * 0.5;

    const gain2 = ctx.createGain();
    gain2.gain.value = volume * 0.3;

    const gain3 = ctx.createGain();
    gain3.gain.value = volume * 0.1;

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.08; // Very quiet

    osc.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);

    masterGain.connect(destination);

    osc.start();
    osc2.start();
    osc3.start();
    lfo.start();

    return osc;
  }

  /**
   * Synthesize a sound by name
   */
  synthesize(name: SoundName, destination: AudioNode, volume: number): void {
    switch (name) {
      case 'ring-wake':
        this.synthesizeRingWake(destination, volume);
        break;
      case 'ring-explosion':
        this.synthesizeRingExplosion(destination, volume);
        break;
      case 'ring-sleep':
        this.synthesizeRingSleep(destination, volume);
        break;
      case 'ui-click':
        this.synthesizeUIClick(destination, volume);
        break;
      case 'ui-hover':
        this.synthesizeUIHover(destination, volume);
        break;
      case 'ui-success':
        this.synthesizeUISuccess(destination, volume);
        break;
      case 'ui-error':
        this.synthesizeUIError(destination, volume);
        break;
      case 'ui-toggle':
        this.synthesizeUIToggle(destination, volume);
        break;
      default:
        console.warn(`Unknown sound: ${name}`);
    }
  }
}
