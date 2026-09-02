# llm-api-key-manager（大模型提供商 API 密钥管理）

> 纯前端、无后端的单页工具：以表格集中管理各家大模型提供商的 API 接入配置（提供商 / 接口地址 / 接口密钥 / 文档地址 / 备注），支持新增、修改、删除（二次确认）、一键复制、JSON 导入（按 `id` 合并）与导出到本地文件。数据只保存在浏览器 `localStorage`（键 `__llm_api_key_items__`），JS 层无任何网络请求（唯一外部请求是 `src/style.css` 顶部 Google Fonts 的 `@import`）。用户可见文案为中文。

## 技术栈与环境

- 框架：Vue 3.5（全部 SFC 用 `<script setup lang="ts">`）+ TypeScript（声明 `~6.0.2`，实测安装 6.0.3）
- 构建：Vite 8 + `@vitejs/plugin-vue` + `@tailwindcss/vite`（`vite.config.ts`）；生产构建先跑 `vue-tsc -b` 类型检查再 `vite build`
- 样式：Tailwind CSS v4（CSS-first，**无 `tailwind.config.*`**）+ `tw-animate-css` + `shadcn-vue/tailwind.css`；主题 CSS 变量与明暗色板全在 `src/style.css`
- UI 原语：shadcn-vue 2（`components.json`：style `reka-nova`、icon 库 `tabler`）+ reka-ui 2，组件本地化在 `src/components/ui/`；图标库 `@tabler/icons-vue`
- 工具库：`@vueuse/core`（`useLocalStorage`）、`uuid`（新增条目 id）、`copy-to-clipboard`、`clsx` + `tailwind-merge` + `class-variance-authority`（拼出 `cn()`）
- 无路由（无 vue-router）、无状态库（无 pinia）、无服务端
- 测试：vitest（`vitest.config.ts`：`environment: "node"`，只收集 `tests/**/*.test.ts`），仅覆盖纯函数
- 包管理：pnpm（`pnpm-lock.yaml` lockfileVersion 9；`pnpm-workspace.yaml` 只有 `allowBuilds: vue-demi: true`）
- 路径别名 `@` → `src/`：`vite.config.ts` 为 `"@": "/src/"`，`vitest.config.ts` 映射到 `./src` 绝对路径，`tsconfig.json`/`tsconfig.app.json` 的 paths 为 `"@/*": ["./src/*"]`
- 代码格式化：无 lint / format npm scripts；根目录 `.oxfmtrc.json` 是 oxfmt 配置（双引号、分号、trailingCommas: all），未接入 npm scripts
- 实测环境：Node v24.12.0、pnpm 11.25.0（README 声明需 Node `^20.19.0 || >=22.12.0`，Vite 8 的运行要求）

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动 Vite dev server（不做类型检查），访问 `http://localhost:5173` |
| `pnpm build` | `vue-tsc -b` 类型检查 + `vite build`，产物到 `dist/` |
| `pnpm test` | 运行 vitest 单测（当前 2 个文件 26 个用例） |
| `pnpm preview` | 预览构建产物（需先 `pnpm build`） |

> 本仓库无 `pnpm lint` / `pnpm format` 等脚本（见 `package.json` `scripts`）。

## 目录结构（仅列真实存在的文件）

