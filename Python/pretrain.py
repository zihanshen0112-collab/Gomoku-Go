# python/pretrain.py run before starting new modle
import os
import random
import torch
import numpy as np
import torch.nn.functional as F

from game.board import Board, BLACK, WHITE
from game.gomoku import check_win, legal_moves
from training.model import GomokuNet, board_to_tensor, get_device
from training.heuristic import get_heuristic_scores

BOARD_SIZE = 15 

def generate_heuristic_game(board_size=BOARD_SIZE):
    board = Board(board_size)
    color = BLACK
    history = []
    winner = 0  
    
    while True:
        scores = get_heuristic_scores(board, color)
        
        legal = legal_moves(board) 
        if not legal: 
            break  
        
        max_score = max([scores[a] for a in legal])
        best_moves = [a for a in legal if scores[a] == max_score]
        action = random.choice(best_moves)
        
        policy = np.zeros(board_size * board_size, dtype=np.float32)
        policy[action] = 1.0
        
        history.append((board_to_tensor(board, color), policy, color))
        
        x, y = action % board_size, action // board_size
        board.set(x, y, color)
        
        if check_win(board, x, y, color):
            winner = color
            break
            
        color = WHITE if color == BLACK else BLACK

    samples = []
    for tensor, policy, c in history:
        v = 0.0 if winner == 0 else (1.0 if winner == c else -1.0)
        samples.append((tensor, policy, v))
    return samples

if __name__ == "__main__":
    device = get_device()
    model = GomokuNet(BOARD_SIZE, 32, 5).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    
    print(f"开始用启发式规则生成 {BOARD_SIZE}x{BOARD_SIZE} 预训练数据...")
    buffer = []
    for i in range(1000): 
        buffer.extend(generate_heuristic_game())
        if (i+1) % 100 == 0:
            print(f"已生成 {i+1} 盘, 样本数 {len(buffer)}")
            
    print("开始预训练网络...")
    model.train()
    for epoch in range(10):
        random.shuffle(buffer)
        loss_sum = 0
        batches = len(buffer) // 128
        for b in range(batches):
            batch = buffer[b*128:(b+1)*128]
            states = torch.from_numpy(np.stack([s for s, _, _ in batch])).to(device)
            policies = torch.from_numpy(np.stack([p for _, p, _ in batch])).to(device)
            values = torch.from_numpy(np.array([v for _, _, v in batch], dtype=np.float32)).to(device)
            
            logits, v_pred = model(states)
            log_probs = F.log_softmax(logits, dim=1)
            loss = -(policies * log_probs).sum(dim=1).mean() + F.mse_loss(v_pred.squeeze(-1), values)
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            loss_sum += loss.item()
        print(f"Epoch {epoch+1}/10, loss = {loss_sum/batches:.4f}")
        
    os.makedirs("../data/models", exist_ok=True)
    path = f"../data/models/gomoku_{BOARD_SIZE}_pretrained.pt"
    torch.save({
        "state_dict": model.state_dict(),
        "board_size": BOARD_SIZE, "channels": 32, "blocks": 5, "iter": 0
    }, path)
    print(f"预训练完成，保存到 {path}")