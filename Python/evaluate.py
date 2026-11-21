# python/evaluate.py
import os
import glob
import torch
import numpy as np
from tqdm import tqdm

from game.board import Board, BLACK, WHITE
from game.gomoku import check_win, legal_moves
from training.model import GomokuNet, get_device
from training.mcts import MCTS
from training.heuristic import get_heuristic_scores

def get_best_move_heuristic(board, color):
    scores = get_heuristic_scores(board, color)
    legal = legal_moves(board)
    max_score = max([scores[a] for a in legal])
    best_moves = [a for a in legal if scores[a] == max_score]
    action = int(np.random.choice(best_moves))
    return action % board.size, action // board.size

def play_one_game(model, device, board_size, model_color, n_sims=50):
    board = Board(board_size)
    color = BLACK
    
    while True:
        if color == model_color:
            # 模型走
            mcts = MCTS(model, device, board_size, n_sims=n_sims)
            counts = mcts.search(board, color)
            action = int(np.argmax(counts))
            x, y = action % board_size, action // board_size
        else:
            # 启发式走
            x, y = get_best_move_heuristic(board, color)
            
        board.set(x, y, color)
        if check_win(board, x, y, color):
            return color
        if not legal_moves(board):
            return 0 # 平局
        color = WHITE if color == BLACK else BLACK

if __name__ == "__main__":
    device = get_device()
    BOARD_SIZE = 15
    
    ckpts = glob.glob("../data/models/*.pt")
    if not ckpts:
        print("model not find")
        exit()
    latest = max(ckpts, key=os.path.getmtime)
    print(f"loading model: {latest}")
    
    ckpt = torch.load(latest, map_location=device)
    model = GomokuNet(ckpt["board_size"], ckpt["channels"], ckpt["blocks"]).to(device)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    n_games = 20
    model_black_wins = 0
    model_white_wins = 0
    draws = 0
    
    print(f"Test for {n_games} games...")
    for i in tqdm(range(n_games)):
        # 交替执黑执白
        model_color = BLACK if i % 2 == 0 else WHITE
        winner = play_one_game(model, device, BOARD_SIZE, model_color, n_sims=100)
        
        if winner == 0:
            draws += 1
        elif winner == model_color:
            if model_color == BLACK: model_black_wins += 1
            else: model_white_wins += 1
            
    print(f"\n测试结束：")
    print(f"Win as Black: {model_black_wins} / {n_games//2}")
    print(f"Win as White: {model_white_wins} / {n_games//2}")
    print(f"Tie: {draws}")
    total_win = model_black_wins + model_white_wins
    print(f"Total Win: {total_win / n_games * 100:.1f}%")