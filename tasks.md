# Tasks（基于 Oneira Spec v3）

## 阶段一：项目初始化与基础架构

- [ ] Task 1: 项目脚手架搭建
  - [ ] SubTask 1.1: 创建 Next.js 项目（前端 + API Routes 后端）
  - [ ] SubTask 1.2: 配置 Tailwind CSS 和基础 UI 框架（梦境主题：柔和/梦幻）
  - [ ] SubTask 1.3: 创建项目目录结构（components/api/lib/types/hooks）
  - [ ] SubTask 1.4: 配置环境变量（硅基流动 API Key、模型名称）

- [ ] Task 2: 硅基流动 API 对接
  - [ ] SubTask 2.1: 实现通用 API 代理层（隐藏密钥，统一错误处理与超时）
  - [ ] SubTask 2.2: 实现 Text2Image 调用模块（FLUX/SD 首次生成）
  - [ ] SubTask 2.3: 实现 Img2Img 调用模块（微调，支持 strength 0.3-0.5）
  - [ ] SubTask 2.4: 实现 Img2Img 调用模块（探索镜头拉近，strength 0.5-0.7）
  - [ ] SubTask 2.5: 实现 Qwen-VL 调用模块（语义标签、元素识别、多模态分析，支持流式 SSE）
  - [ ] SubTask 2.6: 实现 Qwen-Plus 调用模块（Agent ReAct loop，支持流式 SSE）
  - [ ] SubTask 2.7: 实现图像落盘模块（云 API 返回后下载到 /public/generated/，版本树与探索节点只存本地 URL）

## 阶段二：数据层与状态管理

- [ ] Task 3: 数据结构与状态管理
  - [ ] SubTask 3.1: 定义类型（VersionNode、ExploreNode、SessionState、SemanticTags）
  - [ ] SubTask 3.2: 实现版本树状态管理（横向链：新增节点、切换节点、深度限制≤5）
  - [ ] SubTask 3.3: 实现探索路径状态管理（纵向链：新增探索节点、面包屑回溯、深度限制≤7）
  - [ ] SubTask 3.4: 实现"探索存为新版本"逻辑（探索节点落地到版本树）
  - [ ] SubTask 3.5: 实现分析对象标记逻辑（analysisTargetId，仅版本节点可标记）
  - [ ] SubTask 3.6: 实现会话级持久化（localStorage，刷新不丢失）

- [ ] Task 4: 释梦 RAG 知识库
  - [ ] SubTask 4.1: 收集整理释梦理论文档（弗洛伊德《梦的解析》摘要、荣格原型理论摘要）
  - [ ] SubTask 4.2: 搭建本地向量库（sentence-transformers Embedding）
  - [ ] SubTask 4.3: 实现检索接口（输入梦境描述/画面标签，返回相关理论片段）

## 阶段三：核心交互实现

- [ ] Task 5: 画面区与伪流式渲染
  - [ ] SubTask 5.1: 实现画面展示组件（当前梦境画面，响应式）
  - [ ] SubTask 5.2: 实现伪流式动画（CSS blur + 逐块 reveal，3 秒内完成）
  - [ ] SubTask 5.3: 实现生成进度指示器（脉冲动画 + "AI 正在描绘你的梦境..."）
  - [ ] SubTask 5.4: 实现可点元素高亮（基于语义标签，hover 浮现元素名）
  - [ ] SubTask 5.5: 实现镜头拉近过渡动画（缩放+渐变，1.5 秒内完成）

- [ ] Task 6: 版本树 UI（横向一维）
  - [ ] SubTask 6.1: 实现横向时间轴组件（节点连线，当前节点高亮）
  - [ ] SubTask 6.2: 每个节点显示描述文本 + 语义标签缩略
  - [ ] SubTask 6.3: 每个节点显示缩略图
  - [ ] SubTask 6.4: 每个版本节点有"开始分析"按钮
  - [ ] SubTask 6.5: 点击节点切换画面，探索面包屑重置到该版本

- [ ] Task 7: 探索面包屑与探索交互
  - [ ] SubTask 7.1: 实现面包屑组件（横向，记录探索路径，可点回任意层）
  - [ ] SubTask 7.2: 实现元素点击捕获（记录坐标，发送给 Agent 识别）
  - [ ] SubTask 7.3: 实现"存为新版本"按钮（探索画面落地版本树）
  - [ ] SubTask 7.4: 探索节点也可微调（探索路径上延伸节点）

- [ ] Task 8: 统一输入框与行为分发
  - [ ] SubTask 8.1: 实现底部常驻输入框
  - [ ] SubTask 8.2: 实现三种行为分发逻辑（只打字=微调 / 只点元素=自动探索 / 点元素+打字=引导探索）
  - [ ] SubTask 8.3: 实现上下文提示（点元素后显示"→ 探索：大海"）
  - [ ] SubTask 8.4: 生成过程中输入框保持可用

