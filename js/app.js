let game, renderer;
let lang = 'zh';
let aiThinking = false;

const I18N = {
  zh: {
    title: '围棋 / 五子棋',
    gomoku: '五子棋',
    go: '围棋',
    newGame: '新对局',
    undo: '回溯',
    redo: '返回',
    restore: '复原',
    pass: 'Pass',
    finish: '结束对局',
    save: '保存对局',
    load: '加载对局',
    blackTurn: '黑棋 行棋',
    whiteTurn: '白棋 行棋',
    gameOver: '对局结束',
    moveN: n => `第 ${n} 手`,
    blackWin: '黑棋 胜',
    whiteWin: '白棋 胜',
    draw: '和棋',
    illegal: '非法落子',
    finishedMsg: '对局已结束',
    cancelled: '已取消',
    confirmSize: '切换棋盘大小会丢失当前对局，确定？',
    confirmNew: '当前对局未保存，确定开始新对局？',
    confirmMode: '切换模式会丢失当前对局，确定？',
    confirmEnd: '确定结束当前对局？',
    confirmSave: '对局结束！是否保存为纪念？',
    saved: (f, p) => `已保存：${f}（${p}）`,
    saveFailed: r => `保存失败：${r}`,
    loaded: '已加载对局',
    noSelection: '未选择文件',
    sizeLabel: n => `${n} 行×${n} 列`,
    aiBattle: 'AI 对战',
    aiAsWhite: '我执黑（AI 执白）',
    aiAsBlack: '我执白（AI 执黑）',
    aiThinking: 'AI 思考中…',
    aiWaiting: '等待 AI',
    aiYourTurn: '轮到你',
    aiSaveBlocked: 'AI 思考中，请稍后保存',
  },
  en: {
    title: 'Go / Gomoku',
    gomoku: 'Gomoku',
    go: 'Go',
    newGame: 'New Game',
    undo: 'Undo',
    redo: 'Redo',
    restore: 'Restore',
    pass: 'Pass',
    finish: 'End Game',
    save: 'Save',
    load: 'Load',
    blackTurn: 'Black to play',
    whiteTurn: 'White to play',
    gameOver: 'Game Over',
    moveN: n => `Move ${n}`,
    blackWin: 'Black wins',
    whiteWin: 'White wins',
    draw: 'Draw',
    illegal: 'Illegal move',
    finishedMsg: 'Game is over',
    cancelled: 'Cancelled',
    confirmSize: 'Changing board size will lose the current game. Continue?',
    confirmNew: 'Current game is not saved. Start a new game?',
    confirmMode: 'Switching mode will lose the current game. Continue?',
    confirmEnd: 'End the current game?',
    confirmSave: 'Game over! Save as a memorial?',
    saved: (f, p) => `Saved: ${f} (${p})`,
    saveFailed: r => `Save failed: ${r}`,
    loaded: 'Game loaded',
    noSelection: 'No file selected',
    sizeLabel: n => `${n} × ${n}`,
    aiBattle: 'Play vs AI',
    aiAsWhite: 'I play Black (AI White)',
    aiAsBlack: 'I play White (AI Black)',
    aiThinking: 'AI thinking…',
    aiWaiting: 'Waiting for AI',
    aiYourTurn: 'Your turn',
    aiSaveBlocked: 'AI is thinking, please wait',
  }
};

function t(key, ...args) {
  const v = I18N[lang][key];
  return typeof v === 'function' ? v(...args) : v;
}

function init() {
  const canvas = document.getElementById('board');
  game = new Game(19, 'gomoku');
  renderer = new Renderer(canvas, game);
  bindEvents();
  updateUI();
}

