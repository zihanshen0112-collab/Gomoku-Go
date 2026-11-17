const Gomoku = {
  isValidMove(board, x, y) {
    return board.inBounds(x, y) && board.isEmpty(x, y);
  },
  applyMove(board, x, y, color) {
    board.set(x, y, color);
    return { captured: [], koPoint: null };
  },
  undoMove(board, move) {
    board.set(move.x, move.y, EMPTY);
  },
  checkWin(board, x, y, color) {
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for (const [dx, dy] of dirs) {
      let count = 1;
      for (const sign of [1, -1]) {
        let nx = x + dx * sign, ny = y + dy * sign;
        while (board.inBounds(nx, ny) && board.get(nx, ny) === color) {
          count++;
          nx += dx * sign; ny += dy * sign;
        }
      }
      if (count >= 5) return true;
    }
    return false;
  }
};