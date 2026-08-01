# Deploying to EC2 (free tier + swap)

Target: t2.micro / t3.micro, 1 vCPU / 1GB RAM, free tier eligible (750 hrs/month,
12 months on a new AWS account). Verified on a live instance.

## 1. Launch the instance (console or CLI)

- AMI: any recent Ubuntu Server LTS. Don't assume a specific release or that
  `python3.11` will be apt-installable — `setup_ec2.sh` uses `uv` to get an
  isolated Python 3.11 regardless of what the distro ships.
- Type: `t2.micro` or `t3.micro`
- Security group: allow inbound `22` (SSH, your IP only) and `80` (HTTP, `0.0.0.0/0`)
- Key pair: create or reuse one, keep the `.pem` file. On Windows, the downloaded
  `.pem` is usually world-readable and OpenSSH will refuse it — lock it down first:
  `icacls key.pem /inheritance:r` then `icacls key.pem /grant:r "$env:USERNAME:R"`

## 2. Bootstrap

```bash
scp -i your-key.pem deploy/setup_ec2.sh ubuntu@<EC2_PUBLIC_IP>:~
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP> 'chmod +x setup_ec2.sh && ./setup_ec2.sh'
```

This adds 1GB swap, gets an isolated Python 3.11 via `uv`, installs Node/nginx if
missing, clones the repo, builds the backend venv (CPU-only torch — see below),
builds the frontend, copies it to `/var/www/shopforge/dist`, and prints the
remaining manual steps.

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

(You can also run `scripts/ingest_reviews.py` + `scripts/build_index.py` on the
instance, though copying the ~135MB of prebuilt files is faster.)

## 5. Start the backend as a service

```bash
sudo cp deploy/shopforge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shopforge
sudo systemctl status shopforge   # confirm it's running
```

First boot loads the corpus and the MiniLM model up front, so `Application startup
complete` takes about a minute to appear in `journalctl -u shopforge`. Every request
after that is served from the warm index.

## 6. Wire up nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/shopforge
sudo ln -sf /etc/nginx/sites-available/shopforge /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Visit `http://<EC2_PUBLIC_IP>/`.

## Notes for a 1GB free-tier box

These are already handled in `setup_ec2.sh` and `nginx.conf`. Worth knowing if you
adapt this for another project.

1. **Install CPU-only torch first.** On Linux, plain `pip install torch` resolves
   to the CUDA build and pulls ~2GB of `nvidia-*` packages that a GPU-less box
   will never use. Installing
   `torch --index-url https://download.pytorch.org/whl/cpu` before the rest of
   `requirements.txt` means the CPU build already satisfies
   sentence-transformers' `torch>=1.11.0` constraint.
2. **Point `TMPDIR` at real disk.** `/tmp` is a RAM-backed tmpfs (~450MB) on this
   AMI, which is too small to extract torch's shared libraries into.
3. **Drop `node_modules` after the build.** nginx serves the static `dist/`
   output, so no node process runs at runtime.
4. **Serve from `/var/www`, not the home directory.** Home directories are `750`,
   so nginx's `www-data` user can't traverse into them. `setup_ec2.sh` copies the
   build to `/var/www/shopforge/dist`; re-run that step after any frontend rebuild.

## Scaling past this

The service runs a single uvicorn worker, which suits a demo instance. For real
traffic, move to a larger instance and raise the worker count in
`shopforge.service`. HTTPS is available through `certbot --nginx` once a hostname
points at the box.
