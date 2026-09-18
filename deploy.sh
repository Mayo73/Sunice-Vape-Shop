#!/usr/bin/env bash
#
# Sunice Vape Shop -- one-command setup for a fresh Linux server.
#
#   ./deploy.sh                 interactive: asks how to serve, then deploys
#   ./deploy.sh --ip            serve over plain HTTP on this server's IP
#   ./deploy.sh --domain X      serve X over automatic HTTPS (needs DNS)
#   ./deploy.sh --update        pull the latest code and rebuild
#
# Safe to re-run. It never overwrites an existing .env without asking.

set -euo pipefail

cd "$(dirname "$0")"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; OFF=$'\033[0m'
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s==>%s %s\n' "$BOLD" "$OFF" "$*"; }
ok()   { printf '%s  ok%s %s\n' "$GREEN" "$OFF" "$*"; }
warn() { printf '%s  !!%s %s\n' "$YELLOW" "$OFF" "$*"; }
die()  { printf '%s error:%s %s\n' "$RED" "$OFF" "$*" >&2; exit 1; }

MODE=""; DOMAIN=""; UPDATE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --ip)     MODE=ip ;;
    --domain) MODE=domain; DOMAIN="${2:-}"; shift; [ -n "$DOMAIN" ] || die "--domain needs a hostname" ;;
    --update) UPDATE=1 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

[ "$(id -u)" -eq 0 ] || command -v sudo >/dev/null 2>&1 || \
  die "run this as root, or install sudo"
SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"

# ---------------------------------------------------------------- docker
step "Checking Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "Docker and the compose plugin are installed"
else
  warn "Docker (with the compose plugin) was not found."
  say  "    This script can install it from https://get.docker.com -- the official"
  say  "    convenience script, which adds Docker's package repository and installs"
  say  "    docker-ce. It changes system packages on this machine."
  printf '    Install Docker now? [y/N] '
  read -r reply </dev/tty || reply=""
  case "$reply" in
    [yY]*)
      curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
      $SUDO sh /tmp/get-docker.sh
      rm -f /tmp/get-docker.sh
      docker compose version >/dev/null 2>&1 || die "compose plugin still missing after install"
      ok "Docker installed"
      ;;
    *) die "Docker is required. Install it and run this script again." ;;
  esac
fi
$SUDO docker info >/dev/null 2>&1 || die "the Docker daemon is not running (try: $SUDO systemctl start docker)"

# ---------------------------------------------------------------- update path
if [ "$UPDATE" -eq 1 ]; then
  step "Pulling the latest code"
  git pull --ff-only
  [ -f .env ] || die ".env is missing -- run ./deploy.sh without --update first"
  step "Rebuilding"
  $SUDO docker compose up -d --build
  ok "Updated"
  exit 0
fi

# ---------------------------------------------------------------- how to serve
if [ -z "$MODE" ]; then
  step "How should the shop be served?"
  say "    1) Plain HTTP on this server's IP  -- works right now, no DNS needed"
  say "       ${DIM}Admins type the meeting point; the phone-location button needs HTTPS.${OFF}"
  say "    2) A domain with automatic HTTPS   -- needs DNS pointing here already"
  printf '    Choose [1/2]: '
  read -r choice </dev/tty || choice=1
  case "$choice" in
    2) MODE=domain
       printf '    Domain (e.g. vape.mlevo.de): '
       read -r DOMAIN </dev/tty
       [ -n "$DOMAIN" ] || die "no domain given" ;;
    *) MODE=ip ;;
  esac
fi

if [ "$MODE" = domain ]; then
  SITE_ADDRESS="$DOMAIN"
  step "Checking DNS for $DOMAIN"
  # Best effort: a mismatch here is the single most common reason the
  # certificate never arrives, so it is worth saying out loud before starting.
  PUBLIC_IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '')"
  RESOLVED="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || echo '')"
  if [ -z "$RESOLVED" ]; then
    warn "$DOMAIN does not resolve yet. Caddy cannot get a certificate until it does."
  elif [ -n "$PUBLIC_IP" ] && [ "$RESOLVED" != "$PUBLIC_IP" ]; then
    warn "$DOMAIN resolves to $RESOLVED but this server looks like $PUBLIC_IP."
    say  "    If the domain is on Cloudflare, set that record to \"DNS only\" (grey cloud)."
    say  "    With the proxy on, the certificate check cannot complete."
  else
    ok "$DOMAIN resolves to this server"
  fi
else
  SITE_ADDRESS=":80"
fi

# ---------------------------------------------------------------- .env
step "Writing configuration"
if [ -f .env ]; then
  warn ".env already exists."
  printf '    Overwrite it? [y/N] '
  read -r reply </dev/tty || reply=""
  case "$reply" in
    [yY]*) ;;
    *) say "    Keeping the existing .env."; KEEP_ENV=1 ;;
  esac
fi

if [ "${KEEP_ENV:-0}" -ne 1 ]; then
  [ -f .env.example ] || die ".env.example is missing"
  # Take the defaults from the example file, then set the mode we just chose.
  sed -E "s|^SITE_ADDRESS=.*|SITE_ADDRESS=${SITE_ADDRESS}|" .env.example > .env
  ok "Wrote .env (SITE_ADDRESS=${SITE_ADDRESS})"
fi

grep -q '^VITE_SUPABASE_URL=https://' .env || die "VITE_SUPABASE_URL is not set in .env"

# ---------------------------------------------------------------- build and run
step "Building and starting (first run pulls images, give it a few minutes)"
if ! $SUDO docker compose up -d --build; then
  say ""
  die "$(cat <<'MSG'
the build did not finish. The usual causes, in order:

      - no internet, or a firewall blocking registry-1.docker.io
        test with: docker pull hello-world
      - port 80 or 443 already in use by another web server
        test with: ss -ltnp | grep -E ':80|:443'
        fix by stopping it, or set HTTP_PORT/HTTPS_PORT in .env
      - not enough disk space
        test with: df -h /var/lib/docker

    The full error is printed above.
MSG
)"
fi

# ---------------------------------------------------------------- health check
step "Checking that it answers"
# `|| true` matters: under `set -e` a grep that matches nothing would otherwise
# end the script here instead of falling back to the default port.
PORT="$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 || true)"; PORT="${PORT:-80}"
CODE=""
for _ in $(seq 1 30); do
  CODE="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/" 2>/dev/null || echo '')"
  [ "$CODE" = "200" ] && break
  sleep 2
done

if [ "$CODE" = "200" ]; then
  ok "The shop is serving"
else
  warn "No answer on http://127.0.0.1:${PORT}/ yet (last status: ${CODE:-none})."
  say  "    Check the logs with: $SUDO docker compose logs -f web"
fi

IP="${PUBLIC_IP:-$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo 'your-server-ip')}"
step "Done"
if [ "$MODE" = domain ]; then
  say "    Shop:  https://${DOMAIN}/"
  say "    Admin: https://${DOMAIN}/303"
  say ""
  say "    ${DIM}The certificate is fetched on first request and can take a few seconds.${OFF}"
  say "    ${DIM}If it does not appear, check DNS and that ports 80 and 443 are open.${OFF}"
else
  say "    Shop:  http://${IP}/"
  say "    Admin: http://${IP}/303"
  say ""
  say "    ${DIM}Switch to your domain later with: ./deploy.sh --domain vape.mlevo.de${OFF}"
fi
say ""
say "    Add your first items under /303 -> Items."
