import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

from game.board import EMPTY, BLACK, WHITE


class ResBlock(nn.Module):
    def __init__(self, ch):
        super().__init__()
        self.conv1 = nn.Conv2d(ch, ch, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(ch)
        self.conv2 = nn.Conv2d(ch, ch, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(ch)

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.relu(out + x)


class GomokuNet(nn.Module):
    """轻量双头网络：策略头 + 价值头"""

    def __init__(self, board_size=15, channels=32, blocks=5):
        super().__init__()
        self.board_size = board_size
        self.channels = channels

        self.conv_in = nn.Conv2d(3, channels, 3, padding=1, bias=False)
        self.bn_in = nn.BatchNorm2d(channels)
        self.blocks = nn.ModuleList([ResBlock(channels) for _ in range(blocks)])

        # 策略头
        self.p_conv = nn.Conv2d(channels, 32, 1, bias=False)
        self.p_bn = nn.BatchNorm2d(32)
        self.p_fc = nn.Linear(32 * board_size * board_size, board_size * board_size)

        # 价值头
        self.v_conv = nn.Conv2d(channels, 16, 1, bias=False)
        self.v_bn = nn.BatchNorm2d(16)
        self.v_fc1 = nn.Linear(16 * board_size * board_size, 128)
        self.v_fc2 = nn.Linear(128, 1)

    def forward(self, x):
        out = F.relu(self.bn_in(self.conv_in(x)))
        for b in self.blocks:
            out = b(out)

        p = F.relu(self.p_bn(self.p_conv(out))).flatten(1)
        p = self.p_fc(p)

        v = F.relu(self.v_bn(self.v_conv(out))).flatten(1)
        v = F.relu(self.v_fc1(v))
        v = torch.tanh(self.v_fc2(v))
        return p, v


def board_to_tensor(board, current_color):
    """返回 (3, N, N) numpy 数组：己方、对方、合法掩码"""
    size = board.size
    t = np.zeros((3, size, size), dtype=np.float32)
    opp = WHITE if current_color == BLACK else BLACK
    for y in range(size):
        for x in range(size):
            v = board.get(x, y)
            if v == current_color:
                t[0, y, x] = 1.0
            elif v == opp:
                t[1, y, x] = 1.0
            elif v == EMPTY:
                t[2, y, x] = 1.0
    return t


def get_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")