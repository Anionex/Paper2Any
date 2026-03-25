# Paper2PPT 架构与开发手册

> 活文档。`paper2ppt` 的接口、状态机、目录约定或恢复逻辑有变化时，应该同步更新这里。

## 1. 模块边界

`paper2ppt` 不是单个接口，而是四段式流程：

1. 输入解析，生成 `pagecontent`
2. 用户在大纲页编辑、增删页、粘贴素材、AI refine
3. 批量生成页面图，支持单页重生成、局部框选编辑、版本历史
4. 导出 PDF / PPTX

当前后端公开接口：

- `POST /api/v1/paper2ppt/page-content`
- `POST /api/v1/paper2ppt/outline-refine`
- `POST /api/v1/paper2ppt/generate`
- `POST /api/v1/paper2ppt/generate-task`
- `GET /api/v1/paper2ppt/tasks/{task_id}`
- `GET /api/v1/paper2ppt/version-history/{encoded_path}/{page_id}`
- `POST /api/v1/paper2ppt/revert-version`
- `POST /api/v1/paper2ppt/assets/upload`

## 2. 分层结构

```text
frontend-workflow/src/components/paper2ppt/*
  -> fastapi_app/routers/paper2ppt.py
    -> fastapi_app/services/paper2ppt_service.py
      -> fastapi_app/workflow_adapters/wa_paper2ppt.py
        -> dataflow_agent/workflow/wf_paper2ppt_parallel_consistent_style.py
          -> outputs/... + outputs/.tasks/paper2ppt/...
```

职责：

- 前端负责四步状态机、草稿恢复、任务恢复、页面选择态、局部编辑交互。
- Router 只做 multipart form 到 schema 的映射。
- Service 负责 `result_path`、URL/本地路径转换、上传素材落盘、参考图复用。
- Workflow adapter 把 FastAPI request 压平成 `Paper2PPTRequest` / `Paper2FigureState`。
- Workflow 负责页面生成、页面复用、局部编辑 prompt、版本化保存和导出。

## 3. 当前关键状态

前端核心容器：

- `frontend-workflow/src/components/paper2ppt/index.tsx`

关键状态：

- `outlineData`
- `generateResults`
- `resultPath`
- `currentSlideIndex`
- `activeTask`
- `slideEditRegion`

新增约定：

- 配置仍写在 `localStorage[paper2ppt-storage]`
- 运行草稿写在 `localStorage[paper2ppt-draft]`
- 草稿包含 `currentStep`、`outlineData`、`generateResults`、`resultPath`、导出结果 URL、进行中的任务

这意味着：

- 浏览器刷新后可以回到大纲/生成/完成页
- 如果异步任务还在跑，会自动继续轮询
- 单页编辑现在也走 `generate-task`，因此刷新后也能续上

## 4. 页面复用与继续生成

这是本次改动里最容易改坏的链路。

当用户从生成页退回大纲再编辑后，前端不会无脑清空所有页，而是：

1. 对每页计算 `slideSignature`
2. 找到未变化页面的旧 `GenerateResult`
3. 把旧页的 `generated_img_path` 回传给后端

后端 workflow 看到已有 `generated_img_path` 时，会优先走“复用已有页面”而不是重新出图：

- 同页未变：直接复用当前页
- 调整顺序：先对原页做快照，再把页面图和版本历史拷贝到新页号
- 只有真正变化/新增的页才重新生成

相关文件：

- `frontend-workflow/src/components/paper2ppt/utils.ts`
- `frontend-workflow/src/components/paper2ppt/index.tsx`
- `dataflow_agent/workflow/wf_paper2ppt_parallel_consistent_style.py`
- `dataflow_agent/utils/version_manager.py`

## 5. 版本历史机制

目录约定：

- 当前页：`ppt_pages/page_000.png`
- 历史版本：`ppt_pages/page_000_v002.png`
- 元数据：`ppt_pages/page_000_v002.json`
- 当前版本指针：`ppt_pages/page_000_current.json`

这次修复的关键点：

- 前端不再用 `versions.length` 猜“当前版本”
- 后端显式返回 `current_version`
- 恢复版本后会更新当前版本指针
- 页面重排复用时，会连同版本历史一起拷贝
- workflow adapter 回填 `generated_pages` 时只扫 `page_000.png`，不再把 `page_000_v001.png` 误当成当前页

接口语义：

- `version-history` 返回 `versions + current_version`
- `revert-version` 返回 `currentImageUrl + currentVersion`

## 6. 单页重生成与局部编辑

单页重生成仍然复用 `/generate-task`，但新增了两个约束：

- `regenerate_from_current=true`
- 可选 `edit_region`

后端 prompt 规则：

- 默认把“当前页图”当成严格基线，优先保留模板、布局、色系和内容结构
- 如果有 `edit_region`，明确要求只改框选区域，区域外保持不变
- 如果有 `reference_img`，参考图只作为风格锚点，不再覆盖当前页结构

这样可以明显减少“微调后整页风格漂移”。

## 7. 页面素材粘贴

大纲页现在支持：

- 上传图片
- 直接 `Ctrl/Cmd + V` 粘贴图片

上传接口：

- `POST /api/v1/paper2ppt/assets/upload`

落盘位置：

- `{result_path}/input/pasted_assets/*`

随后前端把返回的 `/outputs/...` URL 写回 `asset_ref`。Service 在生成前会自动把它转回本地路径。

## 8. 输出目录契约

```text
outputs/{email_or_default}/paper2ppt/{timestamp}/
├── input/
│   ├── input.pdf | input.txt | input_topic.txt
│   ├── ppt_ref_style.png
│   ├── pasted_assets/
│   └── auto/*.md
├── ppt_pages/
│   ├── page_000.png
│   ├── page_000_current.json
│   ├── page_000_v001.png
│   ├── page_000_v001.json
│   └── ...
├── paper2ppt.pdf
└── paper2ppt_editable.pptx
```

异步任务记录：

- `outputs/.tasks/paper2ppt/{task_id}/task.json`

## 9. 开发时优先检查的点

1. `resultPath` 是否存在且一致
2. 前端传的是展示 URL 还是真实产物路径
3. `pagecontent` 中的 `generated_img_path` 是否需要复用
4. 页面重排时是否保住了版本历史
5. `activeTask` 是否在成功/失败后及时清掉
6. 新增图片字段是否同步进 URL/path 转换逻辑

## 10. 本次改动的核心文件

- `frontend-workflow/src/components/paper2ppt/index.tsx`
- `frontend-workflow/src/components/paper2ppt/GenerateStep.tsx`
- `frontend-workflow/src/components/paper2ppt/OutlineStep.tsx`
- `frontend-workflow/src/components/paper2ppt/UploadStep.tsx`
- `frontend-workflow/src/components/paper2ppt/utils.ts`
- `frontend-workflow/src/stores/authStore.ts`
- `fastapi_app/routers/paper2ppt.py`
- `fastapi_app/services/paper2ppt_service.py`
- `fastapi_app/workflow_adapters/wa_paper2ppt.py`
- `dataflow_agent/workflow/wf_paper2ppt_parallel_consistent_style.py`
- `dataflow_agent/utils/version_manager.py`
