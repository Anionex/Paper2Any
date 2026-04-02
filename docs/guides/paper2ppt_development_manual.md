# Paper2PPT 架构与开发手册

> 这是一份面向开发者的活文档。
> 默认要求是“代码变，文档也跟着变”。只要 `paper2ppt` 的接口、目录约定、工作流拆分或前端交互发生变化，就应该同步更新本文件。

## 1. 文档目标

本文档回答四个问题：

1. `paper2ppt` 模块现在是怎么跑通的。
2. 它依赖了项目里的哪些基础设施。
3. 开发时应该从哪些入口下手。
4. 哪些地方最容易改坏，必须先知道。

不包含面向终端用户的使用教程；这里只讨论架构、代码入口、目录契约和扩展方式。

## 2. 模块范围

当前 `paper2ppt` 的能力不是单个“生成 PPT”接口，而是一套四阶段流程：

1. 解析输入，生成 `pagecontent` 大纲。
2. 人工或 AI 调整大纲。
3. 批量生成页面图，并支持单页二次编辑。
4. 最终导出 PDF 和可编辑 PPTX。

公开后端接口集中在 `/api/v1/paper2ppt/*`：

- `POST /paper2ppt/page-content`
- `POST /paper2ppt/outline-refine`
- `POST /paper2ppt/generate`
- `POST /paper2ppt/generate-task`
- `GET /paper2ppt/tasks/{task_id}`
- `GET /paper2ppt/version-history/{encoded_path}/{page_id}`
- `POST /paper2ppt/revert-version`

注意：

- 代码里仍然保留了 full pipeline request/service/adapter，但当前没有公开的 full pipeline 路由。
- 文档和注释里若还看到旧名字，例如 `/pagecontent_json`、`/ppt_json`、`/full_json`，都应以当前实际路由为准。

## 3. 总体架构

可以把 `paper2ppt` 看成五层：

```text
frontend-workflow/paper2ppt
  -> fastapi_app/routers/paper2ppt.py
    -> fastapi_app/services/paper2ppt_service.py
      -> fastapi_app/workflow_adapters/wa_paper2ppt.py
        -> dataflow_agent.workflow.run_workflow(...)
          -> outputs/... 落盘 + /outputs/... 静态访问
```

职责拆分如下：

- 前端：维护四步向导状态，拼 `FormData`，轮询异步任务，展示页面图、版本历史和导出结果。
- Router：只负责把表单参数装进请求模型，然后转给 service。
- Service：负责输入文件落盘、`result_path` 管理、`pagecontent` 序列化/反序列化、输出路径转 URL。
- Workflow adapter：把 FastAPI 层的请求模型转成 DataFlow 的旧状态结构，并选择具体 workflow。
- Workflow：真正完成大纲生成、页面生成、单页编辑和最终导出。

## 4. 关键代码入口

### 4.1 前端入口

核心前端容器只有一个：

- `frontend-workflow/src/components/paper2ppt/index.tsx`

它维护整个状态机：

- `upload`：输入与配置
- `outline`：大纲编辑
- `generate`：批量生成 + 单页再编辑
- `complete`：最终导出

展示组件分拆在同目录下：

- `UploadStep.tsx`
- `OutlineStep.tsx`
- `GenerateStep.tsx`
- `VersionHistory.tsx`
- `CompleteStep.tsx`

前端的几个关键事实：

- 它不是 typed client，而是手写 `fetch + FormData` 契约。
- `resultPath` 是整个会话的锚点，后续所有操作都依赖它。
- `outlineData` 是前后端共享的页面结构。
- `generateResults` 保存每页生成结果、当前图、版本历史和当前版本索引。
- 只有“配置”会写入 `localStorage`；大纲和生成结果不会跨刷新恢复。

### 4.2 后端入口

后端公开接口都在：

- `fastapi_app/routers/paper2ppt.py`

Router 本身很薄，主要把 multipart form 映射到这些模型：

- `PageContentRequest`
- `OutlineRefineRequest`
- `PPTGenerationRequest`

这些模型定义在：

- `fastapi_app/schemas.py`

### 4.3 Service 入口

真正的 HTTP 编排在：

- `fastapi_app/services/paper2ppt_service.py`

这个 service 是整个模块最关键的中间层，职责包括：

- 创建本次运行目录。
- 保存上传文件和参考图。
- 复用历史参考图。
- 解析前端传来的 `pagecontent` JSON。
- 把 `/outputs/...` URL 转回本地路径。
- 把 workflow 结果里的本地路径再转成前端可访问 URL。
- 调 workflow adapter，而不是直接调 workflow。