- `index.html` — 入口页：`<div id="app">` + `/src/main.ts`；favicon `/favicon.svg`；`lang="en"`、标题 `llm-api-key-manager`
- `src/main.ts` — 应用入口：`createApp(App).mount("#app")`，引入 `./style.css`
- `src/App.vue` — 根组件（唯一状态持有者 + 全部业务编排）
- `src/types.ts` — 数据模型：`Item { id, provider, api_url, api_token, docs_url, remark? }`（全字符串，仅 `remark` 可选）；`ItemDraft = Omit<Item, "id">`
- `src/style.css` — Tailwind v4 主题入口（见「约定与注意事项」）
- `src/lib/utils.ts` — `cn()`（clsx + tailwind-merge），UI 原语依赖
- `src/lib/download.ts` — 下载工具：`downloadBlob` / `downloadText` / `triggerDownload`（隐藏 `<a id="for-emit-download">` 触发）
- `src/lib/key-item-file.ts` — 导入导出纯函数（见下）
- `src/components/key-list/index.vue` — 密钥表格（shadcn Table）+ 复制 / 删除（Popover 二次确认）/ 修改
- `src/components/key-item-form-dialog/index.vue` — 新增 / 修改共用的弹窗表单
- `src/components/key-item-form-dialog/validation.ts` — 表单校验纯函数（见下）
- `src/components/ui/` — shadcn-vue 原语 8 组：`alert/ button/ dialog/ input/ label/ popover/ table/ tooltip/`，每组含 `index.ts` 桶导出（`button`、`alert` 还导出 cva `variants`）
- `tests/unit/validation.test.ts`、`tests/unit/key-item-file.test.ts` — 纯函数 vitest 单测（26 用例）
- `public/` — `favicon.svg`（被 `index.html` 引用）；`vite.svg`、`icons.svg` 为模板遗留，src 中无引用
- `dist/` — 构建产物（.gitignore 已忽略，不入库）

## 关键模块与数据流

### 数据模型与持久化（`src/types.ts` + `src/App.vue`）

- `Item` 字段：`provider` 提供商、`api_url` 接口地址、`api_token` 接口密钥、`docs_url` 文档地址（可为空串）、`remark` 备注（可选）；`id` 为去重键（uuid）
- 状态：`App.vue` 用 `useLocalStorage<Item[]>("__llm_api_key_items__", [种子数据])`（`@vueuse/core`），key 字面量 `__llm_api_key_items__` 硬编码在 `App.vue`；赋值/增删自动写回 localStorage
- 种子含 1 条演示数据（provider「公益API」，id 固定 `905fd4d1-…`）；**api_token 明文存于 localStorage**
- 页面顶部 Alert 提示「所有内容仅存在本地 localStorage，如果要持久保存请导出到本地文件」

### 展示链路（`src/App.vue` → `src/components/key-list/index.vue`）

- 表格 6 列：提供商 / 接口地址 / 接口密钥 / 备注说明 / 文档地址 / 操作
- 长文本截断：`api_url`、`api_token` 超过 15 字符显示前 15 字符 + `...`，Tooltip 悬浮看全文
- 复制：接口地址列两个复制按钮（复制地址本身 / 复制追加 `/chat/completions` 后缀的地址，`api_url` 以 `/` 结尾时不重复加）；密钥列一个复制按钮；均 emit `copy` 由 `App.vue` 的 `handleCopy` 调 `copy-to-clipboard`（失败仅 `console.error`）
- 文档地址非空时显示「新标签页打开」链接（`<a target="_blank">`）
- 操作列：修改 → emit `edit(item)`；删除 → Popover 二次确认后 emit `delete(id)`
- 无空态：删除全部条目后只剩表头（`TableEmpty` 原语存在但未被引用）

### 新增 / 修改（`src/components/key-item-form-dialog/index.vue`）

- 共用组件，props `mode: "create" | "edit"`、`open`、`item?`；emits `update:open`、`submit(ItemDraft)`
- 打开时（`watch [open, item, mode]`）按 mode 重置草稿：create 清空 / edit 预填 `item`
- 「保存」先 `validateKeyItemDraft`（trim 后校验，逐字段中文错误内联展示），不通过不关闭；通过则 `emit("submit", draft)` 并关闭
- `submitted` 一次性提交守卫：防止关闭动画期间重复触发保存
- `App.vue` 侧：`createKeyItem` 以 `uuidv4()` 生成 id push 末尾；`updateKeyItem` 按 `editItem.id` 原位替换（id 不变）

### 导出（`src/App.vue` + `src/lib/key-item-file.ts` + `src/lib/download.ts`）

- `serializeItems(items)` → `JSON.stringify(items, null, 2)`（裸数组 JSON）
- Blob(`application/json`) → `downloadBlob(blob, exportFilename())`；文件名 `llm-api-keys-YYYYMMDD-HHmmss.json`（`exportFilename()`）

### 导入（`src/App.vue` + `src/lib/key-item-file.ts`）

