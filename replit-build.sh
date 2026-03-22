#!/usr/bin/env bash
set -euo pipefail

npm ci --omit=optional
python3 -m pip install --upgrade pip
python3 -m pip install .
python3 -m playwright install chromium || python3 -m playwright install --with-deps chromium || true
crawl4ai-setup || true
npm run build
