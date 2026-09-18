import type { Cell, GeneratedMap } from './MapGenerator';

export type QuestKind = 'none' | 'rabbit' | 'key' | 'garden' | 'leaf' | 'fairy';
export type QuestLocations = Partial<Record<'rabbit' | 'key' | 'flowerA' | 'flowerB' | 'tree' | 'fairy' | 'bag', Cell>>;

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const gap = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.y - b.y);

export function distancesFrom(map: GeneratedMap, origin: Cell): Int32Array {
  const distances = new Int32Array(map.width * map.height).fill(-1);
  const queue: Cell[] = [origin];
  distances[origin.y * map.width + origin.x] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    const next = [
      { x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y - 1 },
    ];
    for (const neighbor of next) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= map.width || neighbor.y >= map.height) continue;
      const index = neighbor.y * map.width + neighbor.x;
      if (distances[index] >= 0 || map.cells[neighbor.y][neighbor.x] === 'blocked') continue;
      distances[index] = distances[cell.y * map.width + cell.x] + 1;
      queue.push(neighbor);
    }
  }
  return distances;
}

export function placeQuest(map: GeneratedMap, quest: QuestKind): QuestLocations {
  if (quest === 'none') return {};
  const fromStart = distancesFrom(map, map.start);
  const fromGoal = distancesFrom(map, map.goal);
  const at = (distances: Int32Array, cell: Cell) => distances[cell.y * map.width + cell.x];
  const route = Math.max(1, at(fromStart, map.goal));
  const cells: Cell[] = [];
  const itemCells: Cell[] = [];
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      const kind = map.cells[y][x];
      if ((kind !== 'clearing' && kind !== 'branch') || fromStart[y * map.width + x] < 0) continue;
      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      if (neighbors.every(([nx, ny]) => map.cells[ny][nx] !== 'blocked')) {
        const cell = { x, y };
        if (kind === 'clearing') cells.push(cell);
        itemCells.push(cell);
      }
    }
  }
  if (cells.length < 1 || itemCells.length < 2) throw new Error(`第 ${map.level} 關沒有足夠的任務空地`);
  const branchCells = itemCells.map((cell) => {
    const nearest = map.branches.reduce((best, branch, index) => {
      const distance = Math.min(...branch.map((point) => gap(cell, point)));
      return distance < best.distance ? { index, distance } : best;
    }, { index: -1, distance: Infinity });
    const mainDistance = Math.min(...map.mainPath.map((point) => gap(cell, point)));
    return { cell, branch: nearest.index, branchDistance: nearest.distance, mainDistance };
  }).filter((candidate) => candidate.branchDistance <= 2.5 && candidate.mainDistance >= 3 &&
    at(fromStart, candidate.cell) >= Math.max(8, route * 0.2) &&
    at(fromGoal, candidate.cell) >= Math.max(8, route * 0.2));
  const used: Cell[] = [map.start, map.goal];
  const pick = (score: (cell: Cell, mainDistance: number) => number, avoidBranch = -1): Cell => {
    const choices = branchCells.filter(({ cell, branch }) => branch !== avoidBranch && !used.some((item) => same(item, cell)));
    if (choices.length === 0) throw new Error(`第 ${map.level} 關無法放置任務物件`);
    const chosen = choices.reduce((best, candidate) => score(candidate.cell, candidate.mainDistance) > score(best.cell, best.mainDistance) ? candidate : best);
    used.push(chosen.cell);
    return chosen.cell;
  };
  const central = (cell: Cell, mainDistance: number) => Math.min(at(fromStart, cell), at(fromGoal, cell)) + mainDistance * 1.5;
  if (quest === 'rabbit') {
    return { rabbit: pick((cell, offPath) => central(cell, offPath) - Math.abs(at(fromStart, cell) - route * 0.45) * 0.3) };
  }
  if (quest === 'key') {
    return { key: pick((cell, offPath) => central(cell, offPath) + at(fromStart, cell) * 0.08) };
  }
  if (quest === 'garden') {
    const flowerA = pick(central);
    const fromFlower = distancesFrom(map, flowerA);
    const firstBranch = branchCells.find((candidate) => same(candidate.cell, flowerA))?.branch ?? -1;
    const flowerB = pick((cell, offPath) => central(cell, offPath) * 0.6 + at(fromFlower, cell) * 0.5, firstBranch);
    return { flowerA, flowerB };
  }
  if (quest === 'leaf') {
    return { tree: pick((cell, offPath) => central(cell, offPath) + at(fromStart, cell) * 0.1) };
  }
  const fairyChoices = cells.filter((cell) => at(fromStart, cell) > 5 && at(fromGoal, cell) > 5);
  if (fairyChoices.length === 0) throw new Error('無法放置小精靈');
  const fairy = fairyChoices.reduce((best, cell) =>
    Math.abs(at(fromStart, cell) - route * 0.25) < Math.abs(at(fromStart, best) - route * 0.25) ? cell : best);
  used.push(fairy);
  const fromFairy = distancesFrom(map, fairy);
  const bag = pick((cell, offPath) => central(cell, offPath) * 0.7 + at(fromFairy, cell) * 0.45);
  return { fairy, bag };
}
