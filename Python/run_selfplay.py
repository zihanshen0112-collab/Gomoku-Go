"""单进程演示：跑 1 局自对弈并打印每手落子，用于验证规则与 MCTS"""
import time
from training.model import GomokuNet, get_device
from training.selfplay import self_play_game
from game.board import Board, BLACK, WHITE
from game.gomoku import check_win

if __name__ == "__main__":
    device = get_device()
    print(f"device = {device}")

    model = GomokuNet(15, 32, 5).to(device)
    model.eval()

    board = Board(15)
    color = BLACK
    move_no = 0
    t0 = time.time()
    samples = []
    while True:
        from training.mcts import MCTS
        mcts = MCTS(model, device, 15, n_sims=20)  # 演示用小 sim
        counts = mcts.search(board, color)
        action = int(counts.argmax())
        x, y = action % 15, action // 15
        board.set(x, y, color)
        move_no += 1
        print(f"move {move_no}: {'B' if color == BLACK else 'W'} ({x},{y})")
        if check_win(board, x, y, color):
            print(f"winner: {'B' if color == BLACK else 'W'}")
            break
        color = WHITE if color == BLACK else BLACK
        if move_no > 225:
            print("draw")
            break
    print(f"elapsed: {time.time() - t0:.1f}s")