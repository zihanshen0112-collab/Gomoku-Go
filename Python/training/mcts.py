import math
import numpy as np
import torch
import torch.nn.functional as F

from game.board import BLACK, WHITE, EMPTY
from game.gomoku import is_valid_move, check_win, legal_moves
from .model import board_to_tensor


class Node:
    __slots__ = ("prior", "visits", "value_sum", "children", "is_expanded")

    def __init__(self):
        self.prior = 0.0
        self.visits = 0
        self.value_sum = 0.0
        self.children = {}
        self.is_expanded = False

    @property
    def q(self):
        return self.value_sum / self.visits if self.visits else 0.0


class MCTS:
    """轻量 PUCT MCTS，与浏览器侧规则一致"""

    def __init__(self, model, device, board_size, n_sims=50, c_puct=1.5):
        self.model = model
        self.device = device
        self.board_size = board_size
        self.n_sims = n_sims
        self.c_puct = c_puct

    def search(self, board, current_color):
        root = Node()
        root.is_expanded = True
        root.children = {}

        # 展开根节点
        self._expand(root, board, current_color)

        for _ in range(self.n_sims):
            self._simulate(root, board.clone(), current_color)

        # 返回访问次数分布
        counts = np.zeros(self.board_size * self.board_size, dtype=np.float32)
        for action, child in root.children.items():
            counts[action] = child.visits
        return counts

    def _expand(self, node, board, color):
        if not node.is_expanded:
            return
        tensor = board_to_tensor(board, color)
        with torch.no_grad():
            x = torch.from_numpy(tensor).unsqueeze(0).to(self.device)
            logits, _ = self.model(x)
            logits = logits.squeeze(0).cpu().numpy()

        mask = np.full(self.board_size * self.board_size, -1e9, dtype=np.float32)
        for action in legal_moves(board):
            mask[action] = 0.0
        logits = logits + mask
        probs = F.softmax(torch.from_numpy(logits), dim=0).numpy()

        for action in legal_moves(board):
            child = Node()
            child.prior = float(probs[action])
            node.children[action] = child

    def _simulate(self, node, board, color):
        if not node.children:
            return self._terminal_value(board, color)
        if not node.is_expanded:
            return self._terminal_value(board, color)

        # PUCT 选子
        best_action, best_score = None, -1e18
        sqrt_total = math.sqrt(sum(c.visits for c in node.children.values()) + 1e-8)
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
            value = -1.0  # 从「轮到对手」视角，败
            node.children[best_action].visits += 1
            node.children[best_action].value_sum += value
            node.visits += 1
            node.value_sum += -value
            return -value

        # 未结束：若子节点未展开，先评估一次
        if not node.children[best_action].is_expanded:
            child_node = node.children[best_action]
            child_node.is_expanded = True
            tensor = board_to_tensor(board, opp)
            with torch.no_grad():
                t = torch.from_numpy(tensor).unsqueeze(0).to(self.device)
                logits, v = self.model(t)
                logits = logits.squeeze(0).cpu().numpy()
                v = float(v.squeeze().item())

            mask = np.full(self.board_size * self.board_size, -1e9, dtype=np.float32)
            for action in legal_moves(board):
                mask[action] = 0.0
            logits = logits + mask
            probs = F.softmax(torch.from_numpy(logits), dim=0).numpy()
            for action in legal_moves(board):
                c = Node()
                c.prior = float(probs[action])
                child_node.children[action] = c

            value = -v
        else:
            # 递归模拟
            value = -self._simulate(node.children[best_action], board, opp)

        node.children[best_action].visits += 1
        node.children[best_action].value_sum += -value
        node.visits += 1
        node.value_sum += -value if False else -value  # 从对手视角累计
        return value

    def _terminal_value(self, board, color):
        # 用于未展开节点或不含子节点的占位
        return 0.0