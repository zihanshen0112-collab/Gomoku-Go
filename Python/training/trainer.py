import os
import time
import glob
import numpy as np
import torch
import torch.nn.functional as F

from .model import GomokuNet, get_device
from .selfplay import self_play_game

def train_step(model, optimizer, batch, device):
    states = torch.from_numpy(np.stack([s for s, _, _ in batch])).to(device)
    policies = torch.from_numpy(np.stack([p for _, p, _ in batch])).to(device)
    values = torch.from_numpy(np.array([v for _, _, v in batch], dtype=np.float32)).to(device)

    logits, v_pred = model(states)
    log_probs = F.log_softmax(logits, dim=1)
    policy_loss = -(policies * log_probs).sum(dim=1).mean()
    value_loss = F.mse_loss(v_pred.squeeze(-1), values)
    loss = policy_loss + value_loss

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return float(loss.item())

def train_loop(
    board_size=15,
    channels=32,
    blocks=5,
    n_sims=50,
    games_per_iter=20,
    iters=100,
    batch_size=128,
    lr=1e-3,
    save_dir="data/models",
    save_every=5,):

    device = get_device()
    print(f"[train] device = {device}")

    model = GomokuNet(board_size, channels, blocks).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    os.makedirs(save_dir, exist_ok=True)
    buffer = []

    # 自动加载最新的检查点
    ckpts = glob.glob(os.path.join(save_dir, f"gomoku_{board_size}_*.pt"))
    if ckpts:
        latest_ckpt = max(ckpts, key=os.path.getmtime)
        print(f"[resume] loading {latest_ckpt}")
        ckpt = torch.load(latest_ckpt, map_location=device)
        model.load_state_dict(ckpt["state_dict"])
        if "optimizer_state" in ckpt:
            optimizer.load_state_dict(ckpt["optimizer_state"])
            print("[resume] optimizer state loaded successfully")

    for it in range(1, iters + 1):
        t0 = time.time()
        model.eval()
        
        # 记录黑白胜负
        b_wins, w_wins, draws = 0, 0, 0
        
        for g in range(games_per_iter):
            # 注意：这里 self_play_game 现在会返回 winner
            samples, winner, _ = self_play_game(model, device, board_size, n_sims)
            buffer.extend(samples)
            
            if winner == 1: b_wins += 1
            elif winner == 2: w_wins += 1
            else: draws += 1

        model.train()
        n_batches = max(1, len(buffer) // batch_size)
        epoch_loss = 0.0
        for _ in range(n_batches):
            import random
            batch = random.sample(buffer, batch_size)
            loss = train_step(model, optimizer, batch, device)
            epoch_loss += loss
        epoch_loss /= n_batches

        buffer = buffer[-20000:]
        dt = time.time() - t0
        
        print(f"[iter {it}] loss={epoch_loss:.4f}, time={dt:.1f}s, buffer={len(buffer)}")
        print(f"  -> 本轮战绩: 黑胜 {b_wins} / 白胜 {w_wins} / 平局 {draws} (黑赢比: {b_wins/max(1, b_wins+w_wins+draws)*100:.1f}%)")

        if it % save_every == 0 or it == iters:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            path = os.path.join(save_dir, f"gomoku_{board_size}_{it}_{timestamp}.pt")
            torch.save({
                "state_dict": model.state_dict(),
                "optimizer_state": optimizer.state_dict(),
                "board_size": board_size,
                "channels": channels,
                "blocks": blocks,
                "iter": it,
            }, path)
            print(f"[iter {it}] saved -> {path}")