异步任务逻辑单独在：

- `fastapi_app/services/paper2ppt_task_service.py`

这里不是消息队列，而是“文件持久化 + 进程内 `asyncio.create_task`”。

这意味着：

- `task.json` 会落盘保留。
- 但 `queued/running` 任务在服务重启后不会自动恢复。

### 4.4 Workflow adapter 入口

FastAPI 与 DataFlow 工作流之间的胶水层在：

- `fastapi_app/workflow_adapters/wa_paper2ppt.py`

它负责三件事：

1. 把新的 FastAPI 请求模型压平为旧的 `Paper2PPTRequest`。
2. 构造 `Paper2FigureState`。
3. 选择 workflow 名称并调用 `run_workflow(...)`。

当前关键 workflow：

- `paper2page_content`
- `paper2page_content_for_long_paper`
- `paper2ppt_parallel_consistent_style`

另外，CLI 也走同样的两步流程，可参考：

- `script/run_paper2ppt_cli.py`

## 5. 请求链路

### 5.1 解析大纲

前端第 1 步会把 PDF、长文本或 topic 发到：

- `POST /api/v1/paper2ppt/page-content`

输入里会带：

- `input_type`
- `file` 或 `text`
- `chat_api_url`
- `api_key`
- `model`
- `gen_fig_model`
- `page_count`
- `use_long_paper`
- `reference_img`

返回重点：

- `pagecontent`
- `result_path`
- `all_output_files`

其中 `result_path` 非常重要，因为后面所有步骤都复用同一个运行目录。

### 5.2 大纲微调

前端第 2 步允许两种改法：

- 本地直接编辑 `outlineData`
- 把当前大纲和 `outline_feedback` 发到 `POST /api/v1/paper2ppt/outline-refine`

这个 refine 流程不会重新解析原始 PDF 或文本，而是基于已有 `pagecontent` 继续改写。

### 5.3 批量生成

确认大纲后，前端并不是逐页发请求，而是先调用：

- `POST /api/v1/paper2ppt/generate-task`

然后轮询：

- `GET /api/v1/paper2ppt/tasks/{task_id}`

当前任务类型实际上有三种，只是共用一个请求模型：

- `get_down=false` 且 `all_edited_down=false`：批量生成页面图
- `get_down=true`：单页再生成
- `all_edited_down=true`：最终导出

这两个布尔标志是字符串表单值，语义比较绕，后续改接口时优先考虑把它们拆成显式模式字段。

### 5.4 单页再编辑

当前页重新生成走：

- `POST /api/v1/paper2ppt/generate`

这里前端不会只传当前页，而是会把整套 `pagecontent` 一起传回去，并给当前页附上：

- `page_id`
- `edit_prompt`
- `generated_img_path`

原因是后端 workflow 依赖整套上下文，而不是完全独立地只看单页。

### 5.5 最终导出

最终导出仍然走异步任务接口：

- `POST /api/v1/paper2ppt/generate-task`

区别只是加上：

- `all_edited_down=true`

底层 workflow 在这个模式下才会把 `ppt_pages/` 里的页面图导出为：

- `paper2ppt.pdf`
- `paper2ppt_editable.pptx`

## 6. 输出目录契约

这是 `paper2ppt` 最重要的隐式契约之一。

单次运行目录结构大致如下：

```text
outputs/{email_or_default}/paper2ppt/{timestamp}/
├── input/
│   ├── source.pdf
│   ├── ppt_ref_style.png
│   └── auto/
│       └── *.md
├── ppt_pages/
│   ├── page_000.png
│   ├── page_000_v001.png
│   ├── page_000_v001.json
│   ├── page_000_v002.png
│   └── ...
├── paper2ppt.pdf
└── paper2ppt_editable.pptx
```

这个目录约定被多个层同时依赖：

- FastAPI service 根据它创建和复用 `result_path`
- `/outputs/*` 静态服务根据它暴露结果文件
- 文件历史接口根据它扫描用户输出
- MinerU markdown 复用逻辑根据它找 `input/auto/*.md`
- 版本历史根据它找 `ppt_pages/page_xxx_vyyy.png`
- 异步任务记录写在 `outputs/.tasks/paper2ppt/{task_id}/task.json`

如果要改目录结构，不能只改一个地方，至少要一起检查：

- `paper2ppt_service.py`
- `paper2ppt_task_service.py`
- `wa_paper2ppt.py`
- `routers/files.py`
- 前端 `resultPath` 使用点

## 7. 基础设施依赖

### 7.1 FastAPI 启动与静态文件