function bindEvents() {
  const canvas = document.getElementById('board');

  canvas.addEventListener('click', (e) => {
    if (aiThinking) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = renderer.pixelToPos(e.clientX - rect.left, e.clientY - rect.top);
    if (x < 0 || y < 0 || x >= game.size || y >= game.size) return;

    const result = game.place(x, y);
    if (!result.ok) { showMessage(t(result.reason)); return; }

    renderer.draw();
    updateUI();
    if (game.state === 'finished') onGameEnd();
    else maybeTriggerAI();
  });

  document.getElementById('mode-gomoku').onclick = () => switchMode('gomoku');
  document.getElementById('mode-go').onclick = () => switchMode('go');

  document.getElementById('size-select').onchange = (e) => {
    if (aiThinking) { e.target.value = game.size; return; }
    if (game.history.length > 0 && !confirm(t('confirmSize'))) {
      e.target.value = game.size;
      return;
    }
    newGame(game.mode, parseInt(e.target.value));
  };

  document.getElementById('new-game').onclick = () => {
    if (aiThinking) return;
    if (game.history.length > 0 && !confirm(t('confirmNew'))) return;
    newGame(game.mode, game.size);
  };

  // undo：AI 模式下连撤两手，撤完可能轮到 AI
  document.getElementById('undo').onclick = () => {
    if (aiThinking) return;
    const aiOn = document.getElementById('ai-enable').checked && game.mode === 'gomoku';
    const steps = aiOn ? Math.min(2, game.history.length) : 1;
    let any = false;
    for (let i = 0; i < steps; i++) {
      if (game.undo().ok) any = true;
    }
    if (any) {
      renderer.draw();
      updateUI();
      maybeTriggerAI();
    }
  };

  document.getElementById('redo').onclick = () => {
    if (aiThinking) return;
    if (game.redo().ok) {
      renderer.draw();
      updateUI();
      maybeTriggerAI();
    }
  };

  document.getElementById('restore').onclick = () => {
    if (aiThinking) return;
    if (game.restoreAll().ok) {
      renderer.draw();
      updateUI();
      maybeTriggerAI();
    }
  };

  document.getElementById('pass').onclick = () => {
    if (game.mode !== 'go') return;
    if (game.pass().ok) {
      renderer.draw();
      updateUI();
      if (game.state === 'finished') onGameEnd();
    }
  };

  document.getElementById('finish').onclick = () => {
    if (aiThinking) return;
    if (game.state === 'finished') return;
    if (!confirm(t('confirmEnd'))) return;
    game.finish();
    renderer.draw();
    updateUI();
    onGameEnd();
  };

  document.getElementById('save').onclick = async () => {
    if (aiThinking) { showMessage(t('aiSaveBlocked')); return; }
    const type = game.state === 'finished' ? 'archive' : 'continue';
    const r = await Storage.saveGame(game, type);
    if (r.ok) showMessage(t('saved', r.filename, r.path));
    else showMessage(I18N[lang][r.reason] ? t(r.reason) : t('saveFailed', r.reason));
  };

  document.getElementById('load').onclick = async () => {
    if (aiThinking) return;
    const r = await Storage.loadGame();
    if (!r.ok) {
      showMessage(I18N[lang][r.reason] ? t(r.reason) : t('saveFailed', r.reason));
      return;
    }
    aiThinking = false;            // 重置可能残留的状态
    game = Storage.deserialize(r.data);
    renderer.setGame(game);
    updateUI();
    maybeTriggerAI();              // 若加载的局面轮到 AI，则触发
    showMessage(t('loaded'));
  };

  document.getElementById('lang-toggle').onclick = () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    updateUI();
  };

  document.getElementById('ai-enable').onchange = (e) => {
    const on = e.target.checked;
    document.getElementById('ai-color').disabled = !on;
    updateUI();
    if (on) maybeTriggerAI();
  };

  // 切换执黑/执白：只要当前轮到 AI 就触发（不限于空盘）
  document.getElementById('ai-color').onchange = () => {
    updateUI();
    maybeTriggerAI();
  };
}

function maybeTriggerAI() {
  if (!document.getElementById('ai-enable').checked) return;
  if (game.mode !== 'gomoku') return;
  if (game.state === 'finished') return;
  if (aiThinking) return;

  const humanColor = document.getElementById('ai-color').value === 'white' ? BLACK : WHITE;
  if (game.currentColor === humanColor) return;

  aiThinking = true;
  updateUI();

  setTimeout(() => {
    try {
      const move = GomokuAI.findBestMove(game.board, game.currentColor);
      if (move) {
        const r = game.place(move.x, move.y);
        if (r.ok) {
          renderer.draw();
          if (game.state === 'finished') onGameEnd();
        }
      }
    } catch (err) {
      console.error('[AI] findBestMove failed:', err);
    } finally {
      aiThinking = false;
      updateUI();
    }
  }, 60);
}

function switchMode(mode) {
  if (aiThinking) return;
  if (game.history.length > 0 && !confirm(t('confirmMode'))) return;
  newGame(mode, game.size);
}

function newGame(mode, size) {
  aiThinking = false;
  game = new Game(size, mode);
  renderer.setGame(game);
  updateUI();
  maybeTriggerAI();               // 新局若 AI 先手，立即走
}

