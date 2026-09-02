# llm-api-key-manager（大模型提供商 API 密钥管理）

> 纯前端 Vue 3 单页应用：以表格管理大模型提供商的 API 密钥条目（提供商 / 接口地址 / 密钥 / 文档地址 / 备注），支持添加、修改、删除，以及 JSON 导入 / 导出到本地文件。数据经 `@vueuse/core` 的 `useLocalStorage` 持久化到浏览器 localStorage（键 `__llm_api_key_items__`），无后端、`src` 内无任何网络请求。用户可见文案为中文。新增 / 修改共用弹窗表单 `key-item-form-dialog`；导入 / 导出核心逻辑在 `src/lib/key-item-file.ts`（纯函数）；校验纯函数与文件解析均有 vitest 单测覆盖。

## 技术栈与环境

- 框架：Vue 3.5（`<script setup lang="ts">` SFC）+ TypeScript ~6.0
- 构建：Vite 8 + `@vitejs/plugin-vue`；类型检查走 `vue-tsc`（build 脚本内）；`package.json` 为 `"type": "module"`
- 样式：Tailwind CSS v4（CSS-first，**无 `tailwind.config.*`**，主题 token 全部在 `src/style.css`）+ `tw-animate-css`
- UI：shadcn-vue 2 + reka-ui 2（`components.json`：style `reka-nova`、icon `tabler`）；图标库 `@tabler/icons-vue`
- 工具：`@vueuse/core`（useLocalStorage）、`clsx` / `tailwind-merge` / `class-variance-authority`（`cn()`）、`uuid`（新增条目 id）
- 无路由（无 vue-router）、无状态库（无 pinia）、无 lint / format 脚本；根目录 `.oxfmtrc.json` 是 oxfmt 配置（双引号、分号、trailingCommas all），未接入 npm scripts
- 测试：vitest（node 环境，仅覆盖纯函数：校验 + 导入导出解析合并），脚本 `pnpm test`
- 包管理：pnpm（`pnpm-lock.yaml`；`pnpm-workspace.yaml` 仅 `allowBuilds: vue-demi: true`）
- 路径别名：`@` → `src/`（`vite.config.ts` `resolve.alias` `"@": "/src/"`，与 `tsconfig.json` / `tsconfig.app.json` 的 paths `"@/*": ["./src/*"]` 一致）
- Git：功能在 `dev` 分支开发（计划文档见 `docs/superpowers/plans/`）

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动 Vite dev server（不做类型检查） |
| `pnpm build` | `vue-tsc -b` 类型检查 + `vite build`，产出 `dist/` |
| `pnpm test` | 运行 vitest 单测（校验模块 + 导入导出模块） |
| `pnpm preview` | 预览构建产物（需先 build 产出 `dist/`） |

## 目录结构

（只列实际存在的文件）

- `index.html` — 入口页：`<div id="app">`，加载 `/src/main.ts`；favicon 用 `/favicon.svg`
- `src/main.ts` — 应用入口：`createApp(App).mount("#app")`，引入 `./style.css`
- `src/App.vue` — 根组件（唯一状态持有者）：持有 `items`（localStorage 绑定）；创建 / 编辑弹窗开关与结果弹窗；新增 / 修改 / 删除 / 导入 / 导出逻辑
- `src/types.ts` — 数据模型 `Item`（全字符串字段，`remark` 可选）与 `ItemDraft = Omit<Item, "id">`
- `src/style.css` — Tailwind v4 主题入口：`@import "tailwindcss"`；`@theme inline` 把 shadcn CSS 变量映射成 Tailwind token；`:root` / `.dark` 定义明暗两套 oklch 变量；`@custom-variant dark` 以 `.dark` 类切换暗色
- `src/lib/utils.ts` — `cn()`（clsx + tailwind-merge），shadcn 组件依赖
- `src/lib/key-item-file.ts` — 导入导出纯函数：`serializeItems` / `parseKeyItemsFile` / `mergeItems`
- `src/components/key-list/index.vue` — 密钥表格（shadcn Table）：props `items: Item[]`，emits `delete(id)` / `edit(item)`；超 15 字符文本截断为 `前15字符 + "..."`
- `src/components/key-item-form-dialog/index.vue` — 创建 / 修改共用弹窗表单（Dialog + 本地草稿 + 校验），emits `submit(ItemDraft)`
- `src/components/key-item-form-dialog/validation.ts` — 纯函数校验 `validateKeyItemDraft` / `isHttpUrl`，导出 `KeyItemField`、`KeyItemErrors`
- `src/components/ui/` — shadcn-vue 原语：`alert/`、`button/`、`table/`、`popover/`、`tooltip/`、`dialog/`、`input/`、`label/`，每个子目录含 `index.ts` 桶导出
- `tests/unit/validation.test.ts`、`tests/unit/key-item-file.test.ts` — 纯函数 vitest 单测
- `public/` — `favicon.svg` 被引用；`vite.svg`、`icons.svg` 为模板遗留，未被引用

