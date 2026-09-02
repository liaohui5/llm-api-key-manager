# llm-api-key-manager（大模型提供商 API 密钥管理）

> 纯前端 Vue 3 单页应用：以表格管理大模型提供商的 API 密钥条目（提供商 / 接口地址 / 密钥 / 文档地址 / 备注）。数据经 `@vueuse/core` 的 `useLocalStorage` 持久化到浏览器 localStorage（键 `__item_storage_key__`），无后端、`src` 内无任何网络请求。用户可见文案为中文。当前完成度：**列表展示 + 删除可用；新增 / 修改为占位、未接线**（详见「当前状态与注意事项」）。

## 技术栈与环境

- 框架：Vue 3.5（`<script setup lang="ts">` SFC）+ TypeScript ~6.0
- 构建：Vite 8 + `@vitejs/plugin-vue`；类型检查走 `vue-tsc`（build 脚本内）；`package.json` 为 `"type": "module"`
- 样式：Tailwind CSS v4（CSS-first，**无 `tailwind.config.*`**，主题 token 全部在 `src/style.css`）+ `tw-animate-css`
- UI：shadcn-vue 2 + reka-ui 2；配置见 `components.json`（style `reka-nova`、icon `tabler`、baseColor `mist`）；图标库 `@tabler/icons-vue`
- 工具：`@vueuse/core`（useLocalStorage）、`clsx` / `tailwind-merge` / `class-variance-authority`（`cn()`）；依赖 `uuid` 已声明但源码未引用
- 无路由（无 vue-router）、无状态库（无 pinia）、**无 lint / test / format 脚本**；根目录 `.oxfmtrc.json` 是 oxfmt 配置（双引号、分号、trailingCommas all），未接入 npm scripts
- 包管理：pnpm（`pnpm-lock.yaml`；`pnpm-workspace.yaml` 仅 `allowBuilds: vue-demi: true`）
- 路径别名：`@` → `src/`（`vite.config.ts` `resolve.alias` `"@": "/src/"`，与 `tsconfig.json` / `tsconfig.app.json` 的 paths `"@/*": ["./src/*"]` 一致）
- Git：分支 `main`，目前仅 1 个 commit（`chore: init`），功能开发早期

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动 Vite dev server（已验证可启动；不做类型检查，现有桩函数不报错） |
| `pnpm build` | `vue-tsc -b` 类型检查 + `vite build`。⚠ **当前失败**：`App.vue` 未使用的桩函数触发 TS6133（详见「当前状态与注意事项」） |
| `pnpm preview` | 预览构建产物（需先 build 成功产出 `dist/`；当前无 dist） |

## 目录结构

（只列实际存在的文件）

- `index.html` — 入口页：`<div id="app">`，加载 `/src/main.ts`；favicon 用 `/favicon.svg`
- `src/main.ts` — 应用入口：`createApp(App).mount("#app")`，引入 `./style.css`
- `src/App.vue` — 根组件（唯一状态持有者）：持有 `items`（localStorage 绑定）并渲染 `KeyList`；删除逻辑在此；新增 / 编辑相关 6 个函数为空桩
- `src/types.ts` — 数据模型 `Item`（全字符串字段，`remark` 可选）
- `src/style.css` — Tailwind v4 主题入口：`@import "tailwindcss"`；`@theme inline` 把 shadcn CSS 变量映射成 Tailwind token；`:root` / `.dark` 定义明暗两套 oklch 变量；`@custom-variant dark` 以 `.dark` 类切换暗色
- `src/lib/utils.ts` — `cn()`（clsx + tailwind-merge），shadcn 组件依赖
- `src/components/key-list/index.vue` — 密钥表格（shadcn Table）：props `items: Item[]`，emits `delete(id)`；超 15 字符的文本截断为 `前15字符 + "..."`
- `src/components/create-key-item/index.vue` — 占位组件（渲染 "add key item"），未被引用（App.vue 中 import 被注释）
- `src/components/update-key-item/index.vue` — 占位组件（渲染 "update key item"），未被引用
- `src/components/ui/` — shadcn-vue 生成的原语：`button/`、`table/`、`popover/`、`tooltip/`，每个子目录含 `index.ts` 桶导出（如 `Button`、`buttonVariants`）；现有引入有的写 `.../button/index.ts`、有的写目录名，两种均可编译
- `public/` — `favicon.svg` 被引用；`vite.svg`、`icons.svg` 为模板遗留，未被引用

## 关键模块与数据流

- 数据模型：`Item { id, provider, api_url, api_token, docs_url, remark? }`（`src/types.ts`）
- 状态：`App.vue` 用 `useLocalStorage<Item[]>("__item_storage_key__", [种子数据])`；key 字面量 `__item_storage_key__` 硬编码于 `App.vue`；**api_token 明文存入浏览器 localStorage**；种子含 1 条演示数据（provider「新疆公益API」等）
- 展示链路：`App.vue` 的 `items` → `<KeyList :items>`；表格 6 列 = provider / api_url / api_token / docs_url / remark / 操作；docs_url 以新标签页打开
- 删除链路（唯一完整操作）：行内「删除」→ Popover 二次确认「确定」`handleDelete(item)` → `emit("delete", id)` → `App.vue` 的 `deleteKeyItem` 过滤数组 → useLocalStorage 自动写回
- 点击无动作的控件：`App.vue`「添加新的API密钥」按钮、`KeyList`「修改」按钮、api_url / api_token 的复制按钮均未绑定 `@click`（复制按钮只有 TooltipTrigger）

## 当前状态与注意事项

1. **功能完成度**：可用交互仅「列表展示 + 删除（Popover 二次确认）」；新增 / 编辑表单组件未实现。
2. **`pnpm build` 当前失败**：`tsconfig.app.json` 开启 `noUnusedLocals`，而 `App.vue` 中 `showCreateForm` / `hideCreateForm` / `createKeyItem` / `showUpdateForm` / `hideUpdateForm` / `updateKeyItem` 6 个桩函数从未被使用 → vue-tsc 报 TS6133、退出码 2。实现新增 / 编辑时应接线或删除这些桩函数；`pnpm dev` 不受影响。
3. **字体疑似笔误**：`src/style.css` 第 2 行从 Google Fonts 加载的族名为 `JetBrains Mono`（已核实该 @import 返回的族名），而 `@theme` 中 `--font-sans` 引用 `'JetBrains Mono Variable'`——两者不一致，实际渲染会回退到系统 monospace。
4. **主题约定**：改配色只动 `src/style.css` 的 `:root` / `.dark` CSS 变量与 `@theme` 映射，不要新建 `tailwind.config.*`（Tailwind v4 无配置文件）。
5. **新增 shadcn 原语**：按现有模式在 `src/components/ui/<name>/` 放置组件并提供 `index.ts` 桶导出；现有代码一律经该桶引入组件。
6. **文案约定**：面向用户的界面文案保持中文。
