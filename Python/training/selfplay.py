# python/training/selfplay.py
import numpy as np
from game.board import Board, BLACK, WHITE
from game.gomoku import check_win
from training.model import board_to_tensor
from training.mcts import MCTS

def self_play_game(model, device, board_size=15, n_sims=50):
    board = Board(board_size)
    color = BLACK
    history = []
    moves = []       
    move_count = 0

    while True:
        mcts = MCTS(model, device, board_size, n_sims=n_sims)
        counts = mcts.search(board, color)

        if counts.sum() == 0:
            return [], 0, []

        probs = counts / counts.sum()
        
        temp = 1.0 if move_count < 10 else 0.1
        if temp > 0:
            probs_t = probs ** (1.0 / temp)
            probs_t = probs_t / probs_t.sum()
            action = np.random.choice(len(probs_t), p=probs_t)
        else:
            action = int(np.argmax(probs))

        x = action % board_size
        y = action // board_size
        
        history.append((board_to_tensor(board, color), probs, color))
        moves.append((x, y, color)) # <--- 新增：记录

        board.set(x, y, color)
        move_count += 1

        if check_win(board, x, y, color):
            winner = color
            break
        if len(history) >= board_size * board_size:
            winner = 0
            break

        color = WHITE if color == BLACK else BLACK

    samples = []
    for tensor, policy, c in history:
        v = 0.0 if winner == 0 else (1.0 if winner == c else -1.0)
        samples.append((tensor, policy, v))
        
    return samples, winner, moves  