## 关键模块与数据流

- 数据模型：`Item { id, provider, api_url, api_token, docs_url, remark? }`；表单负载 `ItemDraft` 无 id
- 状态：`App.vue` 用 `useLocalStorage<Item[]>("__llm_api_key_items__", [种子数据])`；key 字面量 `__llm_api_key_items__` 硬编码于 `App.vue`；**api_token 明文存入浏览器 localStorage**；种子含 1 条演示数据（provider「新疆公益API」等）
- 展示链路：`App.vue` 的 `items` → `<KeyList :items>`；表格 6 列 = provider / api_url / api_token / docs_url / remark / 操作；docs_url 以新标签页打开
- 新增链路：「添加新的API密钥」→ 创建弹窗（空草稿）→「保存」先校验（不通过则显示中文内联错误、不关闭）→ `emit("submit", draft)` → `createKeyItem` 以 `uuidv4()` 生成 id 后 push 到末尾 → 弹窗自动关闭
- 修改链路：行内「修改」→ `showUpdateForm` 记录 `editItem` → 编辑弹窗预填 →「保存」校验通过后 `emit("submit", draft)` → `updateKeyItem` 按 `editItem.id` 原位替换 → 弹窗自动关闭
- 导出链路：「导出到本地」→ `serializeItems(items)` 输出裸数组 JSON → Blob + 临时 `<a download>` 触发下载，文件名 `llm-api-keys-YYYYMMDD-HHmmss.json`
- 导入链路：「导入JSON数据」→ 隐藏 file input 选 .json → `file.text()` → `parseKeyItemsFile`（逐条校验：结构 + provider/api_url/api_token 非空 + api_url 为 http(s)；trim 后入库；docs_url/remark 缺省补空串；非法条目计数跳过）→ `mergeItems` 按 id 合并（已存在原位覆盖、无冲突追加末尾）→ 写回 `items.value` 自动持久化 → Dialog 弹窗显示新增 / 更新 / 跳过条数或失败原因
- 校验：`validation.ts` 的 `validateKeyItemDraft` 服务表单；`key-item-file.ts` 的 `parseKeyItemsFile` 复用其 `isHttpUrl` 判定 URL（单一来源）
- 取消链路：取消按钮 / 右上关闭 / 遮罩点击 / Esc 仅置 `open=false` 丢弃草稿，不改动数据
- 删除链路（Popover 二次确认）：`emit("delete", id)` → `deleteKeyItem` 过滤数组 → useLocalStorage 自动写回

## 当前状态与注意事项

1. **功能完成度**：列表展示、添加、修改（均带校验）、删除（Popover 二次确认）、导入（JSON 合并去重）、导出（本地文件）全部可用；行内复制按钮仍为空置（仅 Tooltip）。
2. **构建与测试**：`pnpm build`、`pnpm test` 均通过。改动涉及多个组件时先跑一遍，避免 `noUnusedLocals`（TS6133）等严格选项把未接线代码放行到 CI 之外。
3. **字体疑似笔误**：`src/style.css` 第 2 行从 Google Fonts 加载的族名为 `JetBrains Mono`（已核实该 @import 返回的族名），而 `@theme` 中 `--font-sans` 引用 `'JetBrains Mono Variable'`——两者不一致，实际渲染会回退到系统 monospace。
4. **主题约定**：改配色只动 `src/style.css` 的 `:root` / `.dark` CSS 变量与 `@theme` 映射，不要新建 `tailwind.config.*`（Tailwind v4 无配置文件）。
5. **新增 shadcn 原语**：在 `src/components/ui/<name>/` 放置组件并提供 `index.ts` 桶导出；ui 目录内保持 shadcn 生成风格（单引号、无分号），业务代码用双引号 + 分号（与 `.oxfmtrc.json` 一致）。
6. **校验与导入规则**：表单校验逻辑在 `validation.ts`，导入解析在 `lib/key-item-file.ts`——新增必填 / 格式规则先改纯函数并补单测；导入要求 `id` 必填（去重键），api_url 判定复用 `isHttpUrl`。
7. **文案约定**：面向用户的界面文案保持中文。
