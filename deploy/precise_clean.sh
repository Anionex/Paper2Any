#!/bin/bash
# Git 仓库精确清理脚本

set -e

echo "=== Git 仓库精确清理 ==="
echo ""
echo "将删除："
echo "  1. .git_disabled/ 目录 (35MB)"
echo "  2. 二进制库文件 *.so (26MB)"
echo "  3. static/paper2any_imgs/ (9MB)"
echo ""
echo "预计减少约 70MB"
echo ""

cd "$(dirname "$0")/.." || exit 1

echo "步骤 1/3: 删除 .git_disabled/ ..."
git filter-repo --path .git_disabled/ --invert-paths --force

echo ""
echo "步骤 2/3: 删除 *.so 文件..."
git filter-repo --path-glob '*.so' --path-glob '*.so.*' --invert-paths --force

echo ""
echo "步骤 3/3: 删除 static/paper2any_imgs/ ..."
git filter-repo --path static/paper2any_imgs/ --invert-paths --force

echo ""
echo "清理和压缩..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

NEW_SIZE=$(du -sh .git | cut -f1)
echo ""
echo "✅ 清理完成！新大小: $NEW_SIZE"
