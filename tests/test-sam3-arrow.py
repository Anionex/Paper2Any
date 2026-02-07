import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import cv2
import numpy as np
from dataflow_agent.toolkits.multimodaltool.sam_tool import run_sam_auto, free_sam_model

# -------------------------- 配置参数（只改这3行！）--------------------------
IMAGE_PATH = "/data/users/pzw/Paper2Any/tests/ori.png"  # 你的图片路径
CHECKPOINT_PATH = "/data/users/pzw/models/sam3/sam3.pt"  # SAM3权重路径
SAVE_RESULT_PATH = "/data/users/pzw/Paper2Any/tests/arrow_detect_result.png"  # 结果保存路径
# ---------------------------------------------------------------------------

# 1. 使用SAM3按文本提示分割【仅所有箭头】（核心改动：添加text_prompt参数）
print("正在加载SAM3模型并识别所有箭头...")
try:
    # 核心修改：增加text_prompt=["all arrows"]，限定仅提取箭头
    items = run_sam_auto(
        IMAGE_PATH, 
        checkpoint=CHECKPOINT_PATH, 
        device="cuda",
        text_prompt=["all arrows"]  # 新增：SAM3文本提示，指定提取所有箭头
    )
except Exception as e:
    print(f"CUDA失败，尝试使用CPU: {e}")
    items = run_sam_auto(
        IMAGE_PATH, 
        checkpoint=CHECKPOINT_PATH, 
        device="cpu",
        text_prompt=["all arrows"]  # CPU模式也需传入提示词
    )
print(f"模型推理完成！共识别到 {len(items)} 个箭头")

# 2. 读取原图
img_cv2 = cv2.imread(IMAGE_PATH)
if img_cv2 is None:
    raise RuntimeError(f"无法读取图片: {IMAGE_PATH}")

# 3. 在原图上绘制箭头的红框标注（原有逻辑完全不变）
for idx, item in enumerate(items):
    mask = item.get("mask")
    if mask is None:
        continue

    # 从掩码中提取轮廓，计算外接矩形（红框）
    mask_uint8 = (mask.astype(np.uint8) * 255)
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        # 画红框：红色(BGR)、线宽2，适配你的图分辨率
        cv2.rectangle(img_cv2, (x, y), (x+w, y+h), (0, 0, 255), 2)

# 4. 保存标注后的结果图
cv2.imwrite(SAVE_RESULT_PATH, img_cv2)
print(f"识别完成！标注后的图片已保存至：{SAVE_RESULT_PATH}")
print(f"共绘制了 {len(items)} 个箭头的边界框")

# 5. 释放模型显存（原有逻辑不变）
free_sam_model(checkpoint=CHECKPOINT_PATH)
print("模型显存已释放")