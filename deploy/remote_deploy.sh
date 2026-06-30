#!/usr/bin/env bash
#
# remote_deploy.sh — runs ON the EC2 server, from the repo root, AFTER the
# GitHub Actions workflow has already done `git reset --hard origin/main`.
# Idempotent: safe to run repeatedly.
#
# Env:
#   SERVICE   systemd unit name to restart (default: debtclear)
#
set -euo pipefail

SERVICE="${SERVICE:-debtclear}"
echo "==> Deploying $(git rev-parse --short HEAD) on $(hostname) [service: $SERVICE]"

# 1. Activate the virtualenv created during one-time server setup (see DEPLOY.md).
if [ -f venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
else
  echo "ERROR: no venv at $(pwd)/venv — run the one-time setup in DEPLOY.md first." >&2
  exit 1
fi

# 2. Sync dependencies (no-op when requirements are unchanged).
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

# 3. Collect static assets (served by WhiteNoise).
python manage.py collectstatic --noinput

# 4. Fail fast on configuration errors before swapping the running process.
python manage.py check

# 5. Restart gunicorn (needs the narrow passwordless-sudo rule from DEPLOY.md).
sudo systemctl restart "$SERVICE"
sleep 1

# 6. Confirm it actually came back up; surface logs if it didn't.
if systemctl is-active --quiet "$SERVICE"; then
  echo "==> $SERVICE is active. Deploy complete: $(git rev-parse --short HEAD)"
else
  echo "ERROR: $SERVICE failed to start. Recent logs:" >&2
  sudo journalctl -u "$SERVICE" --no-pager --lines 30 >&2
  exit 1
fi
