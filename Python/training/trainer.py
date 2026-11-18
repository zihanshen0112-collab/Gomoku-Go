import os
import time
import numpy as np
import torch
import torch.nn.functional as F

from .model import GomokuNet, get_device
from .selfplay import self_play_game
import glob


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
    save_every=5,
):
    device = get_device()
    print(f"[train] device = {device}")

    model = GomokuNet(board_size, channels, blocks).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    ckpts = sorted(glob.glob(os.path.join(save_dir, f"gomoku_{board_size}_*.pt")),
               key=lambda p: int(p.rsplit("_", 1)[1].split(".")[0]))

    os.makedirs(save_dir, exist_ok=True)
    buffer = []

    if ckpts:
        latest = ckpts[-1]
        print(f"[resume] loading {latest}")
        ckpt = torch.load(latest, map_location=device)
        model.load_state_dict(ckpt["state_dict"])

    for it in range(1, iters + 1):
        t0 = time.time()
        model.eval()
        for g in range(games_per_iter):
            samples = self_play_game(model, device, board_size, n_sims)
            if samples:
                last_v = samples[-1][2]
                print(f"    game result: {last_v:+.1f}") 
            buffer.extend(samples)
            print(f"  [iter {it}] selfplay game {g+1}/{games_per_iter}, samples total = {len(buffer)}")

        model.train()
        n_batches = max(1, len(buffer) // batch_size)
        epoch_loss = 0.0
        for _ in range(n_batches):
            batch = [buffer[random_idx(len(buffer))] for _ in range(batch_size)]
            loss = train_step(model, optimizer, batch, device)
            epoch_loss += loss
        epoch_loss /= n_batches

        # 保留最近 N 条样本，避免内存无限增长
        buffer = buffer[-20000:]

        dt = time.time() - t0
        print(f"[iter {it}] loss={epoch_loss:.4f}, time={dt:.1f}s, buffer={len(buffer)}")

        if it % save_every == 0 or it == iters:
            path = os.path.join(save_dir, f"gomoku_{board_size}_{it}.pt")
            torch.save({
                "state_dict": model.state_dict(),
                "board_size": board_size,
                "channels": channels,
                "blocks": blocks,
                "iter": it,
            }, path)
            print(f"[iter {it}] saved -> {path}")


def random_idx(n):
    return int(torch.randint(0, n, (1,)).item())