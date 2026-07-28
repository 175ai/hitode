#!/usr/bin/env bash
set -euo pipefail

cd /home/kj/hitode

git add .
git commit -m "${1:-update}"
git push -u origin main