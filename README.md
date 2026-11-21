# GOMOKU-GO: A LOCAL AI TRAINING PLATFORM FOR GOMOKU AND GO

This project is a complete local platform for playing and training AI in Gomoku (Five-in-a-Row) and Go. It includes a browser-based web interface for playing games, and a local PyTorch reinforcement learning pipeline (a simplified AlphaZero architecture) that you can train from scratch on your own computer (e.g., Apple Silicon Macs).


## [ FEATURES ]

Web UI:
- Dual Modes: Supports Gomoku (15x15 or 19x19) and Go (simplified capture and scoring rules).
- Local PvP: Two players alternate turns on the same computer.
- Heuristic AI: A built-in, fast rule-based AI. No setup required to play.
- Trained Model AI: Connects to a local HTTP server running your PyTorch neural network model (using MCTS).
- Undo and Redo: Easily revert or restore moves. In AI mode, clicking Undo automatically reverts two steps (both human and AI).
- Save and Load: Export game states to JSON to continue later or review previous matches.
- Multi-language: Supports English and Chinese.

Python Training Pipeline:
- Headless Rule Engine: Completely decoupled from the frontend. Runs high-speed simulations in Python.
- Heuristic Pre-training (pretrain.py): Training from absolute zero is too slow. This script generates high-quality games using traditional rules to give the neural network a baseline understanding of the game.
- Self-Play Reinforcement Learning (run_training.py): The model plays against itself, using PUCT MCTS combined with neural network evaluations to continuously improve.
- Human Data Mix (--use-human): Mix your own high-quality saved games into the training loop at a specific ratio to fine-tune the AI to your personal playstyle.
- Automated Evaluation (evaluate.py): Pit your trained model against the heuristic AI to verify if its win rate is actually improving.
- Safety and Progress: Training includes progress bars. Pressing Ctrl+C safely interrupts the training and automatically saves the latest checkpoint.


## [ QUICK START AND TERMINAL COMMANDS ]

1. Start the Web UI
Because the app involves cross-origin requests and local file reading, you cannot just double-click the HTML file. You must serve it using a local HTTP server.

Open your terminal, navigate to the project root, and run:
    cd gomoku-go
    python3 -m http.server 8000

Open your browser and go to: http://localhost:8000
You can now play against a friend or the built-in heuristic AI.


## [ PYTHON TRAINING GUIDE ]

1. Environment Setup
It is recommended to use a virtual environment (venv) to isolate dependencies.
Open a new terminal window and run:

    cd gomoku-go/python
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt

Dependencies: torch, numpy, tqdm, flask, flask-cors

2. Step 1: Heuristic Pre-training (Pretrain)
Do not start with self-play immediately. Generate 1000 pure rule-based games first to teach the neural network basic rules and defense (e.g., blocking open threes).

Ensure you are in the python directory and the virtual environment is activated:
    cd gomoku-go/python
    source .venv/bin/activate
    python pretrain.py

Once finished, it will save gomoku_15_pretrained.pt in the ../data/models/ directory.

3. Step 2: Self-Play Reinforcement Training (Train)
Let the model stand on the shoulders of the pre-trained model and evolve through MCTS self-play.

    python run_training.py --board 15 --sims 50 --games 20 --iters 100 --init-model ../data/models/gomoku_15_pretrained.pt

- Progress: The terminal shows self-play progress bars, Loss changes, and Black/White win rates.
- Safe Interrupt: Pressing Ctrl+C will automatically save the checkpoint of the current iteration and exit safely.
- Continue Training: If you run the script without --init-model next time, it will automatically find the latest model in data/models and resume training.

4. Step 3: Verification and Evaluation
After training for a few iterations, do you want to know if it has improved?

    python evaluate.py

This script automatically loads the latest model and plays 20 games against the heuristic AI to output a win rate.

You can also let it play a game against itself and export the log:

    python run_selfplay.py

After running, the terminal will print the path to a JSON file (in data/selfplay/). Open the web UI, click "Load Game", and import this JSON to review the AI's operations step-by-step.


## [ CONNECTING THE TRAINED MODEL TO THE WEB UI ]

If you think the model is trained enough and want to use it in the browser:

1. Start the Flask Inference Backend (keep it running in a terminal):
    cd gomoku-go/python
    source .venv/bin/activate
    python ai_server.py

2. Go back to the Web UI: Refresh your browser (ensure the board is set to 15x15).
3. In the AI panel, change the dropdown to "Model AI".
4. Start playing. Every time you make a move, the frontend sends the board state to the Flask server. Flask runs 100 MCTS simulations with your model and returns the best move.


## [ HUMAN DATA MIXED TRAINING ]

If you want the AI to learn your playstyle, save your games from the Web UI.

1. After a game ends, click "Save Game" and place the JSON files into the gomoku-go/data/human/ directory. (It is recommended to accumulate 50 or more high-quality games).
2. Create the directory if it does not exist:
    mkdir -p ../data/human
3. When starting the training, add the --use-human flag:

    python run_training.py --board 15 --iters 100 --use-human

During each update, the model will sample 20% of its batch from the human data pool and 80% from self-play.
Note: Human data is only used for fine-tuning. Ensure the games are of high quality. Do not pollute the value network with bad moves.
