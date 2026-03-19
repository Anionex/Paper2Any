#!/bin/bash

# Shared FastAPI runtime config for deploy scripts.
# Environment variables can override these defaults.

APP_PORT="${APP_PORT:-8000}"
APP_WORKERS="${APP_WORKERS:-2}"
APP_CONDA_ENV="${APP_CONDA_ENV:-}"
APP_PYTHON="${APP_PYTHON:-}"
CONDA_SH="${CONDA_SH:-/root/miniconda3/etc/profile.d/conda.sh}"
