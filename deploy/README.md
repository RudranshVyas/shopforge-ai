# Deploying to EC2 (free tier + swap)

Target: t2.micro / t3.micro, 1 vCPU / 1GB RAM, free tier eligible (750 hrs/month,
12 months on a new AWS account). Verified working on a live instance — see
**What actually broke** below before assuming this is a smooth path.

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

(Or run `scripts/ingest_reviews.py` + `scripts/build_index.py` on the instance itself,
but that's slower and heavier than just copying the ~135MB of prebuilt files. On a
slow home uplink, this scp is the single longest step — budget real time for it.)

## 5. Start the backend as a service

```bash
sudo cp deploy/shopforge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shopforge
sudo systemctl status shopforge   # confirm it's running
```

First boot loads the full corpus + MiniLM model under heavy swap pressure —
took ~65s on the verified run before `Application startup complete` appeared in
`journalctl -u shopforge`. Don't assume it's stuck; give it a couple of minutes
before troubleshooting.

## 6. Wire up nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/shopforge
sudo ln -sf /etc/nginx/sites-available/shopforge /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Visit `http://<EC2_PUBLIC_IP>/`.

## What actually broke (first real deployment)

The instance turned out to be a much newer Ubuntu release than planned for, with
no `python3.11` package and a default `python3` too new for the pinned cp311
wheels (faiss-cpu, pydantic-core). Beyond that, four more problems surfaced only
by actually running this on a real box — the fixes are already baked into
`setup_ec2.sh` and `nginx.conf`, documented here so a future failure mode isn't
mistaken for something new:

1. **`torch` pulls CUDA by default on Linux.** A plain `pip install torch` (via
   sentence-transformers' dependency) resolved to the CUDA build — ~2GB of
   `nvidia-cublas`, `nvidia-cudnn`, `nvidia-cusolver`, `triton`, etc. On an
   ~8GB free-tier root volume this fills the disk before torch itself even
   finishes downloading. Fixed by installing
   `torch --index-url https://download.pytorch.org/whl/cpu` *before* the rest
   of `requirements.txt`, so the CPU build already satisfies
   sentence-transformers' `torch>=1.11.0` constraint.
2. **`/tmp` is a small RAM-backed tmpfs (~450MB) on this AMI.** Extracting
   torch's shared libraries into it failed with `Disk quota exceeded` —
   confusing, since `df -h /` showed plenty of room; the actual constraint was
   tmpfs size, not disk space. Fixed by pointing `TMPDIR` at a directory on the
   real disk before running any installer.
3. **`node_modules` doesn't need to survive the build.** nginx serves the
   static `dist/` output; no node process runs at runtime. Deleting
   `node_modules` after `npm run build` claws back real space on a disk this
   tight (~75MB in this case — meaningful when down to a few hundred MB free).
4. **Home directories are usually `750`.** `nginx`'s `www-data` user got
   `Permission denied` on every `stat()` trying to serve
   `/home/ubuntu/shopforge-ai/frontend/dist/index.html` — not because of the
   file's own permissions, but because `www-data` can't even traverse into
   `/home/ubuntu` in the first place. The fix is **not** to loosen the home
   directory; copy the build output to a normal web root instead
   (`/var/www/shopforge/dist`, owned by `www-data`) and point nginx there.
   `setup_ec2.sh` does this automatically; re-run that copy step after any
   frontend rebuild, since nginx serves the copy, not the repo checkout.

## Known constraints on this tier

- **1GB RAM + 1GB swap is tight, not comfortable.** On the verified deployment,
  steady-state after warm-up was ~680MB RAM + ~545MB swap in use, with the root
  disk at 96% (~330MB free) after everything was installed. There is very
  little headroom left for concurrent load or a second deploy attempt without
  cleaning up first.
- **Single worker only** (see `shopforge.service`) — concurrent requests queue
  rather than running in parallel. Fine for a demo link, not for real traffic.
- **No HTTPS** in this config — raw IP, http only. Add a domain + `certbot --nginx`
  later if wanted.
- **No auto-restart on OOM beyond systemd's `Restart=on-failure`.** If it does get
  OOM-killed, `journalctl -u shopforge -n 50` is the first place to look.
