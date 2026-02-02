#!/bin/bash
# FastAPI 应用重启脚本

echo "Restarting FastAPI app..."
./stop.sh
sleep 2
./start.sh
