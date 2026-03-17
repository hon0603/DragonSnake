export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.life = 1.0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1; // Gravity
    this.life -= 0.02;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    
    // Pixel Ion Style: Square particles
    const size = 4 + Math.random() * 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillRect(this.x - size / 2, this.y - size / 2, size, size);
    
    // Add a tiny random glitch/pixel offset
    if (Math.random() > 0.8) {
        ctx.fillRect(this.x - size, this.y - size, size/2, size/2);
    }
    
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }
}

export class FireworkManager {
  particles: Particle[] = [];

  spawn(x: number, y: number) {
    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ffffff', '#ff3300'];
    for (let i = 0; i < 80; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.particles.push(new Particle(x, y, color));
    }
  }

  update() {
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => p.update());
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.particles.forEach(p => p.draw(ctx));
  }
}
