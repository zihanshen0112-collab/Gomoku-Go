from .board import EMPTY, BLACK, WHITE


def is_valid_move(board, x, y):
    return board.in_bounds(x, y) and board.is_empty(x, y)


def check_win(board, x, y, color):
    for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
        count = 1
        for sign in (1, -1):
            nx, ny = x + dx * sign, y + dy * sign
            while board.in_bounds(nx, ny) and board.get(nx, ny) == color:
                count += 1
                nx += dx * sign
                ny += dy * sign
        if count >= 5:
            return True
    return False


def legal_moves(board):
    """返回合法落子的一维索引列表（y * size + x）"""
    out = []
    for y in range(board.size):
        for x in range(board.size):
            if board.is_empty(x, y):
                out.append(y * board.size + x)
    return out