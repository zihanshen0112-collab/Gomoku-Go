# python/training/heuristic.py
import numpy as np
from game.board import EMPTY, BLACK, WHITE
from game.gomoku import legal_moves

def score_line(board, x, y, color):
    dirs = [(1,0), (0,1), (1,1), (1,-1)]
    total = 0
    for dx, dy in dirs:
        count = 1
        open_ends = 0
        for sign in (1, -1):
            nx, ny = x + dx * sign, y + dy * sign
            steps = 0
            while steps < 4 and board.in_bounds(nx, ny):
                v = board.get(nx, ny)
                if v == color:
                    count += 1
                    steps += 1
                    nx += dx * sign
                    ny += dy * sign
                elif v == EMPTY:
                    open_ends += 1
                    break
                else:
                    break
        if count >= 5: s = 1000000
        elif count == 4: s = 100000 if open_ends == 2 else 10000 if open_ends == 1 else 0
        elif count == 3: s = 10000 if open_ends == 2 else 1000 if open_ends == 1 else 0
        elif count == 2: s = 1000 if open_ends == 2 else 100 if open_ends == 1 else 0
        elif count == 1: s = 10 if open_ends == 2 else 1 if open_ends == 1 else 0
        else: s = 0
        total += s
    return total

def get_heuristic_scores(board, color):
    """返回一个长度为 N*N 的分数数组，代表了人类直觉"""
    size = board.size
    scores = np.zeros(size * size, dtype=np.float32)
    opp = WHITE if color == BLACK else BLACK
    
    for action in legal_moves(board):
        x = action % size
        y = action // size
        # 进攻分 + 0.9 的防守分
        scores[action] = score_line(board, x, y, color) + 0.9 * score_line(board, x, y, opp)
    return scores