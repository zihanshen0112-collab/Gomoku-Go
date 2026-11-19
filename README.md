# Gomoku-Go
## start training
cd gomoku-go/python
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -c "import torch; print(torch.__version__, torch.backends.mps.is_available())"
expecting : 2.5.1 True

python run_training.py \
  --board 15 \
  --sims 100 \
  --games 20 \
  --iters 20 \
  --batch 128 \
  --save-dir ../data/models \
  --save-every 5

## start modle
python ai_server.py

## start retraining
python pretrain.py

