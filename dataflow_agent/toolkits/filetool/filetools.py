"""
文件操作工具模块

提供文件内容读取和目录内容查看功能，支持跨平台（Windows/Linux）。
所有操作以项目根目录为边界，不允许访问根目录之外的文件。
"""
from __future__ import annotations

import os
import platform
import subprocess
from pathlib import Path
from typing import Optional, List, Union, Dict, Any

from langchain_core.tools import tool
from dataflow_agent.logger import get_logger
import dataflow_agent.utils as utils

log = get_logger(__name__)

# 获取项目根目录
PROJECT_ROOT = utils.get_project_root()


def _is_path_within_project(path: Path) -> bool:
    """
    检查路径是否在项目根目录内
    
    Args:
        path: 要检查的路径
        
    Returns:
        bool: 如果路径在项目根目录内返回 True，否则返回 False
    """
    try:
        resolved_path = path.resolve()
        resolved_root = PROJECT_ROOT.resolve()
        # 检查路径是否以项目根目录开头
        return str(resolved_path).startswith(str(resolved_root))
    except Exception as e:
        log.warning(f"路径检查失败: {e}")
        return False


def _resolve_path(path_str: str) -> Path:
    """
    解析路径，支持相对路径和绝对路径
    
    Args:
        path_str: 路径字符串
        
    Returns:
        Path: 解析后的路径对象
    """
    path = Path(path_str)
    if not path.is_absolute():
        # 相对路径基于项目根目录
        path = PROJECT_ROOT / path
    return path.resolve()


