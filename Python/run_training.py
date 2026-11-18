"""启动训练循环"""
import argparse
from training.trainer import train_loop

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--board", type=int, default=15)
    p.add_argument("--channels", type=int, default=32)
    p.add_argument("--blocks", type=int, default=5)
    p.add_argument("--sims", type=int, default=50)
    p.add_argument("--games", type=int, default=20, help="每次迭代自对弈盘数")
    p.add_argument("--iters", type=int, default=100)
    p.add_argument("--batch", type=int, default=128)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--save-dir", default="data/models")
    p.add_argument("--save-every", type=int, default=5)
    args = p.parse_args()

    train_loop(
        board_size=args.board,
        channels=args.channels,
        blocks=args.blocks,
        n_sims=args.sims,
        games_per_iter=args.games,
        iters=args.iters,
        batch_size=args.batch,
        lr=args.lr,
        save_dir=args.save_dir,
        save_every=args.save_every,
    )