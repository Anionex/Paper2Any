import os
import re
import wave
import base64
from typing import Optional, List
import httpx
from dataflow_agent.logger import get_logger
from dataflow_agent.toolkits.multimodaltool.providers import get_provider
from dataflow_agent.toolkits.multimodaltool.req_img import _post_raw

log = get_logger(__name__)


class TTSFallbackToF5Error(RuntimeError):
    """Gemini TTS 在指定次数内均失败，调用方可用 F5-TTS 回退生成。"""


async def _post_raw_bytes(
    url: str,
    api_key: str,
    payload: dict,
    timeout: int,
) -> bytes:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    log.info(f"POST {url} (binary)")

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout), http2=False) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            log.info(f"status={resp.status_code}")
            resp.raise_for_status()
            return resp.content
        except httpx.HTTPStatusError as e:
            log.error(f"HTTPError {e}")
            log.error(f"Response body: {e.response.text}")
            raise

def split_tts_sentences(content: str) -> List[str]:
    content = content.replace("\r", "")
    paragraphs = [p.strip() for p in content.split("\n") if p.strip()]
    if not paragraphs:
        paragraphs = [content.strip()]

    sentence_splitter = re.compile(r"(?<=[。！？.!?;；])\s*")
    sentences: List[str] = []
    for para in paragraphs:
        if not para:
            continue
        parts = [s.strip() for s in sentence_splitter.split(para) if s.strip()]
        if not parts:
            sentences.append(para.strip())
        else:
            sentences.extend(parts)
    return sentences

def split_tts_text_by_bytes(content: str, limit_bytes: int) -> List[str]:
    if limit_bytes is None or limit_bytes <= 0:
        return [content]
    sentences = split_tts_sentences(content)
    if not sentences:
        return [content]

    chunks: List[str] = []
    buf = ""
    buf_bytes = 0
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        sent_bytes = len(sent.encode("utf-8"))
        if sent_bytes > limit_bytes:
            if buf:
                chunks.append(buf)
                buf = ""
                buf_bytes = 0
            # Fallback: hard split by bytes while keeping order
            part = ""
            part_bytes = 0
            for ch in sent:
                ch_b = len(ch.encode("utf-8"))
                if part_bytes + ch_b > limit_bytes and part:
                    chunks.append(part)
                    part = ch
                    part_bytes = ch_b
                else:
                    part += ch
                    part_bytes += ch_b
            if part:
                chunks.append(part)
            continue

        if not buf:
            buf = sent
            buf_bytes = sent_bytes
            continue
        if buf_bytes + 1 + sent_bytes <= limit_bytes:
            buf = f"{buf} {sent}"
            buf_bytes += 1 + sent_bytes
        else:
            chunks.append(buf)
            buf = sent
            buf_bytes = sent_bytes

    if buf:
        chunks.append(buf)
    return chunks

def split_tts_text(content: str, limit: int) -> List[str]:
    if limit is None or limit <= 0:
        return [content]
    if len(content) <= limit:
        return [content]
    # Normalize whitespace
    content = content.replace("\r", "")
    parts: List[str] = []
    paragraphs = [p.strip() for p in content.split("\n") if p.strip()]
    if not paragraphs:
        paragraphs = [content.strip()]

    for para in paragraphs:
        if len(para) <= limit:
            parts.append(para)
            continue
        sentences = split_tts_sentences(para)
        if not sentences:
            sentences = [para]
        buf = ""
        for sent in sentences:
            if not buf:
                buf = sent
                continue
            if len(buf) + 1 + len(sent) <= limit:
                buf = f"{buf} {sent}"
            else:
                parts.append(buf)
                buf = sent
        if buf:
            parts.append(buf)

    # Hard split if any chunk is still too large
    final_parts: List[str] = []
    for p in parts:
        if len(p) <= limit:
            final_parts.append(p)
        else:
            for i in range(0, len(p), limit):
                final_parts.append(p[i:i + limit])
    return final_parts

