#!/bin/bash
# FastAPI 应用重启脚本

echo "Restarting FastAPI app..."
./deploy/stop.sh
sleep 2
./deploy/start.sh
