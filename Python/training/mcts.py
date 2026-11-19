import math
import numpy as np
import torch
import torch.nn.functional as F
from game.board import BLACK, WHITE, EMPTY
from game.gomoku import check_win, legal_moves
from .model import board_to_tensor
from training.heuristic import get_heuristic_scores

class MCTS:
    def __init__(self, model, device, board_size, n_sims=50, c_puct=1.5):
        self.model = model
        self.device = device
        self.board_size = board_size
        self.n_sims = n_sims
        self.c_puct = c_puct

    class Node:
        def __init__(self, prior=0.0):
            self.prior = prior
            self.visits = 0
            self.value_sum = 0.0
            self.children = {}
            self.is_expanded = False

        @property
        def q(self):
            return self.value_sum / self.visits if self.visits > 0 else 0.0

    def search(self, board, current_color):
        root = self.Node()
        self._expand(root, board, current_color)

        for _ in range(self.n_sims):
            self._simulate(root, board.clone(), current_color)

        counts = np.zeros(self.board_size * self.board_size, dtype=np.float32)
        for action, child in root.children.items():
            counts[action] = child.visits
        return counts

    def _expand(self, node, board, color):
        legal = legal_moves(board)
        if not legal:
            return

        # ======= 1. 硬规则判断：是否有绝杀或必须防守的点 =======
        scores = get_heuristic_scores(board, color)
        
        # 如果最高分极高（说明有成五机会，或者对方有活四），直接剪枝！
        max_score = np.max(scores)
        if max_score >= 100000: 
            # 只保留最高分的几个点，其它点全部屏蔽
            threshold = max_score * 0.9
            legal = [a for a in legal if scores[a] >= threshold]

        # ======= 2. 网络推理 =======
        tensor = board_to_tensor(board, color)
        with torch.no_grad():
            x = torch.from_numpy(tensor).unsqueeze(0).to(self.device)
            logits, _ = self.model(x)
            logits = logits.squeeze(0).cpu().numpy()

        # ======= 3. 软规则混合 =======
        # 将启发式分数（经过缩放）与网络 logits 相加
        # 相当于告诉网络：“你觉得这步好，人类规则也觉得这步好”
        if max_score > 0:
            logits = logits + np.log(scores + 1e-8) * 0.5

        mask = np.full(self.board_size * self.board_size, -1e9, dtype=np.float32)
        for action in legal:
            mask[action] = 0.0
        logits = logits + mask
        probs = F.softmax(torch.from_numpy(logits), dim=0).numpy()

        for action in legal:
            node.children[action] = self.Node(prior=float(probs[action]))
        node.is_expanded = True

    def _simulate(self, node, board, color):
        if not node.is_expanded:
            return -self._evaluate(node, board, color)

        # PUCT 选择
        best_action, best_score = None, -1e18
        sqrt_total = math.sqrt(node.visits + 1)
        for action, child in node.children.items():
            u = self.c_puct * child.prior * sqrt_total / (1 + child.visits)
            score = child.q + u
            if score > best_score:
                best_score = score
                best_action = action

        x = best_action % self.board_size
        y = best_action // self.board_size
        board.set(x, y, color)
        opp = WHITE if color == BLACK else BLACK

        if check_win(board, x, y, color):
            value = 1.0  # 当前落子方赢了
        else:
            value = -self._simulate(node.children[best_action], board, opp)

        node.children[best_action].visits += 1
        node.children[best_action].value_sum += value
        node.visits += 1
        node.value_sum += value
        return value

    def _evaluate(self, node, board, color):
        """未展开节点：用网络估值，并展开它"""
        self._expand(node, board, color)
        tensor = board_to_tensor(board, color)
        with torch.no_grad():
            x = torch.from_numpy(tensor).unsqueeze(0).to(self.device)
            _, v = self.model(x)
            value = float(v.squeeze().item())
        return value