def read_file_content(
    file_path: str,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
    encoding: str = "utf-8"
) -> Dict[str, Any]:
    """
    读取文件内容
    
    Args:
        file_path: 文件路径（相对于项目根目录或绝对路径）
        start_line: 起始行号（从1开始，可选）
        end_line: 结束行号（包含，可选）
        encoding: 文件编码，默认 utf-8
        
    Returns:
        Dict 包含:
            - success: 是否成功
            - content: 文件内容（成功时）
            - total_lines: 文件总行数（成功时）
            - read_lines: 实际读取的行范围 [start, end]（成功时）
            - error: 错误信息（失败时）
    """
    try:
        path = _resolve_path(file_path)
        
        # 安全检查：确保路径在项目根目录内
        if not _is_path_within_project(path):
            return {
                "success": False,
                "error": f"安全限制：不允许访问项目根目录之外的文件。项目根目录: {PROJECT_ROOT}"
            }
        
        # 检查文件是否存在
        if not path.exists():
            return {
                "success": False,
                "error": f"文件不存在: {path}"
            }
        
        # 检查是否为文件
        if not path.is_file():
            return {
                "success": False,
                "error": f"路径不是文件: {path}"
            }
        
        # 读取文件内容
        try:
            with open(path, 'r', encoding=encoding) as f:
                lines = f.readlines()
        except UnicodeDecodeError:
            return {
                "success": False,
                "error": f"文件编码错误，无法使用 {encoding} 编码读取。请尝试其他编码或确认文件为文本文件。"
            }
        
        total_lines = len(lines)
        
        # 处理行号范围
        actual_start = 1
        actual_end = total_lines
        
        if start_line is not None:
            if start_line < 1:
                start_line = 1
            actual_start = min(start_line, total_lines)
        
        if end_line is not None:
            if end_line < 1:
                end_line = 1
            actual_end = min(end_line, total_lines)
        
        # 确保 start <= end
        if actual_start > actual_end:
            actual_start, actual_end = actual_end, actual_start
        
        # 提取指定行范围的内容（行号从1开始，索引从0开始）
        selected_lines = lines[actual_start - 1:actual_end]
        content = ''.join(selected_lines)
        
        log.info(f"[read_file_content] 成功读取文件: {path}, 行范围: {actual_start}-{actual_end}/{total_lines}")
        
        return {
            "success": True,
            "content": content,
            "total_lines": total_lines,
            "read_lines": [actual_start, actual_end],
            "file_path": str(path)
        }
        
    except Exception as e:
        log.error(f"[read_file_content] 读取文件失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def list_directory_content(
    dir_path: str,
    show_hidden: bool = False,
    recursive: bool = False,
    max_depth: int = 1
) -> Dict[str, Any]:
    """
    查看目录内容，支持 Windows 和 Linux
    
    Args:
        dir_path: 目录路径（相对于项目根目录或绝对路径）
        show_hidden: 是否显示隐藏文件，默认 False
        recursive: 是否递归显示子目录，默认 False
        max_depth: 递归最大深度（仅当 recursive=True 时有效），默认 1
        
    Returns:
        Dict 包含:
            - success: 是否成功
            - content: 目录内容（成功时）
            - path: 目录绝对路径（成功时）
            - error: 错误信息（失败时）
    """
    try:
        path = _resolve_path(dir_path)
        
        # 安全检查：确保路径在项目根目录内
        if not _is_path_within_project(path):
            return {
                "success": False,
                "error": f"安全限制：不允许访问项目根目录之外的目录。项目根目录: {PROJECT_ROOT}"
            }
        
        # 检查目录是否存在
        if not path.exists():
            return {
                "success": False,
                "error": f"目录不存在: {path}"
            }
        
        # 检查是否为目录
        if not path.is_dir():
            return {
                "success": False,
                "error": f"路径不是目录: {path}"
            }
        
        # 根据操作系统选择命令
        system = platform.system().lower()
        
        if system == "windows":
            # Windows 使用 dir 命令
            cmd = ["cmd", "/c", "dir"]
            if show_hidden:
                cmd.append("/a")  # 显示所有文件包括隐藏文件
            if recursive:
                cmd.append("/s")  # 递归显示
            cmd.append(str(path))
        else:
            # Linux/macOS 使用 ls 命令
            cmd = ["ls", "-l"]
            if show_hidden:
                cmd.append("-a")  # 显示隐藏文件
            if recursive:
                cmd.append("-R")  # 递归显示
            cmd.append(str(path))
        
        # 执行命令
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(path.parent)  # 在父目录执行，避免路径问题
            )
            
            output = result.stdout
            if result.returncode != 0 and result.stderr:
                output += f"\n[stderr]: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "命令执行超时（30秒）"
            }
        except FileNotFoundError as e:
            # 如果命令不存在，使用 Python 原生方式
            log.warning(f"系统命令不可用，使用 Python 原生方式: {e}")
            output = _list_directory_python(path, show_hidden, recursive, max_depth)
        
        log.info(f"[list_directory_content] 成功列出目录: {path}")
        
        return {
            "success": True,
            "content": output,
            "path": str(path),
            "system": system
        }
        
    except Exception as e:
        log.error(f"[list_directory_content] 列出目录失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def _list_directory_python(
    path: Path,
    show_hidden: bool = False,
    recursive: bool = False,
    max_depth: int = 1,
    current_depth: int = 0,
    prefix: str = ""
) -> str:
    """
    使用 Python 原生方式列出目录内容（备用方案）
    
    Args:
        path: 目录路径
        show_hidden: 是否显示隐藏文件
        recursive: 是否递归
        max_depth: 最大递归深度
        current_depth: 当前深度
        prefix: 输出前缀（用于缩进）
        
    Returns:
        str: 格式化的目录内容
    """
    lines = []
    
    if current_depth == 0:
        lines.append(f"目录: {path}")
        lines.append("-" * 60)
    
    try:
        entries = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        
        for entry in entries:
            # 跳过隐藏文件（如果不显示）
            if not show_hidden and entry.name.startswith('.'):
                continue
            
            # 获取文件信息
            try:
                stat = entry.stat()
                size = stat.st_size
                is_dir = entry.is_dir()
                
                # 格式化大小
                if is_dir:
                    size_str = "<DIR>"
                elif size < 1024:
                    size_str = f"{size}B"
                elif size < 1024 * 1024:
                    size_str = f"{size / 1024:.1f}KB"
                else:
                    size_str = f"{size / (1024 * 1024):.1f}MB"
                
                # 格式化输出
                type_indicator = "📁" if is_dir else "📄"
                lines.append(f"{prefix}{type_indicator} {entry.name:<40} {size_str:>10}")
                
                # 递归处理子目录
                if recursive and is_dir and current_depth < max_depth:
                    sub_content = _list_directory_python(
                        entry,
                        show_hidden,
                        recursive,
                        max_depth,
                        current_depth + 1,
                        prefix + "  "
                    )
                    lines.append(sub_content)
                    
            except PermissionError:
                lines.append(f"{prefix}⚠️ {entry.name:<40} [权限不足]")
            except Exception as e:
                lines.append(f"{prefix}⚠️ {entry.name:<40} [错误: {e}]")
                
    except PermissionError:
        lines.append(f"{prefix}[权限不足，无法读取目录]")
    except Exception as e:
        lines.append(f"{prefix}[错误: {e}]")
    
    return "\n".join(lines)


# ==================== LangChain Tool 封装 ====================

