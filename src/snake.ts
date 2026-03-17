export type Point = { x: number; y: number };
export type SkinType = 'pixel' | 'dragon' | 'rainbow';

export interface Fruit {
  pos: Point;
  score: number;
  type: string;
}

export class SnakeBody {
  segments: Point[];
  direction: Point;
  nextDirection: Point;
  skin: SkinType;
  evolutionLevel: number = 1; // 1 to 3
  isInvincible: boolean = false;
  magnetRadius: number = 0;
  hasClones: boolean = false;
  energy: number = 0;
  maxEnergy: number = 100;
  isSkillActive: boolean = false;
  skillTimeout: number | null = null;

  // New Ability Properties
  armorReady: boolean = false;
  lastArmorUse: number = 0;
  armorCooldown: number = 30000; // 30s
  goldChipCounter: number = 0;
  rainbowTrails: { pos: Point; time: number }[] = [];
  timeScale: number = 1.0;
  
  // Chrono Sync Stage 3
  chronoStopReady: boolean = true;
  chronoStopActive: boolean = false;
  lastChronoUse: number = 0;
  chronoCooldown: number = 30000;
  chronoDuration: number = 5000;

  constructor(gridSize: number, skin: SkinType) {
    const center = Math.floor(gridSize / 2);
    this.segments = [
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center }
    ];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.skin = skin;
  }

  setDirection(dir: Point) {
    // Prevent 180 degree turns
    if (dir.x !== -this.direction.x || dir.y !== -this.direction.y) {
      this.nextDirection = dir;
    }
  }

  move(gridSize: number, grow: boolean) {
    this.direction = this.nextDirection;
    const head = this.segments[0];
    const newHead = {
      x: (head.x + this.direction.x + gridSize) % gridSize,
      y: (head.y + this.direction.y + gridSize) % gridSize
    };

    this.segments.unshift(newHead);
    if (!grow) {
      this.segments.pop();
    }
  }

  checkCollision(): boolean {
    const head = this.segments[0];
    
    for (let i = 1; i < this.segments.length; i++) {
      if (head.x === this.segments[i].x && head.y === this.segments[i].y) {
        // Pixel Stage 2 Armor Ability
        if (this.skin === 'pixel' && this.evolutionLevel >= 2 && this.armorReady) {
            this.armorReady = false;
            this.lastArmorUse = Date.now();
            return false; // Survive one collision
        }
        return true;
      }
    }
    return false;
  }

  update() {
      const now = Date.now();
      // Armor Cooldown logic
      if (this.skin === 'pixel' && this.evolutionLevel >= 2 && !this.armorReady) {
          if (now - this.lastArmorUse >= this.armorCooldown) {
              this.armorReady = true;
          }
      }

      // Cleanup Rainbow Trails
      if (this.skin === 'rainbow' && this.evolutionLevel >= 2) {
          this.rainbowTrails = this.rainbowTrails.filter(t => now - t.time < 3000);
      }

      // Chrono Sync (Time Stop) Cooldown
      if (this.skin === 'pixel' && this.evolutionLevel === 3 && !this.chronoStopActive && !this.chronoStopReady) {
          if (now - this.lastChronoUse >= this.chronoCooldown) {
              this.chronoStopReady = true;
          }
      }
  }

  evolve() {
    if (this.evolutionLevel < 3) {
        this.evolutionLevel++;
        this.updateAbilities();
    }
  }

  addEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  useSkill(): boolean {
    // Stage 3 Pixel Skin overrides Overdrive with Time Stop
    if (this.skin === 'pixel' && this.evolutionLevel === 3) {
        if (!this.chronoStopReady || this.chronoStopActive) return false;
        
        this.chronoStopReady = false;
        this.chronoStopActive = true;
        this.lastChronoUse = Date.now();
        this.timeScale = 0.1; // Slow to 10%
        
        setTimeout(() => {
            this.chronoStopActive = false;
            this.timeScale = 0.8; // Return to passive reduction
        }, this.chronoDuration);
        
        return true;
    }

    if (this.energy < 50 || this.isSkillActive) return false;
    
    this.energy -= 50;
    this.isSkillActive = true;
    
    if (this.skillTimeout) clearTimeout(this.skillTimeout);
    
    const duration = 5000; // 5 seconds
    this.skillTimeout = window.setTimeout(() => {
        this.isSkillActive = false;
    }, duration);
    
    return true;
  }

  private updateAbilities() {
    if (this.skin === 'pixel') {
        if (this.evolutionLevel >= 2) this.armorReady = true;
        if (this.evolutionLevel === 3) this.timeScale = 0.8;
    }
    if (this.skin === 'dragon' && this.evolutionLevel >= 2) {
        this.magnetRadius = this.evolutionLevel === 2 ? 3 : 5;
    }
    if (this.skin === 'rainbow' && this.evolutionLevel === 3) {
        this.hasClones = true;
    }
  }
}
