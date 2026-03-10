#!/bin/bash
# SLIDE_DIR="$1"
# VIDEO_DIR="$2"
# OUTPUT_DIR="$3"
# width="$4"
# height="$5"
# num_video="$6"
# VIDEO_PATH="$7"
# ref_img="$8"
# mkdir -p "$OUTPUT_DIR"
# > list.txt

# for i in $(seq 1 "$num_video"); do
#   slide_path="$SLIDE_DIR/$i.png"
#   # video_path="$VIDEO_DIR/$((i-1))/"$ref_img"/merge_video.mp4"
#   video_path="$VIDEO_DIR/$((i-1))/digit_person_withaudio.mp4"
#   output_path="$OUTPUT_DIR/page_$(printf "%03d" "$i").mp4"

#   if [[ ! -f "$slide_path" || ! -f "$video_path" ]]; then
#     echo "❌ Skip $i: missing slide or video"
#     continue
#   fi

#   has_audio=$(ffprobe -v error -select_streams a -show_entries stream=codec_type \
#     -of default=noprint_wrappers=1:nokey=1 "$video_path")

#   if [[ -z "$has_audio" ]]; then
#     echo "⚠️ Skip $i: no audio stream"
#     continue
#   fi

#   duration=$(ffprobe -v error -show_entries format=duration \
#     -of default=noprint_wrappers=1:nokey=1 "$video_path")

#   echo "✅ Processing $i..."

#   # 原始的指令
#   # ffmpeg -y \
#   #   -loop 1 -t "$duration" -i "$slide_path" \
#   #   -i "$video_path" \
#   #   -filter_complex "[1:v]scale="$width":"$height"[avatar];[0:v][avatar]overlay=W-w-10:10[outv]" \
#   #   -map "[outv]" -map 1:a -c:v libx264 -c:a aac -preset fast -crf 23 \
#   #   -shortest "$output_path"
  
#   # 新的指令
#   ffmpeg -y \
#   -loop 1 -t "$duration" -i "$slide_path" \
#   -i "$video_path" \
#   -filter_complex "[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2[bg];[1:v]scale=${width}:${height}[avatar];[bg][avatar]overlay=W-w-10:10,format=yuv420p[outv]" \
#   -map "[outv]" -map 1:a -c:v libx264 -c:a aac -preset ultrafast -crf 23 \
#   -shortest "$output_path"


#   echo "file '$output_path'" >> list.txt
# done

SLIDE_DIR="$1"
VIDEO_DIR="$2"
OUTPUT_DIR="$3"
width="$4"
height="$5"
num_video="$6"
VIDEO_PATH="$7"

mkdir -p "$OUTPUT_DIR"
> list.txt

for i in $(seq 1 "$num_video"); do
  slide_path="$SLIDE_DIR/$i.png"
  video_path="$VIDEO_DIR/$((i-1))/digit_person_withaudio.mp4"
  output_path="$OUTPUT_DIR/page_$(printf "%03d" "$i").mp4"

  [[ ! -f "$slide_path" || ! -f "$video_path" ]] && continue

  # 使用ffprobe测量视频有多长，然后让静态图片也显示这么久
  duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$video_path")
  echo "🎬 Processing Page $i..."

  # --- 核心逻辑说明 ---
  # 1. [0:v] 强制缩放并填充背景到 1920x1080，避免 8K 压死 CPU
  # 2. [1:v] 动态计算人像高度为背景的 $AVATAR_HEIGHT_RATIO，宽度自适应
  # 3. 使用 ultrafast 预设和 crf 28（稍微牺牲一点体积换取极致速度）

  echo "🎬 Encoding Video..."
  ffmpeg -y \
    -loop 1 -t "$duration" -i "$slide_path" \
    -i "$video_path" \
    -filter_complex \
    "[1:v]scale="$width":"$height"[avatar]; \
    [0:v][avatar]overlay=W-w-10:10,format=yuv420p[outv]" \
    -map "[outv]" -map 1:a \
    -c:v h264_nvenc -preset p3 -tune hq -cq 28 \
    -c:a copy -shortest "$output_path"

    echo "file '$output_path'" >> list.txt
  done

# 合并所有片段
if [[ -s list.txt ]]; then
  ffmpeg -y -f concat -safe 0 -i list.txt -c copy "$VIDEO_PATH"
  echo "✅ 所有视频已成功合并至: $VIDEO_PATH"
else
  echo "❌ 失败：没有生成的片段可供合并"
fi