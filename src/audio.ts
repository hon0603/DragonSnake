export class SoundManager {
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
        const bassOsc = this.ctx!.createOscillator();
        const bassGain = this.ctx!.createGain();
        
        bassOsc.type = 'sawtooth';
        // Cyberpunk bass pattern: E1, E1, G1, A1 style
        const freqs = [41.20, 41.20, 48.99, 55.00]; 
        const now = time;
        
        for (let i = 0; i < 4; i++) {
            bassOsc.frequency.setValueAtTime(freqs[i], now + i * 0.5);
            bassGain.gain.setValueAtTime(0.1, now + i * 0.5);
            bassGain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * 0.5 - 0.05);
        }
        
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx!.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 2);
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
