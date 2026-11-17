let game, renderer;

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
    const rect = canvas.getBoundingClientRect();
    const { x, y } = renderer.pixelToPos(e.clientX - rect.left, e.clientY - rect.top);
    if (x < 0 || y < 0 || x >= game.size || y >= game.size) return;

    const result = game.place(x, y);
    if (!result.ok) { showMessage(result.reason); return; }

    renderer.draw();
    updateUI();
    if (game.state === 'finished') onGameEnd();
  });

  document.getElementById('mode-gomoku').onclick = () => switchMode('gomoku');
  document.getElementById('mode-go').onclick = () => switchMode('go');

  document.getElementById('size-select').onchange = (e) => {
    if (game.history.length > 0 && !confirm('切换棋盘大小会丢失当前对局，确定？')) {
      e.target.value = game.size;
      return;
    }
    newGame(game.mode, parseInt(e.target.value));
  };

  document.getElementById('new-game').onclick = () => {
    if (game.history.length > 0 && !confirm('当前对局未保存，确定开始新对局？')) return;
    newGame(game.mode, game.size);
  };

  document.getElementById('undo').onclick = () => {
    if (game.undo().ok) { renderer.draw(); updateUI(); }
  };

  document.getElementById('redo').onclick = () => {
    if (game.redo().ok) { renderer.draw(); updateUI(); }
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
    if (game.state === 'finished') return;
    if (!confirm('确定结束当前对局？')) return;
    game.finish();
    renderer.draw();
    updateUI();
    onGameEnd();
  };

  document.getElementById('save').onclick = async () => {
    const type = game.state === 'finished' ? 'archive' : 'continue';
    const r = await Storage.saveGame(game, type);
    if (r.ok) showMessage(`已保存：${r.filename}（${r.path}）`);
    else showMessage(`保存失败：${r.reason}`);
  };

  document.getElementById('load').onclick = async () => {
    const r = await Storage.loadGame();
    if (!r.ok) { showMessage(r.reason); return; }
    game = Storage.deserialize(r.data);
    renderer.setGame(game);
    updateUI();
    showMessage('已加载对局');
  };
}

function switchMode(mode) {
  if (game.history.length > 0 && !confirm('切换模式会丢失当前对局，确定？')) return;
  newGame(mode, game.size);
}

function newGame(mode, size) {
  game = new Game(size, mode);
  renderer.setGame(game);
  updateUI();
}

function updateUI() {
  document.getElementById('mode-gomoku').classList.toggle('active', game.mode === 'gomoku');
  document.getElementById('mode-go').classList.toggle('active', game.mode === 'go');
  document.getElementById('size-select').value = game.size;

  const turnEl = document.getElementById('turn');
  if (game.state === 'finished') {
    turnEl.textContent = '对局结束';
  } else {
    turnEl.textContent = (game.currentColor === BLACK ? '黑棋' : '白棋') + ' 行棋';
  }

  document.getElementById('undo').disabled = !game.canUndo();
  document.getElementById('redo').disabled = !game.canRedo();
  document.getElementById('pass').style.display = game.mode === 'go' ? '' : 'none';
  document.getElementById('pass').disabled = game.state === 'finished';
  document.getElementById('finish').disabled = game.state === 'finished';

  const statusEl = document.getElementById('status');
  if (game.state === 'finished') {
    if (game.mode === 'go' && game.score) {
      const s = game.score;
      statusEl.textContent =
        `黑 ${s.blackScore} : 白 ${s.whiteScore} ` +
        `（黑 ${s.blackStones} 子 + ${s.blackTerritory} 地 / ` +
        `白 ${s.whiteStones} 子 + ${s.whiteTerritory} 地）`;
    } else if (game.winner === 'draw') {
      statusEl.textContent = '和棋';
    } else if (game.winner) {
      statusEl.textContent = (game.winner === BLACK ? '黑棋' : '白棋') + ' 胜';
    } else {
      statusEl.textContent = '对局已结束';
    }
  } else {
    statusEl.textContent = `第 ${game.history.length + 1} 手`;
  }
}

async function onGameEnd() {
  const ok = confirm('对局结束！是否保存为纪念？');
  if (!ok) return;
  const r = await Storage.saveGame(game, 'archive');
  if (r.ok) showMessage(`已保存：${r.filename}（${r.path}）`);
  else showMessage(`保存失败：${r.reason}`);
}

function showMessage(msg) {
  const el = document.getElementById('message');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

window.addEventListener('DOMContentLoaded', init);