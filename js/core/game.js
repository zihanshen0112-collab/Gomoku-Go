class Game {
  constructor(size, mode) {
    this.size = size;
    this.mode = mode; // 'gomoku' | 'go'
    this.board = new Board(size);
    this.history = [];
    this.undone = [];
    this.currentColor = BLACK;
    this.state = 'playing';
    this.winner = null;
    this.koPoint = null;
    this.consecutivePasses = 0;
    this.finishedReason = null;
    this.score = null;
  }

  get rules() { return this.mode === 'gomoku' ? Gomoku : Go; }
  canUndo() { return this.history.length > 0; } // 只要场上有子
  canRedo() { return this.undone.length > 0; }  // 返回次数 = 回溯次数

  place(x, y) {
    if (this.state !== 'playing') return { ok: false, reason: 'finishedMsg' };
    if (!this.rules.isValidMove(this.board, x, y, this.currentColor, this.koPoint)) {
      return { ok: false, reason: 'illegal' };
    }

    const color = this.currentColor;
    const result = this.rules.applyMove(this.board, x, y, color, this.koPoint);
    const move = {
      type: 'place',
      x, y, color,
      captured: result.captured || [],
      koPoint: result.koPoint || null
    };
    this.history.push(move);

    // 回溯后落子：只有位置不同才清空重做栈
    if (this.undone.length > 0) {
      const firstRedo = this.undone[this.undone.length - 1];
      const samePlace =
        firstRedo.type === 'place' &&
        firstRedo.x === x &&
        firstRedo.y === y &&
        firstRedo.color === color;
      if (samePlace) {
        // 落回原位：重做栈中这一手出栈，其余保留
        this.undone.pop();
      } else {
        // 落在不同位置：禁止返回
        this.undone = [];
      }
    }

    this.koPoint = result.koPoint || null;
    this.consecutivePasses = 0;

    if (this.mode === 'gomoku' && Gomoku.checkWin(this.board, x, y, color)) {
      this.state = 'finished';
      this.winner = color;
      this.finishedReason = '五连';
    }

    this.currentColor = color === BLACK ? WHITE : BLACK;
    return { ok: true, move };
  }

  pass() {
    if (this.mode !== 'go' || this.state !== 'playing') return { ok: false };
    const color = this.currentColor;
    const move = { type: 'pass', color };
    this.history.push(move);
    this.undone = [];
    this.koPoint = null;
    this.consecutivePasses++;
    this.currentColor = color === BLACK ? WHITE : BLACK;

    if (this.consecutivePasses >= 2) this.finish();
    return { ok: true };
  }

  finish() {
    if (this.state === 'finished') return;
    this.state = 'finished';
    if (this.mode === 'go') {
      this.score = Go.countScore(this.board);
      if (this.score.blackScore > this.score.whiteScore) this.winner = BLACK;
      else if (this.score.whiteScore > this.score.blackScore) this.winner = WHITE;
      else this.winner = 'draw';
      this.finishedReason = '数子';
    }
  }

  // 回溯：每次只撤销一手（黑或白）
  undo() {
    if (this.history.length === 0) return { ok: false };
    const move = this.history.pop();
    this.undone.push(move);
    this._revertMove(move);
    this.currentColor = this.history.length % 2 === 0 ? BLACK : WHITE;
    this._recomputeKo();
    this.state = 'playing';
    this.winner = null;
    this.finishedReason = null;
    this.score = null;
    this.consecutivePasses = this._countConsecutivePasses();
    return { ok: true };
  }

  // 返回：每次只恢复一手
  redo() {
    if (this.undone.length === 0) return { ok: false };
    const move = this.undone.pop();
    this._applyMoveAgain(move);
    this.history.push(move);
    this.currentColor = this.history.length % 2 === 0 ? BLACK : WHITE;
    this._recomputeKo();
    this.consecutivePasses = this._countConsecutivePasses();
    this._checkFinishedAfterRedo();
    return { ok: true };
  }

  // 复原：一次性把当前所有被回溯的着手全部恢复
  restoreAll() {
    if (this.undone.length === 0) return { ok: false };
    while (this.undone.length > 0) {
      const move = this.undone.pop();
      this._applyMoveAgain(move);
      this.history.push(move);
    }
    this.currentColor = this.history.length % 2 === 0 ? BLACK : WHITE;
    this._recomputeKo();
    this.consecutivePasses = this._countConsecutivePasses();
    this._checkFinishedAfterRedo();
    return { ok: true };
  }

  _revertMove(move) {
    if (move.type === 'pass') return;
    if (this.mode === 'gomoku') Gomoku.undoMove(this.board, move);
    else Go.undoMove(this.board, move);
  }

  _applyMoveAgain(move) {
    if (move.type === 'pass') return;
    this.board.set(move.x, move.y, move.color);
    const stoneColor = move.color === BLACK ? WHITE : BLACK;
    for (const [cx, cy] of move.captured) {
      this.board.set(cx, cy, stoneColor);
    }
  }

  _countConsecutivePasses() {
    let count = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'pass') count++;
      else break;
    }
    return count;
  }

  _recomputeKo() {
    if (this.history.length === 0) { this.koPoint = null; return; }
    const last = this.history[this.history.length - 1];
    this.koPoint = last.type === 'pass' ? null : (last.koPoint || null);
  }

  _checkFinishedAfterRedo() {
    if (this.mode === 'gomoku' && this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      if (last.type === 'place' && Gomoku.checkWin(this.board, last.x, last.y, last.color)) {
        this.state = 'finished';
        this.winner = last.color;
        this.finishedReason = '五连';
        return;
      }
    }
    if (this.mode === 'go') {
      const n = this.history.length;
      if (n >= 2 && this.history[n-1].type === 'pass' && this.history[n-2].type === 'pass') {
        this.finish();
      }
    }
  }
}