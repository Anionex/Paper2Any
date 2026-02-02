#!/bin/bash
# 日志查看工具

# 切换到项目根目录
cd "$(dirname "$0")/.." || exit 1

case "$1" in
    app|all)
        echo "=== 查看应用日志 ==="
        tail -f logs/app.log
        ;;
    startup)
        echo "=== 查看启动日志 ==="
        tail -f logs/startup.log 2>/dev/null || echo "启动日志不存在"
        ;;
    search)
        if [ -z "$2" ]; then
            echo "用法: ./logs.sh search <关键词>"
            exit 1
        fi
        echo "=== 搜索日志: $2 ==="
        grep -r "$2" logs/
        ;;
    *)
        echo "日志查看工具"
        echo "用法:"
        echo "  ./logs.sh app       - 实时查看应用日志"
        echo "  ./logs.sh startup   - 查看启动日志"
        echo "  ./logs.sh search <关键词> - 搜索日志"
        echo ""
        echo "示例:"
        echo "  ./logs.sh app"
        echo "  ./logs.sh search ERROR"
        ;;
esac
