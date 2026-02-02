#!/bin/bash
# FastAPI 应用停止脚本

# 切换到项目根目录
cd "$(dirname "$0")/.." || exit 1

# 尝试使用 PID 文件停止（支持 uvicorn 和 gunicorn）
for pidfile in logs/uvicorn.pid logs/gunicorn.pid; do
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        echo "Stopping FastAPI app (PID: $PID)..."
        kill -TERM $PID

        # 等待进程结束
        for i in {1..10}; do
            if ! kill -0 $PID 2>/dev/null; then
                echo "FastAPI app stopped successfully"
                rm -f "$pidfile"
                exit 0
            fi
            sleep 1
        done

        # 如果还没停止，强制杀死
        echo "Force killing FastAPI app..."
        kill -9 $PID
        rm -f "$pidfile"
        exit 0
    fi
done

echo "PID file not found. Trying to find process by name..."
pkill -f "uvicorn fastapi_app.main:app" || pkill -f "gunicorn fastapi_app.main:app"
