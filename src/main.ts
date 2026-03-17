import './style.css';
import { SnakeBody } from './snake';
import type { SkinType } from './snake';
import { spawnFruit } from './fruit';
import { FireworkManager } from './effects';
import { getNextMove } from './ai';
import { SoundManager } from './audio';

interface LeaderboardEntry {
  name: string;
  score: number;
}

const GRID_SIZE = 39;
const INITIAL_SPEED = 150;

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private vortexCanvas: HTMLCanvasElement;
  private vortexCtx: CanvasRenderingContext2D;
  
  private score: number = 0;
  private itemsEaten: number = 0;
  private snake!: SnakeBody;
  private chips: any[] = [];
  private paused: boolean = false;
  private aiEnabled: boolean = false;
  private gameLoopId: number | null = null;
  private currentSkin: SkinType = 'rainbow';
  private spContainer: HTMLElement;
  
  // Mobile/Joystick properties
  private joystickBase: HTMLElement | null = null;
  private joystickStick: HTMLElement | null = null;
  private isJoystickActive: boolean = false;
  private joystickCenter = { x: 0, y: 0 };
  private speed: number = INITIAL_SPEED;
  private fireworks: FireworkManager = new FireworkManager();
  private soundManager: SoundManager = new SoundManager();
  
  private lastMilestoneScore: number = 0;
  private isEvoSpawning: boolean = false;
  private chronoEffectRadius: number = 0;
  private chronoEffectExpanding: boolean = false;
  private chronoEffectShrinking: boolean = false;
  private milestoneNotify!: HTMLElement;
  private abilityDashboard!: HTMLElement;
  private abilityList!: HTMLElement;
  private jojoNotification!: HTMLElement;
  private jojoTimer!: HTMLElement;
  private chronoStartTime: number = 0;
  private chronoShrinkStartTime: number = 0;
  private previewIntervals: number[] = [];
  private isGameOver: boolean = false;
  private gamepadLoopId: number | null = null;
  private lastGamepadState: { [key: number]: boolean } = {};

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.vortexCanvas = document.getElementById('vortex-canvas') as HTMLCanvasElement;
    this.vortexCtx = this.vortexCanvas.getContext('2d')!;
    
    this.milestoneNotify = document.getElementById('milestone-notify')!;
    this.abilityDashboard = document.getElementById('ability-dashboard')!;
    this.abilityList = document.getElementById('ability-list')!;
    this.jojoNotification = document.getElementById('jojo-notification')!;
    this.jojoTimer = this.jojoNotification.querySelector('.jojo-timer')!;
    this.spContainer = document.getElementById('star-platinum-container')!;
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickStick = document.getElementById('joystick-stick');
    this.initEventListeners();
    this.startGamepadLoop();
    this.resizeCanvas();
    this.updateJoystickCenter();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.updateJoystickCenter();
    });
    this.showMenu();
    this.vortexLoop();
    
  }

  private resizeCanvas() {
    const container = document.getElementById('app');
    if (!container) return;
    
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;
    const padding = 40;
    
    // Calculate the best size that fits the screen while maintaining aspect ratio
    // Original size was around 800x800 for the 39x39 grid
    let size = Math.min(availableWidth - padding, availableHeight - padding * 3);
    
    if (availableWidth > 768) {
      size = Math.min(size, 800);
    }

    this.canvas.width = size;
    this.canvas.height = size;
    
    this.vortexCanvas.width = window.innerWidth;
    this.vortexCanvas.height = window.innerHeight;
  }

  private updateJoystickCenter() {
    if (this.joystickBase && window.innerWidth <= 1180) {
      const rect = this.joystickBase.getBoundingClientRect();
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }
  }

  private handleJoystickStart(e: TouchEvent) {
    this.isJoystickActive = true;
    this.updateJoystickCenter(); // Update center just in case of scrolling/layout shifts
    this.handleJoystickMove(e);
  }

  private handleJoystickMove(e: TouchEvent) {
    if (!this.isJoystickActive || !this.joystickStick || this.aiEnabled) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const dx = touch.clientX - this.joystickCenter.x;
    const dy = touch.clientY - this.joystickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 40;
    
    const clampedDistance = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);
    
    const stickX = Math.cos(angle) * clampedDistance;
    const stickY = Math.sin(angle) * clampedDistance;
    
    this.joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    
    // Set direction if moved significantly
    if (distance > 10) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.snake.setDirection({ x: dx > 0 ? 1 : -1, y: 0 });
      } else {
        this.snake.setDirection({ x: 0, y: dy > 0 ? 1 : -1 });
      }
    }
  }

  private handleJoystickEnd() {
    this.isJoystickActive = false;
    if (this.joystickStick) {
      this.joystickStick.style.transform = 'translate(-50%, -50%)';
    }
  }

  private startGamepadLoop() {
    const poll = () => {
      this.pollGamepad();
      this.gamepadLoopId = requestAnimationFrame(poll);
    };
    poll();
  }

  private pollGamepad() {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;

      // D-Pad Mapping (Standard mapping: indexing 12 to 15)
      // Buttons: 0: A, 1: B, 9: Start
      
      // Directions (Left Stick & D-Pad)
      const axes = gp.axes;
      const buttons = gp.buttons;
      
      if (!this.aiEnabled && !this.paused && !this.isGameOver && this.snake) {
          // Left Stick (Axes 0, 1)
          if (axes[1] < -0.5 || buttons[12].pressed) this.snake.setDirection({ x: 0, y: -1 }); // Up
          else if (axes[1] > 0.5 || buttons[13].pressed) this.snake.setDirection({ x: 0, y: 1 }); // Down
          else if (axes[0] < -0.5 || buttons[14].pressed) this.snake.setDirection({ x: -1, y: 0 }); // Left
          else if (axes[0] > 0.5 || buttons[15].pressed) this.snake.setDirection({ x: 1, y: 0 }); // Right
      }

      // Buttons (Edge Detection)
      this.handleGamepadButton(0, buttons[0].pressed, () => this.activateSkill()); // A
      this.handleGamepadButton(1, buttons[1].pressed, () => this.handleBackButton()); // B
      this.handleGamepadButton(9, buttons[9].pressed, () => this.togglePause()); // Start
    }
  }

  private handleGamepadButton(index: number, isPressed: boolean, callback: () => void) {
    if (isPressed && !this.lastGamepadState[index]) {
      callback();
    }
    this.lastGamepadState[index] = isPressed;
  }

  private handleBackButton() {
      if (this.isGameOver) {
          this.showMenu();
      } else if (!document.getElementById('overlay')?.classList.contains('hidden')) {
          // If in menu, maybe do nothing or specialized back logic
      }
  }
  
  private initEventListeners() {
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp': if (!this.aiEnabled) this.snake.setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (!this.aiEnabled) this.snake.setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (!this.aiEnabled) this.snake.setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (!this.aiEnabled) this.snake.setDirection({ x: 1, y: 0 }); break;
        case 'z':
        case 'Z': this.activateSkill(); break;
      }
    });

    // Mobile specific events
    const skillBtn = document.getElementById('mobile-skill-btn');
    skillBtn?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.activateSkill();
    });

    if (this.joystickBase) {
      this.joystickBase.addEventListener('touchstart', (e) => this.handleJoystickStart(e));
      window.addEventListener('touchmove', (e) => this.handleJoystickMove(e), { passive: false });
      window.addEventListener('touchend', () => this.handleJoystickEnd());
    }

    document.getElementById('start-btn')?.addEventListener('click', () => this.startGame());
    document.getElementById('start-btn')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startGame();
    });
    document.getElementById('restart-btn')?.addEventListener('click', () => this.startGame());
    document.getElementById('restart-btn')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startGame();
    });
    document.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('ai-toggle')?.addEventListener('click', () => this.toggleAI());
    document.getElementById('audio-toggle')?.addEventListener('click', () => this.toggleAudio());
    document.getElementById('submit-btn')?.addEventListener('click', () => this.submitScore());

    document.querySelectorAll('.skin-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.skin-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.currentSkin = (opt as HTMLElement).dataset.skin as SkinType;
      });
    });
  }

  private showMenu() {
    document.getElementById('overlay')?.classList.remove('hidden');
    document.getElementById('menu')?.classList.remove('hidden');
    document.getElementById('game-over')?.classList.add('hidden');
    this.startPreviews();
  }

  private startPreviews() {
    this.previewIntervals.forEach(clearInterval);
    this.previewIntervals = [];

    const previews = document.querySelectorAll('.skin-option');
    previews.forEach((opt) => {
      const skin = (opt as HTMLElement).dataset.skin as SkinType;
      const canvas = opt.querySelector('canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      let frame = 0;

      const interval = window.setInterval(() => {
        this.drawPreview(ctx, canvas.width, canvas.height, skin, frame++);
      }, 50);
      this.previewIntervals.push(interval);
    });
  }

  private drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, skin: SkinType, frame: number) {
    ctx.clearRect(0, 0, w, h);
    const cellSize = 10;
    const centerX = w / 2;
    const centerY = h / 2;

    for (let i = 0; i < 4; i++) {
        const x = centerX + Math.cos((frame + i * 5) * 0.2) * 20 - (i * cellSize);
        const y = centerY + Math.sin((frame + i * 5) * 0.2) * 10;
        
        ctx.save();
        ctx.translate(x, y);

        if (skin === 'pixel') {
            ctx.fillStyle = i === 0 ? '#0ff' : '#008888';
            ctx.fillRect(-cellSize/2, -cellSize/2, cellSize-2, cellSize-2);
        } else if (skin === 'dragon') {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, cellSize/2);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(1, '#ffd700');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, cellSize/2, 0, Math.PI * 2);
            ctx.fill();
        } else if (skin === 'rainbow') {
            const hue = (frame * 5 + i * 30) % 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.beginPath();
            ctx.arc(0, 0, cellSize/2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
  }

  private startGame() {
    this.previewIntervals.forEach(clearInterval);
    this.score = 0;
    this.itemsEaten = 0;
    this.lastMilestoneScore = 0;
    this.isEvoSpawning = false;
    this.isGameOver = false;
    this.speed = INITIAL_SPEED;
    
    this.snake = new SnakeBody(GRID_SIZE, this.currentSkin);
    this.spawnInitialChips();
    
    this.updateScoreUI();
    this.updateEnergyUI();
    this.updateAbilityDashboard();
    this.paused = false;
    
    document.getElementById('overlay')?.classList.add('hidden');
    this.soundManager.startBGM();
    if (this.gameLoopId) clearTimeout(this.gameLoopId);
    this.gameLoop();
  }

  private togglePause() {
    this.paused = !this.paused;
    const btn = document.getElementById('pause-btn');
    if (btn) btn.innerText = this.paused ? 'CONTINUE' : 'PAUSE';
  }

  private toggleAI() {
    this.aiEnabled = !this.aiEnabled;
    const btn = document.getElementById('ai-toggle');
    btn?.classList.toggle('active', this.aiEnabled);
  }

  private toggleAudio() {
    const isMuted = this.soundManager.toggleMute();
    const btn = document.getElementById('audio-toggle');
    if (btn) btn.innerText = isMuted ? '🔈' : '🔊';
  }

  private updateScoreUI() {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = this.score.toString();
  }

  private updateEnergyUI() {
    const bar = document.getElementById('energy-fill');
    if (bar) {
        const percent = (this.snake.energy / this.snake.maxEnergy) * 100;
        bar.style.width = `${percent}%`;
        bar.classList.toggle('ready', this.snake.energy >= 50);
    }
  }

  private activateSkill() {
      if (this.snake.useSkill()) {
          this.soundManager.playSkill();
          this.triggerSkillEffect();
          if (this.snake.skin === 'dragon') {
              const head = this.snake.segments[0];
              this.chips.forEach(chip => {
                  chip.pos = { ...head };
              });
          } else if (this.snake.skin === 'pixel') {
              if (this.snake.evolutionLevel === 3) {
                  this.chronoEffectExpanding = true;
                  this.chronoStartTime = performance.now();
                  this.chronoEffectRadius = 0;
                  this.canvas.classList.add('time-stop');
                  document.getElementById('app')?.classList.add('time-stop-active');
                   this.spContainer.classList.add('active');
                   this.spContainer.classList.remove('fade-out');
                  this.canvas.classList.add('jojo-shake');
                  this.soundManager.playSkill();
                  this.soundManager.stopBGM();
                  this.soundManager.playTimeStopSounds();
                  
                  let elapsed = 0;
                  const timerInterval = setInterval(() => {
                      elapsed++;
                      if (this.jojoTimer) {
                          this.jojoTimer.innerText = `經過${elapsed}秒`;
                      }
                      if (elapsed >= 5) clearInterval(timerInterval);
                  }, 1000);
                  if (this.jojoTimer) this.jojoTimer.innerText = `經過0秒`;

                  setTimeout(() => {
                      this.canvas.classList.remove('time-stop');
                      this.canvas.classList.remove('jojo-shake');
                      document.getElementById('app')?.classList.remove('time-stop-active');
                      this.spContainer.classList.add('fade-out');
                      this.chronoEffectShrinking = true;
                      this.chronoShrinkStartTime = performance.now();
                      if (this.jojoTimer) this.jojoTimer.innerText = "";
                      
                      this.soundManager.stopTimeStopSounds();
                      this.soundManager.resumeBGM();

                      setTimeout(() => {
                          this.spContainer.classList.remove('active');
                          this.spContainer.classList.remove('fade-out');
                      }, 500); 
                  }, 5000);
              }
          } else if (this.snake.skin === 'rainbow') {
              this.snake.isInvincible = true;
              const originalSpeed = this.speed;
              this.speed = 30;
              
              setTimeout(() => {
                  this.snake.isInvincible = false;
                  this.speed = originalSpeed;
              }, 5000);
          }

          this.updateEnergyUI();
      }
  }

  private triggerSkillEffect() {
      this.canvas.classList.add('skill-active');
      setTimeout(() => this.canvas.classList.remove('skill-active'), 5000);
      
      const notify = this.milestoneNotify;
    if (notify) {
        const isTimeStop = this.snake.skin === 'pixel' && this.snake.evolutionLevel === 3;
        notify.innerText = isTimeStop ? "TIME STOP ACTIVE!" : "OVERDRIVE ACTIVE!";
        notify.style.color = isTimeStop ? "#ff00ff" : "#0ff";
        notify.style.opacity = '1';
        setTimeout(() => notify.style.opacity = '0', 2000);
    }
  }

  private spawnInitialChips() {
      this.chips = [];
      for (let i = 0; i < 3; i++) {
          this.chips.push(spawnFruit(GRID_SIZE, this.snake.segments));
      }
  }
  private gameLoop() {
    if (!this.paused && !this.isGameOver) {
      this.update();
      this.draw();
    }
    if (this.isGameOver) return; // Exit loop immediately
    const currentSpeed = this.speed / this.snake.timeScale;
    this.gameLoopId = window.setTimeout(() => this.gameLoop(), currentSpeed);
  }

  private vortexLoop() {
      this.drawVortex();
      requestAnimationFrame(() => this.vortexLoop());
  }

  private update() {
    this.fireworks.update();
    this.updateAbilityDashboard();
    
    // Chrono Effect Expansion/Shrink logic
    const EXPAND_DURATION = 500; // 0.5s
    const now = performance.now();
    
    if (this.chronoEffectExpanding) {
        const elapsed = now - this.chronoStartTime;
        const progress = Math.min(1, elapsed / EXPAND_DURATION);
        this.chronoEffectRadius = progress * this.canvas.width * 1.5;
        if (progress >= 1) {
            this.chronoEffectExpanding = false;
        }
    } else if (this.chronoEffectShrinking) {
        const elapsed = now - this.chronoShrinkStartTime;
        const progress = Math.min(1, elapsed / EXPAND_DURATION);
        this.chronoEffectRadius = (1 - progress) * this.canvas.width * 1.5;
        if (progress >= 1) {
            this.chronoEffectRadius = 0;
            this.chronoEffectShrinking = false;
        }
    } else if (this.snake && this.snake.chronoStopActive) {
        this.chronoEffectRadius = this.canvas.width * 1.5;
    }
    
    if (this.aiEnabled) {
      this.runAI();
    }

    this.snake.update();

    const head = this.snake.segments[0];
    
    if (this.snake.skin === 'rainbow' && this.snake.evolutionLevel >= 2) {
        this.snake.rainbowTrails.push({ pos: { ...head }, time: Date.now() });
        this.snake.rainbowTrails.forEach((trail) => {
            if (head.x === trail.pos.x && head.y === trail.pos.y && Date.now() - trail.time > 500) {
                this.snake.addEnergy(1);
                this.updateEnergyUI();
            }
        });
    }

    if (this.snake.skin === 'dragon' && this.snake.evolutionLevel >= 2) {
      this.chips.forEach(chip => {
        const dist = Math.sqrt(Math.pow(head.x - chip.pos.x, 2) + Math.pow(head.y - chip.pos.y, 2));
        if (dist <= this.snake.magnetRadius) {
          chip.pos = { ...head };
        }
      });
    }

    let chipIndex = -1;
    for (let i = 0; i < this.chips.length; i++) {
        if (head.x === this.chips[i].pos.x && head.y === this.chips[i].pos.y) {
            chipIndex = i;
            break;
        }
    }

    const willEat = chipIndex !== -1;

    if (willEat) {
      const eatenChip = this.chips[chipIndex];
      if (eatenChip.isEvo) {
        this.snake.evolve();
        this.soundManager.playEvolve();
        this.isEvoSpawning = false;
        this.triggerEvolutionEffect();
      } else {
        this.soundManager.playEat();
      }

      if (this.snake.skin === 'dragon' && this.snake.evolutionLevel === 3) {
          this.snake.goldChipCounter++;
      }

      let addedScore = eatenChip.score;
      if (this.snake.skin === 'pixel' && this.snake.isSkillActive) {
          addedScore *= 2; // Double score pulse
      }
      this.score += addedScore;
      this.itemsEaten++;
      this.snake.addEnergy(10);
      this.updateScoreUI();
      this.updateEnergyUI();
      
      if (this.score >= this.lastMilestoneScore + 100) {
        this.lastMilestoneScore = Math.floor(this.score / 100) * 100;
        this.triggerMilestone();
      }

      this.chips.splice(chipIndex, 1);
      
      const nextEvoScore = this.snake.evolutionLevel === 1 ? 200 : 400;
      if (this.score >= nextEvoScore && !this.isEvoSpawning && this.snake.evolutionLevel < 3) {
        this.isEvoSpawning = true;
        this.chips.push(spawnFruit(GRID_SIZE, this.snake.segments, true));
      } else {
          if (this.snake.goldChipCounter >= 5) {
              this.snake.goldChipCounter = 0;
              const goldChip = spawnFruit(GRID_SIZE, this.snake.segments);
              goldChip.score = 50;
              goldChip.color = '#ffd700';
              this.chips.push(goldChip);
          } else {
              this.chips.push(spawnFruit(GRID_SIZE, this.snake.segments));
          }
      }

      if (this.itemsEaten % 5 === 0) {
        this.speed = Math.max(50, this.speed * 0.9);
      }
    }

    this.snake.move(GRID_SIZE, willEat);

    if (this.snake.checkCollision() && !this.isGameOver) {
      this.isGameOver = true;
      this.soundManager.playGameOver();
      this.gameOver();
    }
  }

  private runAI() {
    if (this.chips.length === 0) return;
    const head = this.snake.segments[0];
    let nearestChip = this.chips[0];
    let minDist = Infinity;
    
    this.chips.forEach(chip => {
        const d = Math.abs(head.x - chip.pos.x) + Math.abs(head.y - chip.pos.y);
        if (d < minDist) {
            minDist = d;
            nearestChip = chip;
        }
    });

    const move = getNextMove(head, nearestChip.pos, this.snake.segments, GRID_SIZE);
    if (move.x !== 0 || move.y !== 0) {
      this.snake.setDirection(move);
    }
  }

  private triggerMilestone() {
    this.canvas.classList.add('shake');
    setTimeout(() => this.canvas.classList.remove('shake'), 500);
    
    if (this.milestoneNotify) {
        this.milestoneNotify.innerText = `CRITICAL SCORE: ${this.score}`;
        this.milestoneNotify.style.opacity = '1';
        setTimeout(() => this.milestoneNotify.style.opacity = '0', 2000);
    }

    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            this.fireworks.spawn(Math.random() * this.canvas.width, Math.random() * this.canvas.height);
        }, i * 150);
    }
  }

  private triggerEvolutionEffect() {
    this.canvas.classList.add('shake');
    setTimeout(() => this.canvas.classList.remove('shake'), 800);
    
    if (this.milestoneNotify) {
        this.milestoneNotify.innerText = "EVOLUTION COMPLETE!";
        this.milestoneNotify.style.color = "#ff00ff";
        this.milestoneNotify.style.opacity = '1';
        setTimeout(() => {
            this.milestoneNotify.style.opacity = '0';
            this.milestoneNotify.style.color = "var(--secondary)";
        }, 3000);
    }
    
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            this.fireworks.spawn(this.canvas.width/2, this.canvas.height/2);
        }, i * 100);
    }
  }

  private gameOver() {
    if (this.gameLoopId) clearTimeout(this.gameLoopId);
    this.soundManager.stopBGM();
    document.getElementById('overlay')?.classList.remove('hidden');
    document.getElementById('menu')?.classList.add('hidden');
    
    const gameOverEl = document.getElementById('game-over');
    gameOverEl?.classList.remove('hidden');
    
    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) finalScoreEl.innerText = this.score.toString();

    document.getElementById('submit-section')?.classList.remove('hidden');
    this.updateLeaderboardUI();
  }

  private submitScore() {
    const nameInput = document.getElementById('player-name') as HTMLInputElement;
    const name = nameInput.value.trim() || 'AGENT';
    
    const leaderboard = this.getLeaderboard();
    leaderboard.push({ name, score: this.score });
    leaderboard.sort((a, b) => b.score - a.score);
    
    localStorage.setItem('snake_leaderboard', JSON.stringify(leaderboard.slice(0, 5)));
    
    nameInput.value = '';
    document.getElementById('submit-section')?.classList.add('hidden');
    this.updateLeaderboardUI();
  }

  private getLeaderboard(): LeaderboardEntry[] {
    const data = localStorage.getItem('snake_leaderboard');
    return data ? JSON.parse(data) : [];
  }

  private updateLeaderboardUI() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    
    const leaderboard = this.getLeaderboard();
    list.innerHTML = leaderboard.map((entry, i) => `
      <li class="leaderboard-item">
        <span>${i + 1}. ${entry.name}</span>
        <span>${entry.score}</span>
      </li>
    `).join('');
  }

  private draw() {
    const cellSize = this.canvas.width / GRID_SIZE;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * cellSize, 0);
      this.ctx.lineTo(i * cellSize, this.canvas.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * cellSize);
      this.ctx.lineTo(this.canvas.width, i * cellSize);
      this.ctx.stroke();
    }

    if (this.snake.skin === 'rainbow' && this.snake.evolutionLevel >= 2) {
      this.drawRainbowTrails(cellSize);
    }

    this.chips.forEach(chip => {
        this.drawChip(chip.pos.x, chip.pos.y, cellSize, chip.color, chip.isEvo);
    });

    this.drawSnake(cellSize);

    if (this.snake.skin === 'rainbow' && this.snake.evolutionLevel === 3) {
      this.drawClones(cellSize);
    }

    this.fireworks.draw(this.ctx);
    
    if (this.chronoEffectRadius > 0) {
        this.drawChronoCircle();
    }
  }

  private drawChronoCircle() {
      const ctx = this.ctx;
      const size = this.canvas.width;
      
      // Save current canvas state
      ctx.save();
      
      // Create a clipping path for the circle
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, this.chronoEffectRadius, 0, Math.PI * 2);
      ctx.clip();
      
      // We want to apply an inversion effect inside the circle.
      // Since Canvas alone doesn't have a simple "invert" filter that works like this easily 
      // without extra processing, we use 'difference' composition with local background.
      // Alternatively, we can use the main canvas as a source for its own inversion.
      
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.fillRect(0, 0, size, size);
      
      ctx.restore();
  }

  private drawVortex() {
    const ctx = this.vortexCtx;
    const time = Date.now() / 4000;
    const centerX = this.vortexCanvas.width / 2;
    const centerY = this.vortexCanvas.height / 2;
    
    ctx.fillStyle = 'rgba(5, 5, 15, 0.2)';
    ctx.fillRect(0, 0, this.vortexCanvas.width, this.vortexCanvas.height);

    ctx.save();
    ctx.translate(centerX, centerY);
    
    for (let i = 0; i < 400; i++) {
        const spiral = i * 0.04 + time;
        const radius = (i * 5 + (time * 100) % 100) % (this.vortexCanvas.width * 0.7);
        const x = Math.cos(spiral) * radius;
        const y = Math.sin(spiral) * radius;
        
        const size = Math.max(1, (1 - radius / (this.vortexCanvas.width * 0.7)) * 8);
        const alpha = Math.max(0, 0.5 - radius / (this.vortexCanvas.width * 0.7));
        
        ctx.fillStyle = i % 5 === 0 ? `rgba(255, 0, 255, ${alpha})` : `rgba(0, 255, 255, ${alpha})`;
        if (i % 20 === 0) ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        
        ctx.fillRect(Math.floor(x/4)*4, Math.floor(y/4)*4, size, size);
    }
    
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.4, 'rgba(10,0,30,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 500, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawChip(x: number, y: number, cellSize: number, color: string, isEvo: boolean = false) {
    const ctx = this.ctx;
    const padding = 4;
    const cx = x * cellSize + padding;
    const cy = y * cellSize + padding;
    const cw = cellSize - padding * 2;
    const ch = cellSize - padding * 2;

    ctx.save();
    if (isEvo) {
      ctx.translate(x * cellSize + cellSize/2, y * cellSize + cellSize/2);
      ctx.scale(2.5, 2.5);
      const time = Date.now() / 500;
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#0ff';
      ctx.rotate(time);
      ctx.strokeStyle = '#0ff';
      ctx.strokeRect(-cellSize/8, -cellSize/8, cellSize/4, cellSize/4);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, cellSize/12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 2);
      ctx.fill();
      
      const dotSize = 1.5;
      ctx.fillStyle = '#666';
      for (let r = 1; r < 4; r++) {
          for (let c = 1; c < 4; c++) {
              ctx.beginPath();
              ctx.arc(cx + (cw/4)*c, cy + (ch/4)*r, dotSize/2, 0, Math.PI * 2);
              ctx.fill();
          }
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(cx + cw/4, cy + ch/4, cw/2, ch/2);
      
      if (color === '#ffd700') {
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#ffd700';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx, cy, cw, ch);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px "Orbitron"';
          ctx.fillText('50', cx + cw/2 - 5, cy + ch/2 + 3);
      }

      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.8;
      ctx.font = 'bold 3px "Orbitron"';
      ctx.fillText('9000', cx + 2, cy + ch - 2);
    }
    ctx.restore();
  }

  private drawClones(cellSize: number) {
     this.ctx.save();
     this.ctx.globalAlpha = 0.2;
     this.snake.segments.forEach((seg, i) => {
        if (i%2 !== 0) return;
        const offset = 2;
        this.ctx.fillStyle = "#fff";
        this.ctx.beginPath();
        this.ctx.arc(((seg.x + offset) % GRID_SIZE) * cellSize + cellSize/2, ((seg.y + offset) % GRID_SIZE) * cellSize + cellSize/2, cellSize/2 - 4, 0, Math.PI * 2);
        this.ctx.fill();
     });
     this.ctx.restore();
  }

  private drawRainbowTrails(cellSize: number) {
    const now = Date.now();
    this.snake.rainbowTrails.forEach(trail => {
      const age = now - trail.time;
      const alpha = Math.max(0, 1 - age / 3000);
      const hue = (age / 10) % 360;
      this.ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
      this.ctx.fillRect(trail.pos.x * cellSize + 2, trail.pos.y * cellSize + 2, cellSize - 4, cellSize - 4);
    });
  }

  private drawSnake(cellSize: number) {
    const evoSize = this.snake.evolutionLevel * 2;
    const now = Date.now();
    this.snake.segments.forEach((seg, i) => {
      this.ctx.save();
      this.ctx.translate(seg.x * cellSize + cellSize / 2, seg.y * cellSize + cellSize / 2);

      if (this.currentSkin === 'pixel') {
        const isArmorReady = this.snake.armorReady && i === 0;
        this.ctx.shadowBlur = (isArmorReady ? 20 : 10) + evoSize;
        this.ctx.shadowColor = isArmorReady ? '#fff' : '#0ff';
        this.ctx.fillStyle = i === 0 ? (isArmorReady ? '#fff' : '#0ff') : '#008888';
        const s = cellSize - 4 + evoSize;
        this.ctx.fillRect(-s / 2, -s / 2, s, s);
      } else if (this.currentSkin === 'dragon') {
        this.ctx.shadowBlur = 15 + evoSize;
        this.ctx.shadowColor = this.snake.evolutionLevel >= 2 ? '#ffd700' : '#ff00ff';
        const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, cellSize/2 + evoSize);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(1, this.snake.evolutionLevel >= 2 ? '#ffd700' : '#ff00ff');
        this.ctx.fillStyle = grad;
        const r = cellSize/2 - 2 + evoSize/2;
        if (i === 0) {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#0ff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-r, -r);
            this.ctx.lineTo(-r-5, -r-5);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(r, -r);
            this.ctx.lineTo(r+5, -r-5);
            this.ctx.stroke();
        } else {
            this.ctx.beginPath();
            this.ctx.roundRect(-r, -r, r*2, r*2, 4);
            this.ctx.fill();
        }
      } else if (this.currentSkin === 'rainbow') {
        const hue = (i * 20 + now / 10) % 360;
        const color = `hsl(${hue}, 100%, 50%)`;
        this.ctx.shadowBlur = 15 + evoSize;
        this.ctx.shadowColor = this.snake.isInvincible ? '#fff' : color;
        this.ctx.fillStyle = this.snake.isInvincible ? '#fff' : color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, cellSize/2 - 2 + evoSize/2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });
  }

  private updateAbilityDashboard() {
    if (!this.snake) return;

    this.abilityDashboard.classList.remove('hidden');
    
    const skin = this.snake.skin;
    const level = this.snake.evolutionLevel;
    
    const abilities = {
      pixel: [
        { name: 'CORE SYNC | 核心同步', desc: 'System baseline established. | 系統基礎已建立。', usage: 'PASSIVE', level: 1 },
        { name: 'ARMOR | 裝甲', desc: 'Shields from one fatal collision. | 抵擋一次碰撞。', usage: '30S COOLDOWN', level: 2, value: this.snake.armorCooldown / 30000 },
        { name: 'CHRONO SYNC | 時空同步', desc: 'Time Stop (Active) & -20% Speed (Passive). | 時間停止(主動)及速度降低20%(被動)。', usage: this.snake.chronoStopActive ? 'ACTIVE (5S)' : '30S COOLDOWN', level: 3, value: this.snake.chronoStopActive ? 1 : this.snake.lastChronoUse === 0 ? 0 : this.snake.chronoStopReady ? 0 : (Date.now() - this.snake.lastChronoUse) / 30000 }
      ],
      dragon: [
        { name: 'BASE FORCE | 基礎力量', desc: 'Golden standard harvest. | 標準黃金採集。', usage: 'PASSIVE', level: 1 },
        { name: 'MAGNET | 磁力', desc: 'Attracts chips within a radius. | 自動吸引芯片。', usage: 'PASSIVE', level: 2 },
        { name: 'MIDAS TOUCH | 點石成金', desc: 'Collect 5 chips to spawn a Gold Chip. | 每採集 5 個芯片生成金幣。', usage: `${this.snake.goldChipCounter}/5 CHIPS`, level: 3, value: this.snake.goldChipCounter / 5 }
      ],
      rainbow: [
        { name: 'PRISM BASE | 棱鏡基礎', desc: 'Full spectrum connectivity. | 全譜連線。', usage: 'PASSIVE', level: 1 },
        { name: 'TRAIL BLAZE | 霓虹步履', desc: 'Trailing energy harvest. | 採集路徑能量。', usage: 'PASSIVE', level: 2 },
        { name: 'PRISM SPLIT | 棱鏡分裂', desc: 'Multi-stream visual decoys. | 時空幻影分身。', usage: 'PASSIVE', level: 3 }
      ]
    };

    const currentAbilities = (abilities as any)[skin] || [];
    
    let html = '';
    currentAbilities.forEach((ability: any) => {
      const isLocked = level < ability.level;
      const isActive = level === ability.level || (level > ability.level && ability.level > 0);
      
      html += `
        <div class="ability-item ${isLocked ? 'locked' : 'active'}">
          <div class="ability-stage">STAGE ${ability.level} ${isLocked ? '[LOCKED]' : '[ACTIVE]'}</div>
          <div class="ability-name">
            ${ability.name}
            ${isActive && !isLocked ? '<span class="ability-status">ONLINE</span>' : ''}
          </div>
          <div class="ability-desc">${ability.desc}</div>
          <div class="ability-usage">${ability.usage}</div>
          ${ability.value !== undefined ? `
            <div class="ability-progress-container">
              <div class="ability-progress-bar ${ability.value <= 0 ? 'ready' : ''}" style="width: ${Math.min(100, (1 - ability.value) * 100)}%"></div>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    this.abilityList.innerHTML = html;
  }
}

new Game();
