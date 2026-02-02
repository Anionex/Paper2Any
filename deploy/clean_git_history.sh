#!/bin/bash
# Git 仓库清理脚本 - 从历史中删除大文件

set -e

echo "=== Git 仓库清理工具 ==="
echo ""
echo "⚠️  警告：此操作会改写 Git 历史！"
echo "⚠️  如果有其他协作者，他们需要重新 clone 仓库"
echo ""
read -p "确认继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 0
fi

# 切换到项目根目录
cd "$(dirname "$0")/.." || exit 1

echo ""
echo "步骤 1: 备份当前分支..."
CURRENT_BRANCH=$(git branch --show-current)
git branch backup-before-clean 2>/dev/null || echo "备份分支已存在"

echo ""
echo "步骤 2: 从历史中删除大文件..."
echo "这可能需要几分钟..."

# 删除日志文件
git filter-repo --path-glob '*.log' --path-glob '*.log.*' --invert-paths --force 2>/dev/null || {
    echo "❌ git filter-repo 未安装"
    echo "请安装: pip install git-filter-repo"
    echo ""
    echo "或者使用 BFG Repo-Cleaner:"
    echo "1. 下载 BFG: wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
    echo "2. 运行: java -jar bfg-1.14.0.jar --delete-files '*.log' ."
    exit 1
}

# 删除 outputs 目录
git filter-repo --path outputs/ --invert-paths --force

# 删除 tests/debug_frames 目录
git filter-repo --path tests/debug_frames/ --invert-paths --force

echo ""
echo "步骤 3: 清理和压缩仓库..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "步骤 4: 检查清理结果..."
NEW_SIZE=$(du -sh .git | cut -f1)
echo "✅ 清理完成！"
echo "新的 .git 大小: $NEW_SIZE"
echo ""
echo "如果需要推送到远程仓库:"
echo "  git push origin --force --all"
echo "  git push origin --force --tags"
