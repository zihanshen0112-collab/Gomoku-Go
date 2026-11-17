const EMPTY = 0, BLACK = 1, WHITE = 2;

class Board {
  constructor(size) {
    this.size = size;
    this.grid = new Int8Array(size * size);
  }
  idx(x, y) { return y * this.size + x; }
  get(x, y) { return this.grid[this.idx(x, y)]; }
  set(x, y, v) { this.grid[this.idx(x, y)] = v; }
  isEmpty(x, y) { return this.get(x, y) === EMPTY; }
  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }
  clone() {
    const b = new Board(this.size);
    b.grid = this.grid.slice();
    return b;
  }
  neighbors(x, y) {
    const r = [];
    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nx = x + dx, ny = y + dy;
      if (this.inBounds(nx, ny)) r.push([nx, ny]);
    }
    return r;
  }
}