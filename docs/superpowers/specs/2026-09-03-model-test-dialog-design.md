# 模型测试功能 — 设计规格

> 日期：2026-09-03
> 分支：main（在现有 staged 的 `test` 事件接线基础上继续）

## 目标

在现有「大模型提供商 API 密钥管理」表格中，为每条记录新增「测试」能力：点击测试打开一个弹窗，填写模型名与消息，发起一次对话请求，并把结果（成功内容或失败提示）展示在同一个弹窗内。支持从 `api_url` 自动拉取模型列表供选择，拉取失败时可手动填写。

## 现状与约束

- 纯前端单页应用，无后端；数据存 localStorage。
- 仓库此前约定「JS 层无网络请求」，本功能有意打破此约定（用户已确认）。
- 表格操作列已有「测试」按钮并 `emit("test", item)`，`App.vue` 已声明 `showTestForm(item: Item)`（staged，当前为 ToDo）。
- **不使用 `openai` npm 依赖**（用户明确改为原生 `fetch`）。
- 不新增 shadcn Select 原语（用原生 `<select>`）。
- 界面文案一律中文。

## 架构

### 新增组件目录 `src/components/test-form-dialog/`

- `index.vue` — 测试弹窗 UI + 状态编排
- `api.ts` — 纯函数：拼接 URL、`fetchModels`、`sendChatCompletion`（可单测）

### `src/App.vue` 改动

- 新增 `testItem` ref + `hasTestItem` computed。
- 模板挂载 `<TestFormDialog :open="hasTestItem" :item="testItem" @update:open="hideTestForm" />`。
- `showTestForm(item)` 写入 `testItem.value = item`；`hideTestForm()` 置空。

## 弹窗字段（`index.vue`）

| 字段 | 控件 | 说明 |
|---|---|---|
| `api_url` | 只读 `Input` | 预填 `item.api_url`，不可编辑 |
| `api_token` | 只读 `Input`（`type="password"` 遮罩） | 预填 `item.api_token`，不可编辑 |
| `model_name` | 可编辑 `Input` | 右上角「自动获取」文字按钮；右下角「查看文档」文字按钮（`item.docs_url` 为空则不显示） |
| `message` | 可编辑 `Input` | 默认 `hello` |

### 模型选择区

- 「自动获取」点击后调用 `fetchModels`，加载中按钮禁用并显示转圈。
- 成功 → 在 `model_name` 下方显示原生 `<select>`，选项为模型 id，选中后写回 `model_name` 输入框。
- 失败 → 显示红字「获取失败，请手动填写」。
- 弹窗打开时**不**自动拉取，仅点击「自动获取」触发（用户已确认）。

## API 封装（`api.ts`，原生 fetch）

### URL 拼接

- `joinApiPath(baseURL: string, path: string): string`
  - `baseURL` 以 `/` 结尾时不重复加 `/`；否则补一个 `/`，再拼 `path`。
  - 例：`https://host/v1` + `/models` → `https://host/v1/models`；`https://host/v1/` + `/models` → `https://host/v1/models`。

### 拉取模型列表

- `fetchModels(baseURL: string, apiToken: string): Promise<string[]>`
  - `GET {joinApiPath(baseURL, "/models")}`，请求头 `Authorization: Bearer {apiToken}`。
  - 解析 `data[].id`，返回模型 id 数组；非 2xx 或解析失败则 `throw`。

### 发送对话请求

- `sendChatCompletion(baseURL: string, apiToken: string, model: string, message: string): Promise<string>`
  - `POST {joinApiPath(baseURL, "/chat/completions")}`，JSON body：
    ```json
    { "model": "...", "messages": [{ "role": "user", "content": "..." }] }
    ```
  - 请求头 `Authorization: Bearer {apiToken}`、`Content-Type: application/json`。
  - 解析 `choices[0].message.content` 返回；非 2xx 或解析失败则 `throw`。

## 状态与数据流（`index.vue` 内本地化）

- 打开（watch `open`+`item`）时重置：清空 `model_name`/`message`/模型列表/加载态/错误/响应。
- 三个 ref：`modelsLoading`、`modelsError`、`models: string[]`；`sending`、`sendError`、`responseText`。
- 只读字段直接绑定 `item`（不设草稿副本）。
- 点击「测试」→ `sending = true` → `sendChatCompletion` → 成功写 `responseText` / 失败写 `sendError` → `sending = false`。
- 结果区：
  - 成功 → 只读 `<textarea>` 展示 `responseText`（可复制）。
  - 失败 → 红字「请求失败」+ 错误信息。

## 错误处理

- 浏览器端受 CORS 限制，失败属预期；在 UI 内以中文红字提示，不抛出到控制台影响使用。
- fetch 网络错误、非 2xx、JSON 结构不符统一走失败分支。

## 测试

- `tests/unit/api.test.ts`：覆盖 `joinApiPath`（尾斜杠、路径拼接）。fetch 相关为 DOM/网络，不在 node 单测范围。
- 构建：`pnpm build`（`vue-tsc -b` 类型检查 + vite build）须通过。注意 `tsconfig.app.json` 开了 `noUnusedLocals`，避免未使用变量。

## 不做的事（YAGNI）

- 不新增 `openai` 依赖。
- 不新增 shadcn Select 原语。
- 不做流式响应、不做多轮对话、不做模型缓存。
- 不改 localStorage 数据结构。