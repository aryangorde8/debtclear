# Deploying DebtClear to AWS EC2 with CI/CD

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. **check** — installs deps and runs `python manage.py check` + `collectstatic` so a broken build never reaches production.
2. **deploy** — SSHes into your EC2 box, runs `git reset --hard origin/main`, then [`deploy/remote_deploy.sh`](deploy/remote_deploy.sh) (sync deps → collectstatic → check → `systemctl restart`).

```
 git push main ─▶ GitHub Actions ─▶ ssh ec2 ─▶ git reset --hard ─▶ pip install
                                                      └▶ collectstatic ─▶ restart gunicorn ─▶ live
```

You run the **one-time setup** below once. After that it's fully automatic.

---

## What you do once (the credentialed steps)

Everything here uses **your** AWS console + GitHub — none of it is in the repo, and you should never paste the SSH private key or AWS keys into a chat.

### 1. Server: point it at this repo and make it deployable

SSH into your EC2 box (the one behind `debtclear.aryangorde.com`) and, from the app directory:

```bash
# Assuming the existing clone lives at ~/debtclear. (Fresh box? See "Fresh server" below.)
cd ~/debtclear

# Point the server's clone at the NEW repo (we moved debtclearr -> debtclear)
git remote set-url origin https://github.com/aryangorde8/debtclear.git
git fetch origin && git reset --hard origin/main

# Make sure a virtualenv with deps exists (one-time)
python3 -m venv venv          # needs python3-venv: sudo apt install -y python3-venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### 2. Server: allow the deploy to restart gunicorn without a password

The deploy script runs `sudo systemctl restart debtclear`. Grant *only* that:

```bash
echo "$USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart debtclear, /usr/bin/systemctl is-active debtclear, /usr/bin/journalctl -u debtclear *" \
  | sudo tee /etc/sudoers.d/debtclear-deploy
sudo chmod 440 /etc/sudoers.d/debtclear-deploy
```

(Confirm the systemd unit exists — your live site implies it does. If not, install [`deploy/debtclear.service`](deploy/debtclear.service) and [`deploy/nginx.conf`](deploy/nginx.conf) per the comments in those files.)

### 3. Create a dedicated deploy SSH key

On your **laptop** (not the server), generate a keypair just for CI:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/debtclear_deploy -N "" -C "github-actions-deploy"
```

Add the **public** key to the server's deploy user:

```bash
ssh-copy-id -i ~/.ssh/debtclear_deploy.pub <user>@<ec2-host>
# or append ~/.ssh/debtclear_deploy.pub to ~/.ssh/authorized_keys on the box
```

### 4. Add the GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name    | Value                                                        | Required |
|----------------|-------------------------------------------------------------|----------|
| `EC2_HOST`     | public IP or DNS of the box (e.g. `debtclear.aryangorde.com`)| ✅ |
| `EC2_USER`     | SSH user — `ubuntu` (Ubuntu) or `ec2-user` (Amazon Linux)   | ✅ |
| `EC2_SSH_KEY`  | **contents of the PRIVATE key** `~/.ssh/debtclear_deploy`    | ✅ |
| `APP_DIR`      | app path if **not** `/home/ubuntu/debtclear`                 | optional |
| `SERVICE_NAME` | systemd unit if **not** `debtclear`                          | optional |

Or with the GitHub CLI:

```bash
gh secret set EC2_HOST     -b"debtclear.aryangorde.com" -R aryangorde8/debtclear
gh secret set EC2_USER     -b"ubuntu"                   -R aryangorde8/debtclear
gh secret set EC2_SSH_KEY  < ~/.ssh/debtclear_deploy    -R aryangorde8/debtclear
# gh secret set APP_DIR    -b"/home/ec2-user/debtclear" -R aryangorde8/debtclear   # if needed
```

### 5. Let the runner reach the box on port 22

In the EC2 **Security Group**, allow inbound **TCP 22**. GitHub-hosted runners use rotating IPs, so either allow `0.0.0.0/0` on 22 **with password auth disabled (key-only)**, or restrict to GitHub's published ranges. Password auth off:

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh   # 'sshd' on Amazon Linux
```

> More locked-down option (no inbound SSH at all): deploy via AWS SSM Run Command using GitHub OIDC. Heavier setup — ask if you want that variant instead.

---

## Verify it works

```bash
# trigger a deploy
git commit --allow-empty -m "ci: test auto-deploy" && git push origin main
```

Watch repo → **Actions** → the run should go **check → deploy** green, then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://debtclear.aryangorde.com/   # 200
curl -s https://debtclear.aryangorde.com/api/health/                         # {"status":"ok"}
```

You can also trigger a deploy by hand from the **Actions** tab → *CI/CD · Deploy to EC2* → **Run workflow**.

---

## Fresh server (only if you're starting from nothing)

```bash
sudo apt update && sudo apt install -y python3-venv nginx git
sudo adduser --disabled-password --gecos "" ubuntu   # if needed
git clone https://github.com/aryangorde8/debtclear.git ~/debtclear
cd ~/debtclear && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
cp .env.example .env && nano .env          # set DJANGO_SECRET_KEY, GROQ_API_KEYS, DJANGO_ALLOWED_HOSTS
python manage.py collectstatic --noinput
sudo cp deploy/debtclear.service /etc/systemd/system/ && sudo systemctl enable --now debtclear
sudo cp deploy/nginx.conf /etc/nginx/sites-available/debtclear
sudo ln -sf /etc/nginx/sites-available/debtclear /etc/nginx/sites-enabled/debtclear
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d debtclear.aryangorde.com    # TLS
```
Then do steps 2–5 above.

---

## Notes

- **Set `GROQ_API_KEYS` in the server's `.env`** or the AI advisor stays in deterministic offline-fallback mode.
- The app has **no database** (`DATABASES = {}`), so there are no migrations to run.
- `git reset --hard origin/main` makes the server match the pushed commit exactly — local edits on the box are discarded by design. Make changes via git, not on the server.
