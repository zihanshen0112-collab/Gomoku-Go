class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setGame(game) {
    this.game = game;
    this.resize(); 
  }

  resize() {
    const size = this.game.size;
    const dpr = window.devicePixelRatio || 1;

    let cellSize = 30;
    const margin = 22;

    const maxSize = Math.min(window.innerWidth - 40, window.innerHeight - 200, 760);
    const minSize = 260;

    let cssSize = margin * 2 + (size - 1) * cellSize;
    if (cssSize > maxSize) {
      cellSize = (maxSize - margin * 2) / (size - 1);
      cssSize = maxSize;
    } else if (cssSize < minSize) {
      cssSize = minSize;
      cellSize = (cssSize - margin * 2) / (size - 1);
    }

    this.canvas.style.width = cssSize + 'px';
    this.canvas.style.height = cssSize + 'px';
    this.canvas.width = Math.round(cssSize * dpr);
    this.canvas.height = Math.round(cssSize * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cssSize = cssSize;
    this.margin = margin;
    this.cellSize = cellSize;
    this.draw();
  }

  posToPixel(x, y) {
    return {
      px: this.margin + x * this.cellSize,
      py: this.margin + y * this.cellSize
    };
  }

  pixelToPos(px, py) {
    return {
      x: Math.round((px - this.margin) / this.cellSize),
      y: Math.round((py - this.margin) / this.cellSize)
    };
  }

  getStarPoints(size) {
    if (size === 19) return [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];
    if (size === 15) return [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]];
    if (size === 13) return [[3,3],[3,6],[3,9],[6,3],[6,6],[6,9],[9,3],[9,6],[9,9]];
    return [];
  }

  draw() {
    const { ctx, game } = this;
    const size = game.size;
    const s = this.cssSize;
    ctx.clearRect(0, 0, s, s);

    ctx.fillStyle = '#e8b96a';
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i++) {
      const p1 = this.posToPixel(i, 0);
      const p2 = this.posToPixel(i, size - 1);
      ctx.beginPath(); ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.stroke();
      const p3 = this.posToPixel(0, i);
      const p4 = this.posToPixel(size - 1, i);
      ctx.beginPath(); ctx.moveTo(p3.px, p3.py); ctx.lineTo(p4.px, p4.py); ctx.stroke();
    }

    ctx.fillStyle = '#333';
    for (const [x, y] of this.getStarPoints(size)) {
      const { px, py } = this.posToPixel(x, y);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, this.cellSize * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }

    const r = this.cellSize * 0.45;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = game.board.get(x, y);
        if (v === EMPTY) continue;
        const { px, py } = this.posToPixel(x, y);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        if (v === BLACK) {
          ctx.fillStyle = '#000'; ctx.fill();
        } else {
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = '#333'; ctx.stroke();
        }
      }
    }

    const last = [...game.history].reverse().find(m => m.type === 'place');
    if (last) {
      const { px, py } = this.posToPixel(last.x, last.y);
      ctx.beginPath();
      ctx.arc(px, py, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = last.color === BLACK ? '#fff' : '#000';
      ctx.fill();
    }
  }
}