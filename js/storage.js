const Storage = {
  dirHandle: null,

  serialize(game, type) {
    return {
      version: 1,
      type,
      mode: game.mode,
      size: game.size,
      board: Array.from(game.board.grid),
      history: game.history,
      undone: game.undone,
      currentColor: game.currentColor,
      state: game.state,
      winner: game.winner,
      koPoint: game.koPoint,
      consecutivePasses: game.consecutivePasses,
      finishedReason: game.finishedReason,
      score: game.score,
      savedAt: new Date().toISOString()
    };
  },

  deserialize(data) {
    const game = new Game(data.size, data.mode);
    game.board.grid = Int8Array.from(data.board);
    game.history = data.history || [];
    game.undone = data.undone || [];
    game.currentColor = data.currentColor;
    game.state = data.state;
    game.winner = data.winner;
    game.koPoint = data.koPoint;
    game.consecutivePasses = data.consecutivePasses || 0;
    game.finishedReason = data.finishedReason;
    game.score = data.score;
    return game;
  },

  async saveGame(game, type) {
    const filename = `game_${game.mode}_${Date.now()}.json`;
    const json = JSON.stringify(this.serialize(game, type), null, 2);

    if (window.showDirectoryPicker) {
      try {
        if (!this.dirHandle) {
          this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        }
        const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        return { ok: true, filename, path: this.dirHandle.name };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, reason: '已取消' };
      }
    }

    // 浏览器不支持 File System Access API 时，退化为下载
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true, filename, path: '下载文件夹' };
  },

  async loadGame() {
    if (window.showOpenFilePicker) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{ description: '对局文件', accept: { 'application/json': ['.json'] } }]
        });
        const file = await fileHandle.getFile();
        const text = await file.text();
        return { ok: true, data: JSON.parse(text) };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, reason: '已取消' };
        return { ok: false, reason: e.message };
      }
    }

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return resolve({ ok: false, reason: '未选择文件' });
        try {
          const text = await file.text();
          resolve({ ok: true, data: JSON.parse(text) });
        } catch (e) {
          resolve({ ok: false, reason: e.message });
        }
      };
      input.click();
    });
  }
};