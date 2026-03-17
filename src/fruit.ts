import type { Point } from './snake';

export interface Fruit {
  pos: Point;
  score: number;
  type: string;
  color: string;
  isEvo?: boolean;
}

export function spawnFruit(gridSize: number, snake: Point[], isEvo: boolean = false): Fruit {
  const colors = ['#00ffff', '#ff00ff', '#00ff00', '#ffaa00', '#ffff00'];
  let pos: Point;
  while (true) {
    pos = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize)
    };
    if (!snake.some(s => s.x === pos.x && s.y === pos.y)) break;
  }
  return {
    pos,
    score: isEvo ? 50 : 10,
    type: isEvo ? 'evo' : 'normal',
    color: colors[Math.floor(Math.random() * colors.length)],
    isEvo
  };
}