@tool
def read_text_file(
    file_path: str,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None
) -> str:
    """
    读取文本文件内容。
    
    支持读取项目内的任意文本文件，可指定读取的行范围。
    出于安全考虑，只能读取项目根目录内的文件。
    
    Args:
        file_path: 文件路径，可以是相对路径（相对于项目根目录）或绝对路径
        start_line: 起始行号（从1开始，可选）。不指定则从第1行开始
        end_line: 结束行号（包含，可选）。不指定则读取到文件末尾
    
    Returns:
        JSON 格式的结果，包含文件内容或错误信息
    
    Examples:
        >>> read_text_file("README.md")  # 读取整个文件
        >>> read_text_file("src/main.py", start_line=10, end_line=20)  # 读取第10-20行
        >>> read_text_file("config.yaml", end_line=50)  # 读取前50行
    """
    import json
    result = read_file_content(file_path, start_line, end_line)
    return json.dumps(result, ensure_ascii=False, indent=2)


@tool
def list_directory(
    dir_path: str,
    show_hidden: bool = False,
    recursive: bool = False
) -> str:
    """
    查看目录内容。
    
    列出指定目录下的文件和子目录，支持 Windows 和 Linux 系统。
    出于安全考虑，只能查看项目根目录内的目录。
    
    Args:
        dir_path: 目录路径，可以是相对路径（相对于项目根目录）或绝对路径
        show_hidden: 是否显示隐藏文件（以.开头的文件），默认 False
        recursive: 是否递归显示子目录内容，默认 False
    
    Returns:
        JSON 格式的结果，包含目录内容或错误信息
    
    Examples:
        >>> list_directory(".")  # 列出项目根目录
        >>> list_directory("src", show_hidden=True)  # 列出 src 目录，包含隐藏文件
        >>> list_directory("dataflow_agent", recursive=True)  # 递归列出目录
    """
    import json
    result = list_directory_content(dir_path, show_hidden, recursive)
    return json.dumps(result, ensure_ascii=False, indent=2)


# ==================== 直接调用的函数接口 ====================

def local_tool_read_file(
    file_path: str,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
    encoding: str = "utf-8"
) -> Dict[str, Any]:
    """
    本地工具：读取文件内容
    
    直接返回字典结果，适合在代码中直接调用。
    
    Args:
        file_path: 文件路径
        start_line: 起始行号（从1开始，可选）
        end_line: 结束行号（包含，可选）
        encoding: 文件编码
        
    Returns:
        Dict: 包含 success, content/error 等字段
    """
    return read_file_content(file_path, start_line, end_line, encoding)


def local_tool_list_directory(
    dir_path: str,
    show_hidden: bool = False,
    recursive: bool = False,
    max_depth: int = 1
) -> Dict[str, Any]:
    """
    本地工具：列出目录内容
    
    直接返回字典结果，适合在代码中直接调用。
    
    Args:
        dir_path: 目录路径
        show_hidden: 是否显示隐藏文件
        recursive: 是否递归
        max_depth: 递归最大深度
        
    Returns:
        Dict: 包含 success, content/error 等字段
    """
    return list_directory_content(dir_path, show_hidden, recursive, max_depth)


# ==================== 测试代码 ====================

if __name__ == "__main__":
    import json
    
    log.info("=" * 60)
    log.info("文件工具测试")
    log.info("=" * 60)
    
    # 测试1：读取文件
    log.info("--- 测试1：读取 README.md ---")
    result = read_file_content("README.md", end_line=10)
    log.info(json.dumps(result, ensure_ascii=False, indent=2))
    
    # 测试2：读取指定行范围
    log.info("--- 测试2：读取文件指定行 ---")
    result = read_file_content("dataflow_agent/utils.py", start_line=1, end_line=20)
    log.info(json.dumps(result, ensure_ascii=False, indent=2))
    
    # 测试3：列出目录
    log.info("--- 测试3：列出项目根目录 ---")
    result = list_directory_content(".")
    log.info(json.dumps(result, ensure_ascii=False, indent=2))
    
    # 测试4：递归列出目录
    log.info("--- 测试4：递归列出 toolkits 目录 ---")
    result = list_directory_content("dataflow_agent/toolkits", recursive=True)
    log.info(json.dumps(result, ensure_ascii=False, indent=2))
    
    # 测试5：安全检查 - 尝试访问项目外的路径
    log.info("--- 测试5：安全检查（访问项目外路径）---")
    result = read_file_content("/etc/passwd")
    log.info(json.dumps(result, ensure_ascii=False, indent=2))
    
    log.info("=" * 60)
    log.info("测试完成")
    log.info("=" * 60)
