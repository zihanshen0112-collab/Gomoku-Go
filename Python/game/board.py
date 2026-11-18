EMPTY, BLACK, WHITE = 0, 1, 2


class Board:
    def __init__(self, size):
        self.size = size
        self.grid = [[EMPTY] * size for _ in range(size)]

    def clone(self):
        b = Board(self.size)
        b.grid = [row[:] for row in self.grid]
        return b

    def get(self, x, y):
        return self.grid[y][x]

    def set(self, x, y, v):
        self.grid[y][x] = v

    def is_empty(self, x, y):
        return self.grid[y][x] == EMPTY

    def in_bounds(self, x, y):
        return 0 <= x < self.size and 0 <= y < self.size

    def neighbors(self, x, y):
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if self.in_bounds(nx, ny):
                yield nx, ny