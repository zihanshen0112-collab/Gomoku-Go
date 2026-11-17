const Go = {
  getGroup(board, x, y) {
    const color = board.get(x, y);
    if (color === EMPTY) return null;
    const visited = new Set();
    const group = [];
    const liberties = new Set();
    const stack = [[x, y]];
    visited.add(board.idx(x, y));

    while (stack.length) {
      const [cx, cy] = stack.pop();
      group.push([cx, cy]);
      for (const [nx, ny] of board.neighbors(cx, cy)) {
        const v = board.get(nx, ny);
        if (v === EMPTY) liberties.add(board.idx(nx, ny));
        else if (v === color && !visited.has(board.idx(nx, ny))) {
          visited.add(board.idx(nx, ny));
          stack.push([nx, ny]);
        }
      }
    }
    return { group, liberties };
  },

  isValidMove(board, x, y, color, koPoint) {
    if (!board.inBounds(x, y) || !board.isEmpty(x, y)) return false;
    if (koPoint && koPoint.x === x && koPoint.y === y) return false;

    const test = board.clone();
    test.set(x, y, color);
    const opponent = color === BLACK ? WHITE : BLACK;
    let capturedCount = 0;

    for (const [nx, ny] of test.neighbors(x, y)) {
      if (test.get(nx, ny) === opponent) {
        const { group, liberties } = this.getGroup(test, nx, ny);
        if (liberties.size === 0) {
          capturedCount += group.length;
          for (const [gx, gy] of group) test.set(gx, gy, EMPTY);
        }
      }
    }

    const self = this.getGroup(test, x, y);
    if (self.liberties.size === 0 && capturedCount === 0) return false;
    return true;
  },

  applyMove(board, x, y, color) {
    board.set(x, y, color);
    const opponent = color === BLACK ? WHITE : BLACK;
    const captured = [];

    for (const [nx, ny] of board.neighbors(x, y)) {
      if (board.get(nx, ny) === opponent) {
        const { group, liberties } = this.getGroup(board, nx, ny);
        if (liberties.size === 0) {
          for (const [gx, gy] of group) {
            board.set(gx, gy, EMPTY);
            captured.push([gx, gy]);
          }
        }
      }
    }

    let koPoint = null;
    if (captured.length === 1) {
      const self = this.getGroup(board, x, y);
      if (self.liberties.size === 1) {
        koPoint = { x: captured[0][0], y: captured[0][1] };
      }
    }
    return { captured, koPoint };
  },

  undoMove(board, move) {
    board.set(move.x, move.y, EMPTY);
    const stoneColor = move.color === BLACK ? WHITE : BLACK;
    for (const [cx, cy] of move.captured) {
      board.set(cx, cy, stoneColor);
    }
  },

  // 中国规则简化数子：棋子数 + 只被单色包围的空点
  countScore(board) {
    const size = board.size;
    let blackStones = 0, whiteStones = 0;
    let blackTerritory = 0, whiteTerritory = 0;
    const visited = new Set();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = board.get(x, y);
        if (v === BLACK) { blackStones++; continue; }
        if (v === WHITE) { whiteStones++; continue; }
        if (visited.has(board.idx(x, y))) continue;

        const region = [];
        const borders = new Set();
        const stack = [[x, y]];
        visited.add(board.idx(x, y));

        while (stack.length) {
          const [cx, cy] = stack.pop();
          region.push([cx, cy]);
          for (const [nx, ny] of board.neighbors(cx, cy)) {
            const nv = board.get(nx, ny);
            if (nv === EMPTY) {
              if (!visited.has(board.idx(nx, ny))) {
                visited.add(board.idx(nx, ny));
                stack.push([nx, ny]);
              }
            } else {
              borders.add(nv);
            }
          }
        }

        if (borders.size === 1 && borders.has(BLACK)) blackTerritory += region.length;
        else if (borders.size === 1 && borders.has(WHITE)) whiteTerritory += region.length;
      }
    }

    return {
      blackStones, whiteStones,
      blackTerritory, whiteTerritory,
      blackScore: blackStones + blackTerritory,
      whiteScore: whiteStones + whiteTerritory
    };
  }
};