import random
import numpy as np
import torch

from game.board import Board, BLACK, WHITE
from game.gomoku import check_win
from .model import board_to_tensor
from .mcts import MCTS


def self_play_game(model, device, board_size=15, n_sims=50, temperature=1.0):
    board = Board(board_size)
    color = BLACK
    history = []

    while True:
        tensor = board_to_tensor(board, color)
        mcts = MCTS(model, device, board_size, n_sims=n_sims)
        counts = mcts.search(board, color)

        if counts.sum() == 0:
            return []  # 异常保护

        probs = counts / counts.sum()
        # 温度采样
        if temperature > 0:
            probs_t = probs ** (1.0 / temperature)
            probs_t = probs_t / probs_t.sum()
            action = np.random.choice(len(probs_t), p=probs_t)
        else:
            action = int(np.argmax(probs))

        x = action % board_size
        y = action // board_size
        history.append((tensor, probs, color))

        board.set(x, y, color)
        if check_win(board, x, y, color):
            winner = color
            break

        if len(history) >= board_size * board_size:
            winner = 0
            break

        color = WHITE if color == BLACK else BLACK

    samples = []
    for tensor, policy, c in history:
        if winner == 0:
            v = 0.0
        elif winner == c:
            v = 1.0
        else:
            v = -1.0
        samples.append((tensor, policy, v))
    return samples