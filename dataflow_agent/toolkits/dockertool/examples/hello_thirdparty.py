"""
一个依赖第三方库的示例脚本：使用 pandas 和 numpy。
运行后应打印 pandas/numpy 版本、简单数据处理结果。
"""

import sys
import platform
from datetime import datetime
from dataflow_agent.logger import get_logger

import numpy as np
import pandas as pd

log = get_logger(__name__)


def main():
    log.info(f"[hello_thirdparty] 启动时间: {datetime.now().isoformat()}")
    log.info(f"[hello_thirdparty] Python: {sys.version.replace(chr(10), ' ')}")
    log.info(f"[hello_thirdparty] 平台: {platform.platform()}")
    log.info(f"[hello_thirdparty] numpy: {np.__version__}")
    log.info(f"[hello_thirdparty] pandas: {pd.__version__}")

    # 构造一个简单的 DataFrame 并做一次计算
    df = pd.DataFrame({"a": np.arange(5), "b": np.arange(5) ** 2})
    df["c"] = df["a"] + df["b"]
    log.info("[hello_thirdparty] DataFrame head:\n" + df.head().to_string(index=False))

    log.info("[hello_thirdparty] 脚本运行完成，准备退出。")
    abc

if __name__ == "__main__":
    main()
