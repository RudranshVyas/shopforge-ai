#!/usr/bin/env bash
# Bootstrap script for a fresh Ubuntu EC2 instance (t2.micro / t3.micro, free
# tier). Uses `uv` to get an isolated Python 3.11 rather than assuming the
# distro packages one -- requirements.txt pins cp311 wheels (faiss-cpu,
# pydantic-core), and the OS default python3 can be newer than those support.
# Run as the default `ubuntu` user via SSH:
#
#   scp deploy/setup_ec2.sh ubuntu@<EC2_PUBLIC_IP>:~
#   ssh ubuntu@<EC2_PUBLIC_IP> 'chmod +x setup_ec2.sh && ./setup_ec2.sh'
#
# 1GB RAM is tight for torch + sentence-transformers + FAISS, so this adds a
# 2GB swap file before installing anything. Idempotent: safe to re-run.
set -euo pipefail

echo "[1/6] Swap file (2GB) -- avoids OOM during model load on 1GB RAM"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
sudo sysctl vm.swappiness=10 || true

echo "[2/6] System packages"
sudo apt-get update -y
sudo apt-get install -y git nginx nodejs npm curl

# requirements.txt pins cp311 wheels (faiss-cpu, pydantic-core, etc). Rather than
# assume the distro ships a python3.11 package -- it may not, and the default
# python3 can be newer than any of those wheels support -- pull an isolated
# 3.11 via uv, independent of the OS package set.
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"
uv python install 3.11

echo "[3/6] Clone repo"
if [ ! -d shopforge-ai ]; then
  git clone https://github.com/RudranshVyas/shopforge-ai.git
fi
cd shopforge-ai

echo "[4/6] Backend venv + deps"
cd backend
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.txt
cd ..

echo "[5/6] Frontend build (static, served by nginx -- no node process at runtime)"
cd frontend
npm install
npm run build
cd ..

echo "[6/6] Done. Remaining manual steps:"
echo "  1. Create .env (repo root, next to .env.example) with GEMINI_API_KEY."
echo "  2. Put data/processed/{reviews,products,id_map}.parquet, faiss.index,"
echo "     embeddings.npy, bm25.pkl on this box (scp from your machine --"
echo "     these are git-ignored and were never pushed)."
echo "  3. sudo cp deploy/shopforge.service /etc/systemd/system/"
echo "     sudo systemctl enable --now shopforge"
echo "  4. sudo cp deploy/nginx.conf /etc/nginx/sites-available/shopforge"
echo "     sudo ln -s /etc/nginx/sites-available/shopforge /etc/nginx/sites-enabled/"
echo "     sudo rm -f /etc/nginx/sites-enabled/default"
echo "     sudo nginx -t && sudo systemctl restart nginx"