async def generate_speech_bytes_async(
    text: str,
    api_url: str,
    api_key: str,
    model: str = "gemini-2.5-pro-preview-tts",
    voice_name: str = "Kore",
    timeout: int = 120,
    max_attempts: int = 10,
    **kwargs,
) -> bytes:
    """
    生成单段 TTS 音频字节。失败时重试最多 max_attempts 次；
    若仍失败且 max_attempts <= 5 则抛 TTSFallbackToF5Error，否则抛 RuntimeError。
    """
    provider = get_provider(api_url, model)
    log.info(f"TTS using Provider: {provider.__class__.__name__}")

    def _build_payload(use_text: str):
        try:
            return provider.build_tts_request(
                api_url=api_url,
                model=model,
                text=use_text,
                voice_name=voice_name,
                **kwargs,
            )
        except NotImplementedError:
            log.error(f"Provider {provider.__class__.__name__} does not support TTS")
            raise

    audio_bytes = None
    last_error = None
    resp_data = None
    for attempt in range(max_attempts):
        url, payload, is_stream = _build_payload(text)
        response_type = payload.pop("__response_type__", "json")
        if response_type == "binary":
            resp_data = await _post_raw_bytes(url, api_key, payload, timeout)
        else:
            resp_data = await _post_raw(url, api_key, payload, timeout)
        try:
            audio_bytes = provider.parse_tts_response(resp_data)
            break
        except Exception as e:
            last_error = e
            if "No parts in content" in str(e) or "No parts" in str(e):
                if attempt < max_attempts - 1:
                    log.warning(
                        f"TTS returned empty (attempt {attempt + 1}/{max_attempts}), retrying: {e}"
                    )
                    continue
            log.error(f"Failed to parse TTS response: {e}")
            log.error(f"Response: {resp_data}")
    if audio_bytes is None:
        msg = "内容存在问题，审查不过关，需要修改"
        if max_attempts <= 5:
            err = TTSFallbackToF5Error(msg)
        else:
            err = RuntimeError(msg)
        if last_error is not None:
            err.__cause__ = last_error
        log.error(f"TTS failed after {max_attempts} attempts: {msg}; last_error={last_error}")
        raise err
    return audio_bytes


async def generate_speech_and_save_async(
    text: str,
    save_path: str,
    api_url: str,
    api_key: str,
    model: str = "gemini-2.5-pro-preview-tts",
    voice_name: str = "Kore",  # Aoede, Charon, Fenrir, Kore, Puck, Orbit, Orus, Trochilidae, Zephyr
    timeout: int = 120,
    max_chars: int = 1500,
    max_attempts: int = 10,
    **kwargs,
) -> str:
    """
    生成语音并保存为 WAV 文件。单段失败时重试最多 max_attempts 次，
    若 max_attempts <= 5 且仍失败则抛 TTSFallbackToF5Error 供调用方用 F5 回退。
    """
    chunks = split_tts_text(text, max_chars)
    log.info(f"TTS split into {len(chunks)} chunk(s) with max_chars={max_chars}")

    audio_chunks: List[bytes] = []
    for idx, chunk in enumerate(chunks, start=1):
        try:
            audio_bytes = await generate_speech_bytes_async(
                text=chunk,
                api_url=api_url,
                api_key=api_key,
                model=model,
                voice_name=voice_name,
                timeout=timeout,
                max_attempts=max_attempts,
                **kwargs,
            )
        except Exception as e:
            log.error(f"Failed to generate speech (chunk {idx}/{len(chunks)}): {e}")
            raise
        audio_chunks.append(audio_bytes)

    os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)

    # Save as WAV (assuming 24kHz, 16bit, Mono as per user doc)
    with wave.open(save_path, "wb") as wav_file:
        wav_file.setnchannels(1)        # 1 Channel
        wav_file.setsampwidth(2)        # 16 bit = 2 bytes
        wav_file.setframerate(24000)    # 24kHz
        wav_file.writeframes(b"".join(audio_chunks))

    log.info(f"Audio saved to {save_path}")
    return save_path

