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
  canUndo() { return this.history.length > 0; }
  canRedo() { return this.undone.length > 0; }

  place(x, y) {
    if (this.state !== 'playing') return { ok: false, reason: '对局已结束' };
    if (!this.rules.isValidMove(this.board, x, y, this.currentColor, this.koPoint)) {
      return { ok: false, reason: '非法落子' };
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
    this.undone = [];
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

  // 回溯：撤回最后两手（黑白各一手）
  undo() {
    if (this.history.length === 0) return { ok: false };
    const count = Math.min(2, this.history.length);
    for (let i = 0; i < count; i++) {
      const move = this.history.pop();
      this.undone.push(move);
      this._revertMove(move);
    }
    this.currentColor = this.history.length % 2 === 0 ? BLACK : WHITE;
    this._recomputeKo();
    this.state = 'playing';
    this.winner = null;
    this.finishedReason = null;
    this.score = null;
    this.consecutivePasses = 0;
    return { ok: true };
  }

  // 返回：恢复被回溯的着法
  redo() {
    if (this.undone.length === 0) return { ok: false };
    const count = Math.min(2, this.undone.length);
    for (let i = 0; i < count; i++) {
      const move = this.undone.pop();
      this._applyMoveAgain(move);
    }
    this.currentColor = this.history.length % 2 === 0 ? BLACK : WHITE;
    this._recomputeKo();
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