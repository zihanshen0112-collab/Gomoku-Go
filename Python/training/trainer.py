import os
import glob
import time
import random
import json
import numpy as np
import torch
import torch.nn.functional as F
from tqdm import tqdm

from .model import GomokuNet, get_device, board_to_tensor
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

def load_human_data(human_dir="../data/human"):
    """从 data/human 读取对局，转为训练样本"""
    samples = []
    if not os.path.exists(human_dir):
        return samples
    
    files = glob.glob(os.path.join(human_dir, "*.json"))
    print(f"[data] 发现 {len(files)} 个人类对局文件")
    
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            
            # 简单的格式校验
            if data.get("mode") != "gomoku" or data.get("state") != "finished":
                continue
                
            board_size = data["size"]
            history = data["history"]
            winner = data["winner"] # 1=Black, 2=White, "draw"
            
            # 重建对局，逐手生成训练数据
            from game.board import Board, BLACK, WHITE
            board = Board(board_size)
            for move in history:
                if move["type"] != "place": continue
                
                c = move["color"]
                tensor = board_to_tensor(board, c)
                
                # 构建 one-hot 策略（人类实际下的一步给满分）
                action = move["y"] * board_size + move["x"]
                policy = np.zeros(board_size * board_size, dtype=np.float32)
                policy[action] = 1.0
                
                # 胜负判定
                if winner == "draw":
                    v = 0.0
                elif winner == c:
                    v = 1.0
                else:
                    v = -1.0
                    
                samples.append((tensor, policy, v))
                board.set(move["x"], move["y"], c)
        except Exception as e:
            print(f"[data] 跳过损坏文件 {f}: {e}")
            
    print(f"[data] 成功提取 {len(samples)} 个人类训练样本")
    return samples

def save_checkpoint(model, optimizer, board_size, channels, blocks, it, save_dir):
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
    print(f"\n[Save] The model has been saved to -> {path}")

def train_loop(
    board_size=15, channels=32, blocks=5, n_sims=50,
    games_per_iter=20, iters=100, batch_size=128, lr=1e-3,
    save_dir="data/models", save_every=5, init_model=None,
    use_human=False 
):
    device = get_device()
    print(f"[Train] device = {device}")

    model = GomokuNet(board_size, channels, blocks).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    os.makedirs(save_dir, exist_ok=True)

    # 加载模型
    if init_model and os.path.exists(init_model):
        print(f"[Init] Load the specified model: {init_model}")
        ckpt = torch.load(init_model, map_location=device)
        model.load_state_dict(ckpt["state_dict"])
    else:
        ckpts = glob.glob(os.path.join(save_dir, f"gomoku_{board_size}_*.pt"))
        if ckpts:
            latest = max(ckpts, key=os.path.getmtime)
            print(f"[Resume] Automatically load the latest model: {latest}")
            ckpt = torch.load(latest, map_location=device)
            model.load_state_dict(ckpt["state_dict"])
            if "optimizer_state" in ckpt:
                optimizer.load_state_dict(ckpt["optimizer_state"])

    # 加载人类数据
    human_samples = []
    if use_human:
        human_samples = load_human_data()
    else:
        print("[Data] The human data switch is not turned on. This training only uses self-play data.")

    
    buffer = []
    
    try:
        for it in range(1, iters + 1):
            t0 = time.time()
            model.eval()
            
            b_wins, w_wins, draws = 0, 0, 0
            
            pbar = tqdm(total=games_per_iter, desc=f"[Training] Iter {it}/{iters}", ncols=100)
            for g in range(games_per_iter):
                samples, winner, _ = self_play_game(model, device, board_size, n_sims)
                buffer.extend(samples)
                
                if winner == 1: b_wins += 1
                elif winner == 2: w_wins += 1
                else: draws += 1
                
                pbar.update(1)
            pbar.close()

            model.train()
            n_batches = max(1, len(buffer) // batch_size)
            epoch_loss = 0.0
            
            pbar_train = tqdm(total=n_batches, desc=f"[Updating] ", ncols=100, leave=False)
            for _ in range(n_batches):
                if use_human and human_samples and random.random() < 0.2:
                    batch = random.sample(human_samples, min(batch_size, len(human_samples)))
                    while len(batch) < batch_size:
                        batch.append(random.choice(buffer))
                else:
                    batch = random.sample(buffer, batch_size)
                    
                loss = train_step(model, optimizer, batch, device)
                epoch_loss += loss
                pbar_train.update(1)
                pbar_train.set_postfix(loss=f"{loss:.4f}")
            pbar_train.close()

            epoch_loss /= n_batches
            buffer = buffer[-20000:]
            dt = time.time() - t0
            
            print(f"  -> spent: {dt:.1f}s | Loss: {epoch_loss:.4f} | Record: Black win {b_wins} / White win {w_wins} / Tie {draws}")
            
            if it % save_every == 0 or it == iters:
                save_checkpoint(model, optimizer, board_size, channels, blocks, it, save_dir)

    except KeyboardInterrupt:
        print("\n\n[Disrupted] Training interruption was detected (Ctrl+C)！")
        print("[Disrupted] saving current progress...")
        save_checkpoint(model, optimizer, board_size, channels, blocks, it, save_dir)
        print("[Disrupted] Saved")
        exit(0)