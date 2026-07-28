# Deploying to EC2 (free tier + swap)

Target: t2.micro / t3.micro, Ubuntu 22.04, 1 vCPU / 1GB RAM, free tier eligible
(750 hrs/month, 12 months on a new AWS account).

## 1. Launch the instance (console or CLI)

- AMI: Ubuntu Server 22.04 LTS
- Type: `t2.micro` or `t3.micro`
- Security group: allow inbound `22` (SSH, your IP only) and `80` (HTTP, `0.0.0.0/0`)
- Key pair: create or reuse one, keep the `.pem` file

## 2. Bootstrap

```bash
scp -i your-key.pem deploy/setup_ec2.sh ubuntu@<EC2_PUBLIC_IP>:~
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP> 'chmod +x setup_ec2.sh && ./setup_ec2.sh'
```

This adds 2GB swap, installs Python 3.11 / Node / nginx, clones the repo, builds the
backend venv, and builds the frontend static bundle. It stops short of starting
anything, since three things still need manual attention:

## 3. Secrets

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd shopforge-ai
cp .env.example .env   # repo root -- app/config.py reads REPO_ROOT/.env, not backend/.env
nano .env               # set GEMINI_API_KEY
```

Never commit this file. It's already git-ignored.

## 4. Corpus

`data/processed/` is git-ignored and was never pushed — it has to travel separately:

```bash
scp -i your-key.pem -r data/processed ubuntu@<EC2_PUBLIC_IP>:~/shopforge-ai/data/
```

(Or run `scripts/ingest_reviews.py` + `scripts/build_index.py` on the instance itself,
but that's slower and heavier than just copying the ~120MB of prebuilt files.)

## 5. Start the backend as a service

```bash
sudo cp deploy/shopforge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shopforge
sudo systemctl status shopforge   # confirm it's running
```

## 6. Wire up nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/shopforge
sudo ln -s /etc/nginx/sites-available/shopforge /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Visit `http://<EC2_PUBLIC_IP>/`.

## Known constraints on this tier

- **1GB RAM is tight.** Swap covers the gap but the first request after a reboot
  (model load) will be slow — expect 20-40s, not the sub-second warm-cache latency
  seen locally. `app/main.py`'s startup hook already loads the model eagerly so this
  cost is paid once at boot, not on the first user request.
- **Single worker only** (see `shopforge.service`) — concurrent requests queue rather
  than running in parallel. Fine for a demo link, not for real traffic.
- **No HTTPS** in this config — raw IP, http only. Add a domain + `certbot --nginx`
  later if wanted.
- **No auto-restart on OOM beyond systemd's `Restart=on-failure`.** If it does get
  OOM-killed, `journalctl -u shopforge -n 50` is the first place to look.