if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    load_dotenv()
    
    async def _test():
        url = os.getenv("DF_API_URL", "https://api.apiyi.com/v1")
        key = os.getenv("DF_API_KEY", "")
        model = os.getenv("DF_TTS_MODEL", "gemini-2.5-pro-preview-tts") #gpt-4o-mini-tts gemini-2.5-pro-preview-tts
        log.info(f"Testing TTS with URL: {url}, Model: {model}")
        try:
            path = await generate_speech_and_save_async(
                # "嗨，欢迎回来，这里是「XX知识电台」，我是主播XXX。 今天咱们来聊一件听上去有点“硬核”，但其实跟你以后用 AI 的体验非常相关的东西：**MCP 协议、工具调用，还有 LLM 里的强化学习训练（比如 PPO、GRPO）到底在干嘛**。 你可能会想： “这些英文缩写也太多了吧，MCP、PPO、GAE、GRPO、TRL……这跟我有什么关系？ ” 别急，我会用类比的方式，帮你把这堆缩写，变成脑子里几个简单的画面。 --- 【核心内容】 ### 一、先说 MCP：AI 世界的 USB-C 接口 先问你个问题： 你有没有被各种充电线折磨过？ 苹果一根、安卓一根、相机一根……后来出了 USB-C，一根线搞定一大片设备，世界清爽多了。 **MCP 就是给大模型用的 USB-C。 ** - 以前每个数据源、每个工具，都要自己想办法接到 LLM 上： 想连数据库一套接口，想连本地文件又一套接口，换个模型厂商再重写一遍，很折腾。 - **MCP（Model Context Protocol）**做的事就是： “大家统一用这一套协议，说一种共同的语言。 ” 不管你是本地文件、远程 API，还是数据库，都可以通过 MCP 挂到 LLM 上。 在 MCP 的架构里，有三个主角： 1. **MCP Host**：就像电脑主机， 比如 Claude Desktop、你的 IDE，它是“需要用数据的那个家伙”。 2. **MCP Server**：像各种外设：硬盘、打印机、扫描仪， 它真正掌握某种能力，比如“查数据库”“调一个 API”。 3. **MCP Client**：是连线的那根 USB-C 线， 负责按照 MCP 规则，把 Host 和 Server 接起来沟通。 这样，**LLM 不需要知道具体怎么连数据库、怎么调 API，它只要会用 MCP 这个“接口”就行了。 ** --- ### 二、本地连接 vs 远程连接：stdio 和 SSE 是啥？ MCP 在 Camel 这个框架里，支持两种连接方式： **本地 stdio** 和 **远程 SSE**。 听着很抽象，我们简单比喻一下。 #### 1）stdio 模式：命令行里的“对话管道” “stdio”就是**标准输入输出**，可以想象成： - 你开了个命令行窗口， - 输入一些内容， - 程序在命令行里回你结果。 在 **stdio 模式**下： - MCP 客户端会**在你本机启动一个程序**（MCP Server）， - 然后通过“喂数据给它（stdin）→ 读结果（stdout）”的方式和它聊天。 适用场景就很简单： **一切都在本机上跑，本地工具、本地文件、本地脚本**，安全、封闭、不走网络。 #### 2）SSE 模式：浏览器一直连着服务器的“隐形水管” **SSE（Server-Sent Events）**可以理解成： - 你打开一个网页， - 浏览器和服务器之间有一根“长长的隐形水管”， - 服务器有消息就随时推过来，不用你一直刷新。 在 MCP 里： - 客户端就像浏览器， - 远程的 MCP Server 在云端或者局域网里， - 它通过 HTTP 长连接，源源不断向你**推送事件流**。 适合什么呢？ - 服务器在**云上、远程机房**； - 需要**持续推送**，比如任务进度、实时日志。 一句话总结： - 本地 stdio：像在自己电脑里开了个命令行，直接对话本地程序。 - 远程 SSE：像浏览器和网站一直连着，实时收消息。 --- ### 三、Camel 里的 MCPServer 和 MCPToolkit： “一个电话本”和“一个总机台” 你可能会想： “有了 MCP 协议，那代码里怎么用？ ” 在 Camel 里，有两个关键角色：**_MCPServer** 和 **MCPToolkit**。 #### 1）_MCPServer：对接“一个 MCP 服务器”的秘书 _MCPServer 做的事，可以想象成给你接入**一个 MCP 服务**的秘书： - 帮你**建立连接**、**断开连接**； - 帮你**问清楚这个服务器有哪些工具**； - 最重要的是： 它会根据每个 MCP 工具，**动态生成一个 Python 异步函数**。 什么意思？ 就好比你有一个远程“天气查询工具”，按照 MCP 定义好了参数和返回值。 _MCPServer 会帮你自动变出一个函数： ```python await query_weather(city=\"Beijing\") ``` 你像调用普通 Python 函数一样用它，**参数校验、类型映射、结果解析**都给你做好了。 这对 LLM Agent 特别友好： **模型看到的是一个“可调用的函数”，背后是不是 HTTP、是不是本地程序，它根本不用操心。 ** #### 2）MCPToolkit：一个“大总机”，管很多服务器 如果 _MCPServer 是接一个服务器的秘书， 那 **MCPToolkit** 就是一个**前台总机**： - 里面可以挂很多个 _MCPServer， 有的连本地脚本、有的连云端 API、有的连数据库。 - 调用方只要对 MCPToolkit 说： “给我所有可用的工具”， 它会把所有服务器提供的工具统一列出来，像一个**大工具清单**。 你可以用一句话理解 MCPToolkit： > “我不想关心这些工具从哪来的，我只想有一个地方，一次性拿到所有好用的工具。 ” 这对 Agent 框架来说太舒服了： 工具发现、聚合、管理，全帮你统一封装好了。 --- ### 四、强化学习 Agent：模型是怎么“越练越懂事”的？ 讲完 MCP，再聊聊后半部分：**强化学习里的 Agent，是怎么训练 LLM 的？ ** 你可以把 LLM 想成一个“会说话，但价值观不一定稳”的学徒， 我们希望通过强化学习不断告诉它：“这样说有奖励，那样说要扣分”。 #### 1）策略、Q 函数、值函数：别被名词吓到 - **策略（Policy）**： 不是“当前这一步选了动作 a”，而是一个**规则**： “在每个状态下，选每个动作的概率是多少”。 就像一个“行为准则手册”。 - **Q 函数 Q(s, a)**： 你在某个状态 s 做了一个动作 a，**从现在开始往后看，预期总奖励是多少**。 类似于： “我现在给这个用户一个这样的回答，从长期效果看，值不值？ ” - **价值函数 V(s)**： 不看具体动作，只看状态： “在这个对话状态下，整体预期能拿到多少奖励？ ” DQN 那种算法里，会去拟合一个目标： > target = r + γ * max_{a'} Q_target(s', a') 翻译成人话就是： > “现在这一步的奖励 r + 以后如果一直做最优动作，能拿到的最高分。 ” 所以有个 **max Q**，代表“我假设自己之后都能选对动作”。 #### 2）优势函数 Advantage：Q 值减个“平均线” 你可能会问： “既然有 Q 和 V，为什么还要 Advantage（优势函数）？ ” 原因很简单： **Q 的波动太大了**，直接用来更新策略容易不稳定。 于是我们就做了个操作： > A(s, a) = Q(s, a) - V(s) 你可以理解为： > “这个动作比我在这个状态下的平均水平，到底好多少？ ” 把“平均水平”减掉，剩下的就是**相对好坏**， 这样梯度更新更稳定，训练不容易炸。 #### 3）GAE：让优势估计更“平滑、不暴躁” GAE，全称 Generalized Advantage Estimation。 它做的事是：在“准确”和“稳定”之间，**找一个更平衡的优势估计方式**。 直觉上是这样： - 只看一步奖励：噪声太大，像看股票只看一分钟波动； - 看很长未来：虽然理论上更准，但方差巨大，训练抖得厉害； - GAE 通过一个衰减系数，把“多步信息”混在一起， 让优势既带有长远信息，又不过分波动。 --- ### 五、PPO 在 LLM 里的玩法：三件套 + 一个重要性采样 你可能在各种论文、博客里看到： “用 PPO 做 RLHF（人类反馈强化学习）”。 那我们对照一下，PPO 在 LLM 场景中的几个角色： 1. **参考模型 llm_ref** - 就像“原版师傅”，不参与更新，只提供一个基准： “你现在的回答，比原来好多少？ ” - 防止模型越训越跑偏，忘记原本基本能力。 2. **待训练模型 llm_active** - 其实有两份：",
                "你好，这里是paper2any系列",
                "test_tts.wav",
                url, key, model
            )
            log.info(f"Success: {path}")
        except Exception as e:
            log.error(f"Error: {e}")
            
    asyncio.run(_test())
