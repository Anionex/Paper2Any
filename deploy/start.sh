#!/bin/bash
# FastAPI 应用启动脚本

# 切换到项目根目录
cd "$(dirname "$0")/.." || exit 1

# 确保日志目录存在
mkdir -p logs

# 使用原来的 uvicorn 命令，但改进日志记录
nohup uvicorn fastapi_app.main:app --workers 1 --port 8000 \
  --log-level info \
  > logs/app.log 2>&1 &

echo $! > logs/uvicorn.pid
echo "FastAPI app started with PID: $(cat logs/uvicorn.pid)"
