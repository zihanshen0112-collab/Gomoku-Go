from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import numpy as np
import glob, os

from game.board import Board, BLACK, WHITE, EMPTY
from training.model import GomokuNet, get_device
from training.mcts import MCTS

app = Flask(__name__)
CORS(app)  # 允许前端跨域请求

device = get_device()
model = None
model_path = ""

def load_latest_model(save_dir="../data/models"):
    global model, model_path
    ckpts = glob.glob(os.path.join(save_dir, "gomoku_15_*.pt"))
    if not ckpts:
        return False
    latest_ckpt = max(ckpts, key=os.path.getmtime)
    if latest_ckpt == model_path:
        return True
        
    print(f"Loading model {latest_ckpt} ...")
    ckpt = torch.load(latest_ckpt, map_location=device)
    m = GomokuNet(ckpt["board_size"], ckpt["channels"], ckpt["blocks"]).to(device)
    m.load_state_dict(ckpt["state_dict"])
    m.eval()
    model = m
    model_path = latest_ckpt
    print(f"Model loaded: iter {ckpt.get('iter', 'unknown')}")
    return True

@app.route("/api/ai-move", methods=["POST"])
def ai_move():
    load_latest_model()
    if model is None:
        return jsonify({"error": "No model available"}), 503

    data = request.json
    grid = data.get("board")
    color = data.get("color")
    sims = data.get("sims", 100)

    size = len(grid)
    # 校验尺寸：如果网页是 19 路，而模型是 15 路，直接返回错误
    if model.board_size != size:
        return jsonify({"error": f"尺寸不匹配：网页是 {size} 路，模型是 {model.board_size} 路。请把网页棋盘切换到 {model.board_size} 路，或重新训练 {size} 路的模型。"}), 400

    board = Board(size)
    for y in range(size):
        for x in range(size):
            board.set(x, y, grid[y][x])

    mcts = MCTS(model, device, size, n_sims=sims)
    counts = mcts.search(board, color)
    
    if counts.sum() == 0:
         return jsonify({"error": "No valid moves"}), 400
         
    action = int(np.argmax(counts))
    x = action % size
    y = action // size

    return jsonify({"x": x, "y": y, "model_iter": os.path.basename(model_path)})

if __name__ == "__main__":
    print("Starting AI Server on http://127.0.0.1:5001")
    app.run(port=5001, debug=False)