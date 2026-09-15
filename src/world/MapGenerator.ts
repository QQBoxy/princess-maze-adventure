import { GAME } from '../config/GameConfig';

export type CellKind = 'blocked' | 'path' | 'branch' | 'clearing';
export interface Cell { x: number; y: number; }
export interface GeneratedMap {
  level: number;
  width: number;
  height: number;
  cells: CellKind[][];
  start: Cell;
  goal: Cell;
  mainPath: Cell[];
  branches: Cell[][];
  validation: MapValidation;
}

export interface MapValidation {
  solvable: boolean;
  allWalkableConnected: boolean;
  shortestPath: number;
  requiredPath: number;
  walkableCells: number;
  reachableCells: number;
  attempts: number;
  meetsDifficulty: boolean;
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class MapGenerator {
  generate(requestedLevel = 1): GeneratedMap {
    const level = clamp(Math.round(requestedLevel), 1, GAME.levels.length);
    const config = GAME.levels[level - 1];
    let bestValid: GeneratedMap | null = null;

    for (let attempt = 1; attempt <= GAME.map.maxGenerationAttempts; attempt += 1) {
      const candidate = this.createCandidate(level);
      const validation = this.validate(candidate, config.minPathFactor, attempt);
      candidate.validation = validation;
      if (validation.solvable && validation.allWalkableConnected) {
        if (!bestValid || validation.shortestPath > bestValid.validation.shortestPath) bestValid = candidate;
        if (validation.meetsDifficulty) return candidate;
      }
    }

    // 所有候選都會先挖出保證主路；這個保底只在難度門檻未達時使用。
    if (bestValid) return bestValid;
    throw new Error(`無法生成可解的第 ${level} 關地圖`);
  }

  private createCandidate(level: number): GeneratedMap {
    const config = GAME.levels[level - 1];
    const width = config.size;
    const height = config.size;
    const margin = config.corridorRadius + 2;
    const corner = randomInt(0, 3);
    const start = this.cornerCell(corner, width, height, margin);
    const goal = this.cornerCell(3 - corner, width, height, margin);
    const cells = Array.from({ length: height }, () => Array<CellKind>(width).fill('blocked'));
    const waypoints = this.createWaypoints(start, goal, config.waypoints, config.detour, margin, width, height);
    const mainPath: Cell[] = [{ ...start }];
    for (let index = 1; index < waypoints.length; index += 1) {
      const section = this.manhattanRoute(waypoints[index - 1], waypoints[index]);
      mainPath.push(...section.slice(1));
    }

    this.carveRoute(cells, mainPath, config.corridorRadius, 'path');
    const branches: Cell[][] = [];
    for (let index = 0; index < config.branchCount; index += 1) {
      const spacing = ((index + 1) / (config.branchCount + 1)) * mainPath.length;
      const anchorIndex = clamp(Math.floor(spacing + randomInt(-2, 2)), 0, mainPath.length - 1);
      const anchor = mainPath[anchorIndex];
      const route: Cell[] = [{ ...anchor }];
      const length = randomInt(config.branchMin, config.branchMax);
      const primary = this.branchDirection(anchor, goal, index);
      let branchCursor = { ...anchor };
      for (let step = 0; step < length; step += 1) {
        const direction = Math.random() < 0.68 ? primary : this.turnDirection(primary, Math.random() < 0.5 ? -1 : 1);
        branchCursor = {
          x: clamp(branchCursor.x + direction.x, margin, width - 1 - margin),
          y: clamp(branchCursor.y + direction.y, margin, height - 1 - margin),
        };
        route.push({ ...branchCursor });
      }
      branches.push(route);
      this.carveRoute(cells, route, config.corridorRadius, 'branch');
      this.carveCircle(cells, branchCursor, randomInt(2, 3), 'clearing');

      if (Math.random() < config.loopChance) {
        const returnIndex = clamp(anchorIndex + randomInt(6, 12), 0, mainPath.length - 1);
        this.carveRoute(cells, this.manhattanRoute(branchCursor, mainPath[returnIndex]), config.corridorRadius, 'branch');
      }
    }

    this.carveCircle(cells, start, config.corridorRadius + 1, 'clearing');
    this.carveCircle(cells, goal, config.corridorRadius + 2, 'clearing');
    return {
      level, width, height, cells, start, goal, mainPath, branches,
      validation: {
        solvable: false, allWalkableConnected: false, shortestPath: -1, requiredPath: 0,
        walkableCells: 0, reachableCells: 0, attempts: 0, meetsDifficulty: false,
      },
    };
  }

  private cornerCell(corner: number, width: number, height: number, margin: number): Cell {
    return {
      x: corner % 2 === 0 ? margin : width - 1 - margin,
      y: corner < 2 ? margin : height - 1 - margin,
    };
  }

  private createWaypoints(start: Cell, goal: Cell, count: number, detour: number, margin: number, width: number, height: number): Cell[] {
    const points: Cell[] = [{ ...start }];
    const dx = goal.x - start.x;
    const dy = goal.y - start.y;
    const length = Math.hypot(dx, dy);
    const perpendicular = { x: -dy / length, y: dx / length };
    for (let index = 1; index <= count; index += 1) {
      const t = index / (count + 1);
      const direction = index % 2 === 0 ? -1 : 1;
      const offset = direction * configRandom(detour * width * 0.55, detour * width);
      points.push({
        x: clamp(Math.round(start.x + dx * t + perpendicular.x * offset), margin, width - 1 - margin),
        y: clamp(Math.round(start.y + dy * t + perpendicular.y * offset), margin, height - 1 - margin),
      });
    }
    points.push({ ...goal });
    return points;
  }

  private manhattanRoute(from: Cell, to: Cell): Cell[] {
    const route: Cell[] = [{ ...from }];
    let cursor = { ...from };
    while (cursor.x !== to.x || cursor.y !== to.y) {
      const xDistance = Math.abs(to.x - cursor.x);
      const yDistance = Math.abs(to.y - cursor.y);
      const moveX = yDistance === 0 || (xDistance > 0 && Math.random() < xDistance / (xDistance + yDistance));
      cursor = moveX
        ? { x: cursor.x + Math.sign(to.x - cursor.x), y: cursor.y }
        : { x: cursor.x, y: cursor.y + Math.sign(to.y - cursor.y) };
      route.push(cursor);
    }
    return route;
  }

  private branchDirection(anchor: Cell, goal: Cell, index: number): Cell {
    const awayX = Math.sign(anchor.x - goal.x) || (index % 2 === 0 ? 1 : -1);
    const awayY = Math.sign(anchor.y - goal.y) || (index % 2 === 0 ? -1 : 1);
    return index % 2 === 0 ? { x: 0, y: awayY } : { x: awayX, y: 0 };
  }

  private turnDirection(direction: Cell, turn: number): Cell {
    return turn < 0 ? { x: direction.y, y: -direction.x } : { x: -direction.y, y: direction.x };
  }

  private validate(map: GeneratedMap, minPathFactor: number, attempts: number): MapValidation {
    const total = map.width * map.height;
    const distances = new Int32Array(total);
    distances.fill(-1);
    const queue: Cell[] = [{ ...map.start }];
    const startIndex = map.start.y * map.width + map.start.x;
    distances[startIndex] = 0;
    let head = 0;
    while (head < queue.length) {
      const cell = queue[head++];
      const distance = distances[cell.y * map.width + cell.x];
      const neighbors = [
        { x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y - 1 },
      ];
      for (const next of neighbors) {
        if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
        const nextIndex = next.y * map.width + next.x;
        if (distances[nextIndex] >= 0 || map.cells[next.y][next.x] === 'blocked') continue;
        distances[nextIndex] = distance + 1;
        queue.push(next);
      }
    }

    let walkableCells = 0;
    for (const row of map.cells) for (const kind of row) if (kind !== 'blocked') walkableCells += 1;
    const shortestPath = distances[map.goal.y * map.width + map.goal.x];
    const directDistance = Math.abs(map.goal.x - map.start.x) + Math.abs(map.goal.y - map.start.y);
    const requiredPath = Math.ceil(directDistance * minPathFactor);
    return {
      solvable: shortestPath >= 0,
      allWalkableConnected: queue.length === walkableCells,
      shortestPath,
      requiredPath,
      walkableCells,
      reachableCells: queue.length,
      attempts,
      meetsDifficulty: shortestPath >= requiredPath,
    };
  }

  private carveRoute(grid: CellKind[][], route: Cell[], radius: number, kind: CellKind): void {
    route.forEach((cell) => this.carveCircle(grid, cell, radius, kind));
  }

  private carveCircle(grid: CellKind[][], center: Cell, radius: number, kind: CellKind): void {
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        if (grid[y]?.[x] && Math.hypot(x - center.x, y - center.y) <= radius + 0.35) grid[y][x] = kind;
      }
    }
  }

}

const configRandom = (min: number, max: number) => min + Math.random() * (max - min);