`fastapi_app/main.py` 会：

- 启动时优先加载 `fastapi_app/.env`
- 注册 `APIKeyMiddleware`
- 把 `paper2ppt` 路由挂到 `/api/v1`
- 把项目根下的 `outputs/` 挂成公开静态目录 `/outputs`

这意味着所有生成物一旦知道 URL，就可以直接通过 `/outputs/...` 访问。

### 7.2 内部鉴权

`paper2ppt` API 依赖内部 header：

- `X-API-Key`

后端读取：

- `BACKEND_API_KEY`

前端读取：

- `VITE_API_KEY`

这两个值必须完全一致，否则所有 `/api/*` 请求都会被中间件拒绝。

注意：

- `/outputs/*` 不走 API key 校验。
- `/api/v1/files/stream` 也在白名单里。

### 7.3 Supabase 不是硬依赖

`paper2ppt` 主流程本身不依赖 Supabase。

但这些能力会用到它：

- 登录态
- 文件历史
- 配额
- JWT 用户目录隔离

如果 Supabase 没配置：

- 主流程仍然可以跑
- 文件上传/历史能力会退化为 `email` 或 `default` 目录语义

### 7.4 模型配置

后端配置集中在：

- `fastapi_app/config/settings.py`
- `fastapi_app/.env`

`paper2ppt` 当前依赖三层模型配置：

- workflow 级默认模型
- role 级模型
- 前端表单里用户可临时覆盖的模型

当前尤其需要关注：

- `PAPER2PPT_OUTLINE_MODEL`
- `PAPER2PPT_CONTENT_MODEL`
- `PAPER2PPT_IMAGE_GEN_MODEL`
- `PAPER2PPT_VLM_MODEL`
- `PAPER2PPT_CHART_MODEL`
- `PAPER2PPT_DESC_MODEL`
- `PAPER2PPT_TECHNICAL_MODEL`

前端默认下拉来源于：

- `frontend-workflow/.env.example`
- `frontend-workflow/src/config/models.ts`

### 7.5 MinerU 依赖

PDF 输入的大纲路径可能触发 MinerU，把 markdown 先抽到运行目录里，再用它估算 token 和辅助长文处理。

当前存在两种模式：

- 配了 `MINERU_API_KEY` 时，优先走远端 API
- 否则走本地服务，依赖 `MINERU_PORT`

而且编辑阶段的 adapter 默认假设此前解析阶段已经在：

- `{result_path}/input/auto`

里准备好了 markdown 相关产物。

这也是为什么：

- “先 page-content，再 generate/edit” 是当前默认正确用法
- 不能随便跳过解析阶段直接从空目录开始做编辑

## 8. 前端状态机

前端可以简单理解为单大组件驱动的状态机：

```text
upload
  -> outline
    -> generate
      -> complete
```

其中关键状态变量：

- `outlineData`: 大纲数组，前后端共享结构
- `generateResults`: 每页当前图与版本历史
- `resultPath`: 当前运行目录
- `currentSlideIndex`: 当前查看/编辑页
- `downloadUrl` / `pdfPreviewUrl`: 最终导出结果

维护时最容易踩坑的是：

- 在没有 `resultPath` 的情况下发后续请求
- 改了 `pagecontent` 结构但忘了同步前后端
- 只更新某页 UI，但没同步 `generateResults`
- 把本应走异步任务的批量/最终导出误改成同步接口

## 9. 工作流与状态对象

底层 workflow 统一吃的是：

- `Paper2FigureState`

虽然名字历史包袱很重，但当前 `paper2ppt` 仍然依赖这套状态对象。

其中跟 `paper2ppt` 强相关的字段有：

- `gen_down`
- `edit_page_num`
- `edit_page_prompt`
- `generated_pages`
- `pagecontent`
- `minueru_output`
- `mineru_root`
- `outline_feedback`
- `ppt_pdf_path`
- `ppt_pptx_path`
- `all_edited_down`

当前导出逻辑也有一个关键约束：

- 如果 `gen_down=true` 且 `all_edited_down=false`，workflow 不会导出最终 PDF/PPTX
- 只有最终导出阶段才会真正执行 `export_ppt_assets`

## 10. 版本历史机制

单页再编辑会触发版本管理器：

- `dataflow_agent/utils/version_manager.py`

规则是：

- 当前图固定是 `page_{idx:03d}.png`
- 历史版本是 `page_{idx:03d}_vNNN.png`
- 元数据是同名 `.json`
- 第一次编辑时，初始图会先被保存成 `v001`
- 默认最多保留 `MAX_IMAGE_VERSIONS` 个版本

