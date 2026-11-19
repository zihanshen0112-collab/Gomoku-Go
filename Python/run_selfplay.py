# python/run_selfplay.py
import os
import json
import time
import glob
import torch
import numpy as np

from training.model import GomokuNet, get_device
from training.selfplay import self_play_game
from game.board import Board, BLACK, WHITE

def export_game_to_json(board_size, moves, winner):
    """将一局对局打包成前端可读的 JSON"""
    # 1. 重建最终的棋盘状态
    board = Board(board_size)
    for x, y, c in moves:
        board.set(x, y, c)
        
    # 2. 展平一维数组给前端 Canvas 使用
    flat_board = []
    for y in range(board_size):
        for x in range(board_size):
            flat_board.append(board.get(x, y))

    # 3. 构造 history
    history_list = []
    for x, y, c in moves:
        history_list.append({
            "type": "place", "x": x, "y": y, "color": c, 
            "captured": [], "koPoint": None
        })

    # 4. 映射 winner
    winner_val = None
    if winner == BLACK: winner_val = 1
    elif winner == WHITE: winner_val = 2
    elif winner == 0: winner_val = "draw"

    # 5. 组装成前端 storage.js 要求的格式
    data = {
        "version": 1,
        "type": "archive",
        "mode": "gomoku",
        "size": board_size,
        "board": flat_board,
        "history": history_list,
        "undone": [],
        "currentColor": BLACK if len(moves) % 2 == 0 else WHITE,
        "state": "finished",
        "winner": winner_val,
        "koPoint": None,
        "consecutivePasses": 0,
        "finishedReason": "五连",
        "score": None,
        "savedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    os.makedirs("../data/selfplay", exist_ok=True)
    filename = f"../data/selfplay/selfplay_{board_size}_{int(time.time())}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"对局已保存，请在网页点击「加载对局」查看: {filename}")

if __name__ == "__main__":
    BOARD_SIZE = 15
    device = get_device()
    print(f"device = {device}")

    # 自动寻找最新的模型文件
    ckpts = glob.glob("../data/models/*.pt")
    if not ckpts:
        print("找不到模型文件，请先运行预训练或训练。")
        exit()
        
    latest_ckpt = max(ckpts, key=os.path.getmtime)
    print(f"加载模型: {latest_ckpt}")
    
    ckpt = torch.load(latest_ckpt, map_location=device)
    model = GomokuNet(ckpt["board_size"], ckpt["channels"], ckpt["blocks"]).to(device)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    print("开始自对弈，请稍候...")
    t0 = time.time()
    
    # 跑一局，sims 可以设高一点（比如 100），看看模型的最佳表现
    samples, winner, moves = self_play_game(model, device, BOARD_SIZE, n_sims=100)
    
    print(f"自对弈完成，耗时 {time.time() - t0:.1f} 秒，总手数 {len(moves)}。")
    print(f"胜者: {'黑棋' if winner == 1 else '白棋' if winner == 2 else '平局'}")
    
    export_game_to_json(BOARD_SIZE, moves, winner)