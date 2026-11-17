const GomokuAI = {
  // 给在 (x,y) 落 color 打分：进攻 + 0.9 * 防守
  evaluateCell(board, x, y, color) {
    if (!board.isEmpty(x, y)) return -Infinity;
    const opponent = color === BLACK ? WHITE : BLACK;
    return this.scoreLine(board, x, y, color) + 0.9 * this.scoreLine(board, x, y, opponent);
  },

  scoreLine(board, x, y, color) {
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    let total = 0;
    for (const [dx, dy] of dirs) {
      let count = 1;
      let openEnds = 0;

      for (const sign of [1, -1]) {
        let nx = x + dx * sign, ny = y + dy * sign;
        let steps = 0;
        while (steps < 4 && board.inBounds(nx, ny)) {
          const v = board.get(nx, ny);
          if (v === color) { count++; steps++; nx += dx * sign; ny += dy * sign; }
          else if (v === EMPTY) { openEnds++; break; }
          else break;
        }
      }

      let s = 0;
      if (count >= 5) s = 1_000_000;
      else if (count === 4) s = openEnds === 2 ? 100_000 : openEnds === 1 ? 10_000 : 0;
      else if (count === 3) s = openEnds === 2 ? 10_000 : openEnds === 1 ? 1_000 : 0;
      else if (count === 2) s = openEnds === 2 ? 1_000 : openEnds === 1 ? 100 : 0;
      else if (count === 1) s = openEnds === 2 ? 10 : openEnds === 1 ? 1 : 0;
      total += s;
    }
    return total;
  },

  findBestMove(board, color) {
    const size = board.size;
    let anyStone = false;
    for (let y = 0; y < size && !anyStone; y++)
      for (let x = 0; x < size; x++)
        if (board.get(x, y) !== EMPTY) { anyStone = true; break; }

    // 空盘：下中心
    if (!anyStone) {
      const c = Math.floor(size / 2);
      return { x: c, y: c };
    }

    // 候选点：已有棋子两格邻域内的空点
    const candidates = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!board.isEmpty(x, y)) continue;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) {
          for (let dx = -2; dx <= 2 && !near; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (board.inBounds(nx, ny) && !board.isEmpty(nx, ny)) near = true;
          }
        }
        if (near) candidates.push({ x, y });
      }
    }

    // 随机打乱，避免同分时总是同一选择
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    let best = null, bestScore = -Infinity;
    for (const { x, y } of candidates) {
      const s = this.evaluateCell(board, x, y, color);
      if (s > bestScore) { bestScore = s; best = { x, y }; }
    }
    return best;
  }
};