function updateUI() {
  document.title = t('title');
  document.getElementById('title').textContent = t('title');

  document.getElementById('mode-gomoku').textContent = t('gomoku');
  document.getElementById('mode-go').textContent = t('go');
  document.getElementById('mode-gomoku').classList.toggle('active', game.mode === 'gomoku');
  document.getElementById('mode-go').classList.toggle('active', game.mode === 'go');

  document.getElementById('new-game').textContent = t('newGame');
  document.getElementById('undo').textContent = t('undo');
  document.getElementById('redo').textContent = t('redo');
  document.getElementById('restore').textContent = t('restore');
  document.getElementById('pass').textContent = t('pass');
  document.getElementById('finish').textContent = t('finish');
  document.getElementById('save').textContent = t('save');
  document.getElementById('load').textContent = t('load');
  document.getElementById('lang-toggle').textContent = lang === 'zh' ? 'EN' : '中';

  const sizeSelect = document.getElementById('size-select');
  for (const opt of sizeSelect.options) {
    opt.textContent = t('sizeLabel', opt.value);
  }
  sizeSelect.value = String(game.size);

  const turnEl = document.getElementById('turn');
  if (game.state === 'finished') {
    turnEl.textContent = t('gameOver');
  } else {
    turnEl.textContent = game.currentColor === BLACK ? t('blackTurn') : t('whiteTurn');
  }

  document.getElementById('undo').disabled = !game.canUndo() || aiThinking;
  document.getElementById('redo').disabled = !game.canRedo() || aiThinking;
  document.getElementById('restore').disabled = game.undone.length === 0 || aiThinking;
  document.getElementById('pass').style.display = game.mode === 'go' ? '' : 'none';
  document.getElementById('pass').disabled = game.state === 'finished' || aiThinking;
  document.getElementById('finish').disabled = game.state === 'finished' || aiThinking;

  const statusEl = document.getElementById('status');
  if (game.state === 'finished') {
    if (game.mode === 'go' && game.score) {
      const s = game.score;
      statusEl.textContent = lang === 'zh'
        ? `黑 ${s.blackScore} : 白 ${s.whiteScore}（黑 ${s.blackStones} 子 + ${s.blackTerritory} 地 / 白 ${s.whiteStones} 子 + ${s.whiteTerritory} 地）`
        : `Black ${s.blackScore} : White ${s.whiteScore} (B ${s.blackStones} stones + ${s.blackTerritory} territory / W ${s.whiteStones} stones + ${s.whiteTerritory} territory)`;
    } else if (game.winner === 'draw') {
      statusEl.textContent = t('draw');
    } else if (game.winner) {
      statusEl.textContent = game.winner === BLACK ? t('blackWin') : t('whiteWin');
    } else {
      statusEl.textContent = t('gameOver');
    }
  } else {
    statusEl.textContent = t('moveN', game.history.length + 1);
  }

  // AI 面板显示与状态
  const aiEnable = document.getElementById('ai-enable');
  const aiColorSel = document.getElementById('ai-color');

  document.getElementById('ai-enable-label').textContent = t('aiBattle');
  aiColorSel.options[0].textContent = t('aiAsWhite');
  aiColorSel.options[1].textContent = t('aiAsBlack');

  if (game.mode === 'gomoku') {
    document.querySelector('.ai-panel').style.display = '';
  } else {
    document.querySelector('.ai-panel').style.display = 'none';
    aiEnable.checked = false;
    aiColorSel.disabled = true;
  }

  const humanColor = aiColorSel.value === 'white' ? BLACK : WHITE;
  const status = document.getElementById('ai-status');
  if (aiEnable.checked && game.state !== 'finished' && game.mode === 'gomoku') {
    if (aiThinking) status.textContent = t('aiThinking');
    else if (game.currentColor !== humanColor) status.textContent = t('aiWaiting');
    else status.textContent = t('aiYourTurn');
  } else {
    status.textContent = '';
  }
}

async function onGameEnd() {
  const ok = confirm(t('confirmSave'));
  if (!ok) return;
  const r = await Storage.saveGame(game, 'archive');
  if (r.ok) showMessage(t('saved', r.filename, r.path));
  else showMessage(t('saveFailed', r.reason));
}

function showMessage(msg) {
  const el = document.getElementById('message');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

window.addEventListener('DOMContentLoaded', init);