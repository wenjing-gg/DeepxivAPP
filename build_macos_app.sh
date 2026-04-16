#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT_DIR/.venv" ]; then
  echo "Python 环境不存在，请先运行: ./scripts/setup_python.sh"
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Node 依赖不存在，请先运行: npm install"
  exit 1
fi

export DEEPXIV_PROJECT_ROOT="$ROOT_DIR"
source "$ROOT_DIR/.venv/bin/activate"
npm run build:mac