前端查询历史的接口是：

- `GET /paper2ppt/version-history/{base64(result_path)}/{page_id}`

恢复历史版本的接口是：

- `POST /paper2ppt/revert-version`

注意，这套版本历史只覆盖“单页编辑图像版本”，不是“整次任务历史”。

整次任务历史仍然是文件历史系统那一套。

## 11. 本地开发建议流程

### 11.1 最小跑通链路

建议按这个顺序调试：

1. 启动后端，确认 `/health` 正常。
2. 确认前端 `VITE_API_KEY` 与后端 `BACKEND_API_KEY` 一致。
3. 先跑 `page-content`，拿到 `result_path` 和 `pagecontent`。
4. 再跑 `generate-task`，确认能生成 `ppt_pages/`。
5. 再测单页 `generate` 编辑。
6. 最后测 `all_edited_down=true` 的最终导出。

不要一开始就只盯最终导出，因为很多问题其实出在前两步。

### 11.2 推荐排查顺序

如果出问题，优先查：

1. `result_path` 是否存在且正确。
2. `pagecontent` 是否是合法 JSON，字段是否完整。
3. `input/auto/*.md` 是否存在。
4. `ppt_pages/page_000.png` 是否已经落盘。
5. 当前模型 key 是否真的可用。
6. 是否误把公开静态 URL 当成本地路径，或反过来。

## 12. 扩展开发指南

### 12.1 加新输入模式

如果要新增输入类型，不要只改前端上传选项，至少要同步检查：

- 前端 `UploadMode`
- `PageContentRequest.input_type`
- `Paper2PPTService._prepare_input_for_pagecontent`
- `Paper2PPTService._prepare_input_for_full`
- `wa_paper2ppt._init_state_from_request`
- 对应 workflow 对 `input_type` 的解释

### 12.2 改 pagecontent 结构

这是高风险改动。

至少要同步：

- 前端 `SlideOutline`
- 前端序列化 `pagecontent` 的地方
- 后端 `_parse_pagecontent_json`
- URL/path 归一化逻辑
- workflow 里读取页面字段的节点

如果新增图片类字段，还要同步补进路径转换逻辑。

### 12.3 改导出逻辑

如果要改最终导出，不要只动 workflow。

还要同步检查：

- 前端最终导出轮询逻辑
- `ppt_pdf_path` / `ppt_pptx_path` 返回格式
- `all_output_files` 回填逻辑
- 文件历史上传逻辑

### 12.4 拆分前端容器

`frontend-workflow/src/components/paper2ppt/index.tsx` 已经是超大容器组件。

后续如果继续扩展，优先考虑：

- 抽出 `paper2ppt` 专用 API service
- 抽出 `usePaper2PptFlow` hook
- 把版本历史、任务轮询、导出逻辑拆成独立模块

否则继续往这个组件里堆功能，后面回归成本会越来越高。

## 13. 当前已知风险

这些点在开发时必须带着：

- full pipeline 代码还在，但公开路由没有暴露，文档不能假装它已经是正式 API。
- 一些注释和 docstring 还是旧接口名，容易误导新开发者。
- `PageContentRequest` 里要求 `gen_fig_model`，但 service 当前组装内部请求时没有真正使用它，需要后续确认这是故意还是遗留问题。
- 异步任务是进程内任务，不是可靠任务队列，服务重启不会恢复运行中的任务。
- 前端版本历史 URL 转换里仍有硬编码端口假设，和当前 Vite 代理不一致。
- 配额服务注释和页面提示文案与当前代码中的真实限额不完全一致。
- `/outputs/*` 是公开静态目录，不适合承诺“拿到链接之外还需要鉴权”这种行为。
- workflow 底层有些地方会回退到 `.env` 里的 `DF_API_KEY`，所以即便前端一般会传用户 key，本地环境配置仍然可能影响行为。

## 14. 文档维护要求

后续遇到以下改动，必须同时更新本文件：

- 新增或删除 `paper2ppt` API。
- 更改 `pagecontent` 字段结构。
- 更改 `result_path` 或输出目录布局。
- 更改 workflow 名称或切换 workflow 入口。
- 更改版本历史机制。
- 更改前端步骤流转方式。
- 更改环境变量、模型配置方式或鉴权方式。

建议在每次与 `paper2ppt` 相关的 PR 中，把这份文档当成 checklist：

1. 接口变了吗？
2. 目录契约变了吗？
3. 前后端字段契约变了吗？
4. 本文档需要同步改哪一节？

如果答案是“变了”，那就不要把文档更新留到以后。