- [ ] Task 9: 核心交互闭环
  - [ ] SubTask 9.1: 首次生成流程（输入 → Agent 追问 → 生成 → 落盘 → 标签 → 版本树根节点 → 伪流式）
  - [ ] SubTask 9.2: 微调流程（打字 → Img2Img → 落盘 → 标签 → 版本树横向新增）
  - [ ] SubTask 9.3: 自动探索流程（点元素 → VLM 识别 → Agent 生成方向 → Img2Img 镜头拉近 → 落盘 → 标签 → 面包屑新增）
  - [ ] SubTask 9.4: 引导式探索流程（点元素+打字 → Agent 结合元素语义+用户描述 → Img2Img）
  - [ ] SubTask 9.5: 探索存为新版本流程
  - [ ] SubTask 9.6: 探索节点继续微调流程

## 阶段四：Agent 与心理分析

- [ ] Task 10: 全程贯穿的 Agent（ReAct loop）
  - [ ] SubTask 10.1: 实现轻量级 ReAct loop 框架（Thought/Action/Observation，基于 Qwen-Plus）
  - [ ] SubTask 10.2: 描述阶段 Agent（判断描述简短/模糊 → 主动追问 1-2 问题，对话气泡展示）
  - [ ] SubTask 10.3: 微调阶段 Agent（基于语义标签给构图建议，轻量提示）
  - [ ] SubTask 10.4: 探索阶段 Agent（VLM 识别元素 → 生成探索方向描述 → 引导式探索时结合用户描述）
  - [ ] SubTask 10.5: Agent 对话气泡组件

- [ ] Task 11: 并行子 Agent 调度
  - [ ] SubTask 11.1: 实现并行调度框架（Promise.all，无依赖才并行）
  - [ ] SubTask 11.2: 图像后处理并行（语义标签 + 构图建议同时进行）
  - [ ] SubTask 11.3: 心理分析三维度并行（释梦 Agent / 情绪 Agent / 睡眠 Agent，各自窄上下文）
  - [ ] SubTask 11.4: AI 建议串行汇总（依赖前三者结果）
  - [ ] SubTask 11.5: 前端按完成顺序流式展示（哪个先好先显示）

- [ ] Task 12: 多模态心理分析模块
  - [ ] SubTask 12.1: 设计四维度 Prompt 模板（释梦 RAG 参考 / 情绪 VLM 画面 / 睡眠文本推断 / 建议汇总）
  - [ ] SubTask 12.2: 实现"开始分析"触发逻辑（取标记版本的画面+描述）
  - [ ] SubTask 12.3: 实现流式输出（SSE 逐字显示，四维度标题分隔）
  - [ ] SubTask 12.4: 实现探索倾向辅助参考（分析完成后附加，明确标注"非分析主体"）
  - [ ] SubTask 12.5: 实现免责声明展示

## 阶段五：测试与打磨

- [ ] Task 13: 端到端测试与 UI 打磨
  - [ ] SubTask 13.1: 使用 Chrome DevTools MCP 全局预览测试
  - [ ] SubTask 13.2: 测试核心流程：首次生成 → 微调 → 探索 → 存为新版本 → 标记分析
  - [ ] SubTask 13.3: 测试心理分析完整流程（并行+汇总+流式+免责）
  - [ ] SubTask 13.4: 测试边界：空输入、超长描述、快速连续操作、网络异常、链路深度超限
  - [ ] SubTask 13.5: UI 视觉打磨（梦境配色、动画流畅度、布局响应式）
  - [ ] SubTask 13.6: 至少 3 轮完整测试验证，修复所有问题

- [ ] Task 14: 演示容灾
  - [ ] SubTask 14.1: 预置一套离线演示数据（缓存梦境图+分析结果）
  - [ ] SubTask 14.2: 网络中断时降级到离线演示模式
  - [ ] SubTask 14.3: 准备演示脚本（90 秒讲完流程）

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3 可与 Task 2 并行
- Task 4 可与 Task 2 并行
- Task 5 依赖 Task 2 + Task 3
- Task 6 依赖 Task 3
- Task 7 依赖 Task 2 + Task 3 + Task 5
- Task 8 依赖 Task 5 + Task 7
- Task 9 依赖 Task 5 + Task 6 + Task 7 + Task 8
- Task 10 依赖 Task 2
- Task 11 依赖 Task 10
- Task 12 依赖 Task 9 + Task 10 + Task 11
- Task 13 依赖 Task 12
- Task 14 依赖 Task 13