- 隐藏 `<input type="file" accept=".json,application/json">`，选完即清空 `input.value`（允许重复选同一文件）
- `file.text()` 失败 → 报「读取文件失败」；`parseKeyItemsFile` 失败（非 JSON / 非数组）→ 弹窗报错
- `parseKeyItemsFile`：逐条 `normalizeEntry`——必填 `id/provider/api_url/api_token` 非空（trim 后判空）、`api_url` 须 `isHttpUrl`；`docs_url`/`remark` 缺省补空串、存在但非字符串则整条无效；非法条目计数跳过（`skipped`）
- `mergeItems(existing, incoming)`：按 `id` 合并——已有 id 原位覆盖（保持顺序）、新 id 追加末尾；不原地修改入参；返回 `{ items, added, updated }`
- 成功后写回 `items.value`（自动持久化），弹窗汇报「新增 X 条，更新 Y 条，跳过 Z 条」

### 校验（`src/components/key-item-form-dialog/validation.ts`）

- `validateKeyItemDraft(draft)` → `KeyItemErrors`：provider / api_url / api_token 必填；`api_url` 必须 `isHttpUrl`；校验前 trim 字段
- `isHttpUrl`：`new URL` 可解析且 protocol 为 `http:` / `https:`——表单与导入共用（`key-item-file.ts` 引用同一函数），单一来源
- 类型导出：`KeyItemField = keyof ItemDraft`、`KeyItemErrors = Partial<Record<KeyItemField, string>>`

## 约定与注意事项（均有代码佐证）

1. **代码风格分两套**：`src/components/ui/` 内为 shadcn 生成风格（单引号、无分号，如 `button/index.ts` 的 cva）；业务代码用双引号 + 分号（与 `.oxfmtrc.json` 一致）。新加业务文件跟随后者；改动 ui 原语注意别用 oxfmt 风格把生成代码改乱。
2. **UI 原语调用写法两种等价**：`@/components/ui/alert`（目录桶）与 `@/components/ui/button/index.ts`（显式文件）在代码中并存，均可解析。
3. **改配色只动 `src/style.css`**：Tailwind v4 无配置文件；`@theme inline` 映射 CSS 变量为 Tailwind token，`:root` / `.dark` 定义明暗两套 oklch 变量（`.dark` 以类名切换，界面暂无切换按钮）。
4. **新增 shadcn 原语**：放 `src/components/ui/<name>/` 并写 `index.ts` 桶导出（现有 8 组均可照抄）；桶内导出但业务未引用的有 `AlertAction`、`AlertDescription`、`PopoverAnchor/Description/Header/Title`、`TableCaption/TableEmpty/TableFooter` 等。
5. **校验 / 导入规则修改点**：表单规则在 `validation.ts`（`validateKeyItemDraft`），导入逐条规则在 `lib/key-item-file.ts`（`normalizeEntry`）。加必填或格式规则需两处同步，并在 `tests/unit/` 补纯函数单测（`pnpm test` 目前只跑 node 环境纯函数）。
6. **`copy` 事件签名有误导**：`key-list/index.vue` 里 declares `(e: "copy", id: string)`，实际负载是「要复制的文本」（api_url / api_token / 追加后缀后的地址），`App.vue` 侧 `handleCopy(text)` 直接复制；改这块类型时留意 payload 语义。
7. **文案约定**：面向用户的界面文案（按钮、提示、校验错误、弹窗标题）一律中文。
8. **构建 / 测试基线**（2026-09-03 实测）：`pnpm test` 2 个文件 26 用例全过；`pnpm build`（`vue-tsc -b` + `vite build`）通过。`tsconfig.app.json` 开了 `noUnusedLocals` 等严格项，改动后先跑 build 防 TS6133。
9. **Git 现状**：功能开发在 `dev` 分支（HEAD `f0386c91`，该提交删除了旧 `AGENTS.md` 与 `docs/superpowers/` 计划文档）；`main` 停留在初始化后不久。本文件是依据当前 `dev` 代码重新整理生成的。
10. **README.md** 与本文档分开维护：README 面向使用说明，AGENTS 面向后续开发；README 当前在工作区有未提交更新。
