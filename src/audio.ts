export class SoundManager {
  private ctx: AudioContext | null = null;
  private bgm: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private bgmStopped: boolean = false;
  private tickingInterval: number | null = null;

  constructor() {
    // Initialized on first user interaction to comply with browser policies
  }

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgm) {
      this.bgm.muted = this.isMuted;
    }
    return this.isMuted;
  }

  public stopBGM() {
    this.bgmStopped = true;
  }

  public resumeBGM() {
    this.bgmStopped = false;
  }

  public startBGM() {
    if (this.bgm || (this.ctx && (this.ctx as any).synthBGM)) return;
    this.initCtx();
    
    // Create a synthesized cyberpunk loop as a reliable fallback
    const playBar = (time: number) => {
        if (this.isMuted || this.bgmStopped) return;
        
        const now = time;
        
        // --- Bass Layer (Deep Cyberpunk Drive) ---
        const bassOsc = this.ctx!.createOscillator();
        const bassGain = this.ctx!.createGain();
        bassOsc.type = 'sawtooth';
        const bassFreqs = [41.20, 41.20, 55.00, 48.99]; // E1, E1, A1, G1
        
        // --- Synth Percussion (Snappy Snare/Hat) ---
        const noiseGen = () => {
          const bufferSize = this.ctx!.sampleRate * 0.05;
          const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          return buffer;
        };

        for (let i = 0; i < 4; i++) {
            const beatTime = now + i * 0.5;
            
            // Bass trigger
            bassOsc.frequency.setValueAtTime(bassFreqs[i], beatTime);
            bassGain.gain.setValueAtTime(0.15, beatTime);
            bassGain.gain.exponentialRampToValueAtTime(0.01, beatTime + 0.45);

            // Snare-like on beats 2 and 4
            if (i % 2 === 1) {
              const noise = this.ctx!.createBufferSource();
              const noiseGain = this.ctx!.createGain();
              noise.buffer = noiseGen();
              noiseGain.gain.setValueAtTime(0.05, beatTime);
              noiseGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.1);
              noise.connect(noiseGain);
              noiseGain.connect(this.ctx!.destination);
              noise.start(beatTime);
            }
        }
        
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx!.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 2);

        // --- Lead Arpeggio (Energetic Pulse) ---
        const leadOsc = this.ctx!.createOscillator();
        const leadGain = this.ctx!.createGain();
        leadOsc.type = 'square';
        const leadFreqs = [164.81, 196.00, 220.00, 246.94]; // E3, G3, A3, B3
        
        for (let i = 0; i < 8; i++) {
          const tickTime = now + i * 0.25;
          leadOsc.frequency.setValueAtTime(leadFreqs[i % 4] * 2, tickTime);
          leadGain.gain.setValueAtTime(0.03, tickTime);
          leadGain.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.2);
        }
        
        leadOsc.connect(leadGain);
        leadGain.connect(this.ctx!.destination);
        leadOsc.start(now);
        leadOsc.stop(now + 2);
    };

    let nextBarTime = this.ctx!.currentTime;
    const scheduler = () => {
        while (nextBarTime < this.ctx!.currentTime + 0.1) {
            playBar(nextBarTime);
            nextBarTime += 2;
        }
        setTimeout(scheduler, 50);
    };

    (this.ctx as any).synthBGM = true;
    scheduler();
    console.log("Synthesized Cyberpunk BGM started");
  }

  public playTimeStopSounds() {
    if (this.isMuted) return;
    this.initCtx();
    
    if (this.tickingInterval) clearInterval(this.tickingInterval);
    
    const playTick = () => {
        if (this.isMuted) return;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx!.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx!.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start();
        osc.stop(this.ctx!.currentTime + 0.05);
    };

    this.tickingInterval = window.setInterval(playTick, 500);
    playTick();
  }

  public stopTimeStopSounds() {
    if (this.tickingInterval) {
        clearInterval(this.tickingInterval);
        this.tickingInterval = null;
    }
  }

  public playEat() {
    if (this.isMuted) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx!.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  public playEvolve() {
    if (this.isMuted) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, this.ctx!.currentTime + 0.5);

    gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }

  public playSkill() {
    if (this.isMuted) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx!.currentTime);
    
    // Create a pulsing effect
    for(let i=0; i<10; i++) {
        osc.frequency.exponentialRampToValueAtTime(440 + (i % 2 === 0 ? 100 : -100), this.ctx!.currentTime + (i * 0.05));
    }

    gain.gain.setValueAtTime(0.15, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }

  public playGameOver() {
    if (this.isMuted) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx!.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx!.currentTime + 0.8);

    gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.75);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.8);
  }
}
