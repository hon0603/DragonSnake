import type { Point } from './snake';

export function getNextMove(head: Point, fruit: Point, segments: Point[], gridSize: number): Point {
  const isSafe = (p: Point) => {
    return !segments.some(s => s.x === p.x && s.y === p.y);
  };

  const getNeighbors = (p: Point): Point[] => {
    return [
      { x: (p.x + 1) % gridSize, y: p.y },
      { x: (p.x - 1 + gridSize) % gridSize, y: p.y },
      { x: p.x, y: (p.y + 1) % gridSize },
      { x: p.x, y: (p.y - 1 + gridSize) % gridSize }
    ];
  };

  // 1. BFS for shortest path to fruit
  const findPathTo = (start: Point, target: Point): Point | null => {
    const queue: { pos: Point; firstMove: Point }[] = [];
    const visited = new Set<string>();
    
    getNeighbors(start).forEach(n => {
      if (isSafe(n)) {
        queue.push({ pos: n, firstMove: n });
        visited.add(`${n.x},${n.y}`);
      }
    });

    while (queue.length > 0) {
      const { pos, firstMove } = queue.shift()!;
      if (pos.x === target.x && pos.y === target.y) return firstMove;

      for (const next of getNeighbors(pos)) {
        const key = `${next.x},${next.y}`;
        if (!visited.has(key) && isSafe(next)) {
          visited.add(key);
          queue.push({ pos: next, firstMove });
        }
      }
    }
    return null;
  };

  // 2. Flood Fill to check region size (safety)
  const getReachableCount = (start: Point): number => {
    const queue = [start];
    const visited = new Set<string>([`${start.x},${start.y}`]);
    let count = 0;

    while (queue.length > 0) {
      const pos = queue.shift()!;
      count++;
      if (count > segments.length + 50) break; // Optimization: If we can fit the snake, it's probably safe enough

      for (const next of getNeighbors(pos)) {
        const key = `${next.x},${next.y}`;
        if (!visited.has(key) && isSafe(next)) {
          visited.add(key);
          queue.push(next);
        }
      }
    }
    return count;
  };

  // Attempt to find path to food
  const pathToFoodHead = findPathTo(head, fruit);
  if (pathToFoodHead) {
    // Safety check: is the path leading to a trapped area?
    const space = getReachableCount(pathToFoodHead);
    if (space >= segments.length) {
      return { x: (pathToFoodHead.x - head.x + gridSize + 1) % gridSize - 1, y: (pathToFoodHead.y - head.y + gridSize + 1) % gridSize - 1 };
    }
  }

  // Fallback: Follow tail
  const tail = segments[segments.length - 1];
  const pathToTail = findPathTo(head, tail);
  if (pathToTail) {
    return { x: (pathToTail.x - head.x + gridSize + 1) % gridSize - 1, y: (pathToTail.y - head.y + gridSize + 1) % gridSize - 1 };
  }

  // Emergency: Most open safe move
  const possibleMoves = [
    { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
  ];
  
  const moveResults = possibleMoves.map(m => {
    const next = { x: (head.x + m.x + gridSize) % gridSize, y: (head.y + m.y + gridSize) % gridSize };
    return { move: m, score: isSafe(next) ? getReachableCount(next) : -1 };
  });

  moveResults.sort((a, b) => b.score - a.score);
  return moveResults[0].score > 0 ? moveResults[0].move : { x: 0, y: 0 };
}
