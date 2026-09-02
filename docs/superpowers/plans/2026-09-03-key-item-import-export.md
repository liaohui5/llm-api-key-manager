# API 密钥「导入 / 导出」实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 接上 `App.vue` 已预留的「导入JSON数据 / 导出到本地」功能：导出当前列表为裸数组 JSON 文件并触发浏览器下载；导入 .json 文件按 id 合并去重（已存在则原位覆盖更新、无冲突追加末尾），结果用 Dialog 弹窗反馈。

**架构：** 核心逻辑抽为纯函数模块 `src/lib/key-item-file.ts`（序列化 / 解析校验 / 合并，零 DOM，vitest 单测），`App.vue` 只做胶水：隐藏 file input 选文件、读文本、调纯函数、写回 `items.value`（useLocalStorage 自动持久化）、内联 `ui/dialog` 展示结果。URL 判定复用 `validation.ts` 的 `isHttpUrl`（单一来源）。

**技术栈：** Vue 3.5（`<script setup lang="ts">`）、TypeScript ~6.0、Vite 8、vitest（node 环境）、reka-ui Dialog 原语、`@vueuse/core`（useLocalStorage）、浏览器原生 File/Blob API。无新增依赖。

**前置说明（每个任务都适用）：**

- 工作分支：`dev`（当前已在此分支，勿切换）。
- 代码风格：业务代码与测试用**双引号 + 分号**；`src/components/ui/` 下原语是 shadcn 生成风格（单引号、无分号）——本次不改动 ui 目录。
- 仓库现状（已核实）：`src/App.vue` 的 `items` 存于 localStorage（键 `__llm_api_key_items__`，非旧文档里的 `__item_storage_key__`——AGENTS.md 过期，任务 3 顺带修正）；顶部 Alert 提示条（ui/alert）已存在；两个空壳函数 `importJson` / `exportAndDownload` 已被模板按钮引用（无 TS6133 风险）；`validation.ts` 导出 `isHttpUrl`；vitest 已配置（include `tests/**/*.test.ts`、别名 `@` → src）；`pnpm test` 现有 10 个用例全绿、`pnpm build` 全绿。
- 每次 commit 只 add 任务列出的文件；工作区如有未跟踪的 `.pnpm-store/` 遗留物，勿用 `git add .` / `git add -A` 纳入。
- commit message 用英文 Conventional Commits（与仓库历史一致）。

---

## 任务 1：新增 `src/lib/key-item-file.ts` 纯函数模块（TDD）

**文件：**
- 创建：`src/lib/key-item-file.ts`
- 创建：`tests/unit/key-item-file.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `tests/unit/key-item-file.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  mergeItems,
  parseKeyItemsFile,
  serializeItems,
} from "../../src/lib/key-item-file";
import type { Item } from "../../src/types";

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "id-1",
    provider: "示例提供商",
    api_url: "https://api.example.com/v1",
    api_token: "sk-test",
    docs_url: "",
    remark: "",
    ...overrides,
  };
}

describe("serializeItems", () => {
  it("把条目数组序列化为缩进 JSON 数组文本", () => {
    const items = [item()];
    expect(JSON.parse(serializeItems(items))).toEqual(items);
  });

  it("空数组输出 []", () => {
    expect(JSON.parse(serializeItems([]))).toEqual([]);
  });
});

describe("parseKeyItemsFile", () => {
  it("合法数组全部通过并 trim 各字段", () => {
    const raw = [
      {
        id: "  id-1  ",
        provider: "  示例提供商  ",
        api_url: "  https://api.example.com/v1  ",
        api_token: "  sk-test  ",
        docs_url: " https://example.com/docs ",
        remark: " 备注 ",
      },
    ];
    const outcome = parseKeyItemsFile(JSON.stringify(raw));
    expect(outcome).toEqual({
      ok: true,
      validItems: [item({ docs_url: "https://example.com/docs", remark: "备注" })],
      skipped: 0,
    });
  });

  it("docs_url / remark 缺省时补为空字符串", () => {
    const raw = [
      { id: "id-1", provider: "示例提供商", api_url: "https://api.example.com/v1", api_token: "sk-test" },
    ];
    const outcome = parseKeyItemsFile(JSON.stringify(raw));
    expect(outcome).toEqual({ ok: true, validItems: [item()], skipped: 0 });
  });

  it("忽略多余键", () => {
    const raw = [
      { id: "id-1", provider: "示例提供商", api_url: "https://api.example.com/v1", api_token: "sk-test", extra: 123, nested: { a: 1 } },
    ];
    const outcome = parseKeyItemsFile(JSON.stringify(raw));
    expect(outcome).toEqual({ ok: true, validItems: [item()], skipped: 0 });
  });

  it("id 缺失的条目被跳过", () => {
    const raw = [{ provider: "示例提供商", api_url: "https://api.example.com/v1", api_token: "sk-test" }];
    const outcome = parseKeyItemsFile(JSON.stringify(raw));
    expect(outcome).toEqual({ ok: true, validItems: [], skipped: 1 });
  });

  it("必填字段为空串/全空白/缺失的条目被跳过", () => {
    const raw = [
      { id: "a", provider: "   ", api_url: "https://x.com", api_token: "t" },
      { id: "b", provider: "P", api_url: "", api_token: "t" },
      { id: "c", provider: "P", api_url: "https://x.com", api_token: undefined },
      { id: "d", provider: "P", api_url: "https://x.com" },
    ];
    const outcome = parseKeyItemsFile(JSON.stringify(raw));
    expect(outcome).toEqual({ ok: true, validItems: [], skipped: 4 });
  });

  it("api_url 非法(非 http/https 或不可解析)的条目被跳过", () => {
    const raw = [
      { id: "a", provider: "P", api_url: "ftp://x.com", api_token: "t" },
      { id: "b", provider: "P", api_url: "not a url", api_token: "t" },
    ];
    const outcome = parseKeyItemsFile(JSON.stringify(raw));
    expect(outcome).toEqual({ ok: true, validItems: [], skipped: 2 });
  });

  it("docs_url / remark 存在但非字符串时整条被跳过", () => {
    const raw = [
      { id: "a", provider: "P", api_url: "https://x.com", api_token: "t", docs_url: 123 },
      { id: "b", provider: "P", api_url: "https://x.com", api_token: "t", remark: ["x"] },
    ];
    const outcome = parseKeyItemsFile(JSON.stringify(raw));
    expect(outcome).toEqual({ ok: true, validItems: [], skipped: 2 });
  });

  it("数组元素为对象以外类型(字符串/null/数字)时逐条跳过", () => {
    const outcome = parseKeyItemsFile(
      JSON.stringify([{ id: "id-1", provider: "示例提供商", api_url: "https://api.example.com/v1", api_token: "sk-test" }, "junk", null, 42]),
    );
    expect(outcome.ok && outcome.validItems).toEqual([item()]);
    expect(outcome.ok && outcome.skipped).toBe(3);
  });

  it("非 JSON 文本整体失败", () => {
    const outcome = parseKeyItemsFile("{ not json ");
    expect(outcome).toEqual({ ok: false, error: "文件内容不是合法的 JSON" });
  });

  it("JSON 合法但顶层不是数组时整体失败", () => {
    const outcome = parseKeyItemsFile(JSON.stringify({ items: [] }));
    expect(outcome).toEqual({ ok: false, error: "文件不是合法的 JSON 数组" });
  });
});

describe("mergeItems", () => {
  it("不原地修改入参", () => {
    const existing = [item({ id: "a" })];
    const incoming = [item({ id: "b" })];
    mergeItems(existing, incoming);
    expect(existing).toEqual([item({ id: "a" })]);
    expect(incoming).toEqual([item({ id: "b" })]);
  });

  it("无冲突 id 追加到末尾", () => {
    const existing = [item({ id: "a" })];
    const incoming = [item({ id: "b" }), item({ id: "c" })];
    const result = mergeItems(existing, incoming);
    expect(result.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(result.added).toBe(2);
    expect(result.updated).toBe(0);
  });

  it("已存在 id 原位覆盖更新且保持顺序", () => {
    const existing = [item({ id: "a" }), item({ id: "b", provider: "旧" }), item({ id: "c" })];
    const incoming = [item({ id: "b", provider: "新" })];
    const result = mergeItems(existing, incoming);
    expect(result.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(result.items[1].provider).toBe("新");
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
  });

  it("同一文件内重复 id 后到者生效", () => {
    const result = mergeItems([], [item({ id: "a", provider: "第一" }), item({ id: "a", provider: "第二" })]);
    expect(result.items).toEqual([item({ id: "a", provider: "第二" })]);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`pnpm test`
预期：FAIL，报 `Cannot find module '../../src/lib/key-item-file'`（模块尚不存在）。

- [ ] **步骤 3：实现纯函数模块**

创建 `src/lib/key-item-file.ts`：

```ts
import type { Item } from "@/types";
import { isHttpUrl } from "@/components/key-item-form-dialog/validation";

export interface MergeResult {
  items: Item[];
  added: number;
  updated: number;
}

export type ParseOutcome =
  | { ok: true; validItems: Item[]; skipped: number }
  | { ok: false; error: string };

export function serializeItems(items: Item[]): string {
  return JSON.stringify(items, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 选填字段：缺省 → ""；存在但非字符串 → null（整条无效） */
function optionalString(value: unknown): string | null {
  if (value === undefined) return "";
  return typeof value === "string" ? value.trim() : null;
}

function normalizeEntry(raw: unknown): Item | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const provider = typeof raw.provider === "string" ? raw.provider.trim() : "";
  const apiUrl = typeof raw.api_url === "string" ? raw.api_url.trim() : "";
  const apiToken = typeof raw.api_token === "string" ? raw.api_token.trim() : "";
  if (!id || !provider || !apiUrl || !apiToken || !isHttpUrl(apiUrl)) return null;

  const docsUrl = optionalString(raw.docs_url);
  const remark = optionalString(raw.remark);
  if (docsUrl === null || remark === null) return null;

  return { id, provider, api_url: apiUrl, api_token: apiToken, docs_url: docsUrl, remark };
}

export function parseKeyItemsFile(text: string): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件内容不是合法的 JSON" };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "文件不是合法的 JSON 数组" };
  }

  const validItems: Item[] = [];
  let skipped = 0;
  for (const entry of parsed) {
    const item = normalizeEntry(entry);
    if (item) validItems.push(item);
    else skipped++;
  }
  return { ok: true, validItems, skipped };
}

export function mergeItems(existing: Item[], incoming: Item[]): MergeResult {
  const items = [...existing];
  const indexById = new Map<string, number>();
  existing.forEach((item, index) => indexById.set(item.id, index));

  let added = 0;
  let updated = 0;
  for (const item of incoming) {
    const index = indexById.get(item.id);
    if (index === undefined) {
      indexById.set(item.id, items.length);
      items.push(item);
      added++;
    } else {
      items[index] = item;
      updated++;
    }
  }
  return { items, added, updated };
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`pnpm test`
预期：PASS——`serializeItems` 2 例 + `parseKeyItemsFile` 11 例 + `mergeItems` 4 例全部通过，且既有 `validation.test.ts` 10 例仍绿。

- [ ] **步骤 5：类型检查**

运行：`pnpm exec vue-tsc -b`
预期：无错误（当前仓库基线已是全绿，不存在 App.vue 遗留错误）。

- [ ] **步骤 6：Commit**

```bash
git add src/lib/key-item-file.ts tests/unit/key-item-file.test.ts
git commit -m "feat: add key item import/export pure functions with unit tests"
```

## 任务 2：App.vue 接线（导入 / 导出 + 结果弹窗）

**文件：**
- 修改：`src/App.vue`（全量替换为下方内容）

- [ ] **步骤 1：全量改写 `src/App.vue`**

用以下内容**整文件替换** `src/App.vue`（保留顶部 Alert 提示条、三个按钮、KeyList、创建/修改弹窗；新增隐藏 file input 与导入结果 Dialog）：

```vue
<template>
  <div class="w-8/10 mx-auto pb-30">
    <!-- top title -->
    <h2 class="text-2xl text-center py-10">大模型提供商API密钥管理</h2>

    <!-- top tips -->
    <div class="flex justify-center py-2">
      <Alert class="w-3/7">
        <IconInfoCircle />
        <AlertTitle>注意所有内容仅存在本地 localStorage, 如果要持久保存请导出到本地文件</AlertTitle>
      </Alert>
    </div>

    <!-- buttons -->
    <div class="flex items-center justify-end py-2">
      <Button variant="outline" class="mx-2 hover:cursor-pointer" @click="importJson">
        <span>导入JSON数据</span>
      </Button>
      <Button variant="outline" class="mx-2 hover:cursor-pointer" @click="exportAndDownload">
        <span>导出到本地</span>
      </Button>
      <Button variant="outline" class="hover:cursor-pointer" @click="showCreateForm">
        <span>添加新的API密钥</span>
      </Button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onFileSelected"
    />

    <!-- llm api items table -->
    <KeyList :items="items" @delete="deleteKeyItem" @edit="showUpdateForm" />

    <!-- create form dialog -->
    <KeyItemFormDialog
      mode="create"
      :open="createOpen"
      @update:open="hideCreateForm"
      @submit="createKeyItem"
    />

    <!-- update form dialog -->
    <KeyItemFormDialog
      mode="edit"
      :open="hasEditItem"
      :item="editItem"
      @update:open="hideUpdateForm"
      @submit="updateKeyItem"
    />

    <!-- import result dialog -->
    <Dialog v-model:open="resultOpen">
      <DialogContent class="sm:max-w-md">
        <DialogTitle>{{ resultTitle }}</DialogTitle>
        <p v-if="importResult && importResult.kind === 'success'" class="text-sm text-foreground">
          新增 {{ importResult.added }} 条，更新 {{ importResult.updated }} 条，跳过 {{ importResult.skipped }} 条
        </p>
        <p v-else-if="importResult && importResult.kind === 'error'" class="text-sm text-destructive">
          {{ importResult.message }}
        </p>
        <DialogFooter>
          <Button variant="outline" @click="resultOpen = false">关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useLocalStorage } from "@vueuse/core";
import KeyList from "@/components/key-list/index.vue";
import KeyItemFormDialog from "@/components/key-item-form-dialog/index.vue";
import { IconInfoCircle } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button/index.ts";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Item, type ItemDraft } from "@/types";
import {
  mergeItems,
  parseKeyItemsFile,
  serializeItems,
} from "@/lib/key-item-file";

const __ITEMS_STORAGE_KEY__ = "__llm_api_key_items__";
const items = useLocalStorage<Item[]>(__ITEMS_STORAGE_KEY__, [
  {
    id: "905fd4d1-38a4-48b5-95e5-2f0122dfd902",
    provider: "新疆公益API",
    api_url: "https://api.hcnsec.cn/v1",
    api_token: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    docs_url: "https://api.hcnsec.cn",
    remark: "提供免费模型",
  },
]);

const createOpen = ref(false);
const editItem = ref<Item | null>(null);
const hasEditItem = computed(() => editItem.value !== null);

type ImportResult =
  | { kind: "success"; added: number; updated: number; skipped: number }
  | { kind: "error"; message: string };

const fileInput = ref<HTMLInputElement | null>(null);
const importResult = ref<ImportResult | null>(null);
const resultOpen = computed({
  get: () => importResult.value !== null,
  set: (open: boolean) => {
    if (!open) importResult.value = null;
  },
});
const resultTitle = computed(() =>
  importResult.value?.kind === "success" ? "导入结果" : "导入失败",
);

function showCreateForm() {
  createOpen.value = true;
}

function hideCreateForm() {
  createOpen.value = false;
}

function showUpdateForm(item: Item) {
  editItem.value = item;
}

function hideUpdateForm() {
  editItem.value = null;
}

function createKeyItem(draft: ItemDraft) {
  items.value.push({ ...draft, id: uuidv4() });
}

function updateKeyItem(draft: ItemDraft) {
  const targetId = editItem.value?.id;
  if (!targetId) return;
  items.value = items.value.map((item) =>
    item.id === targetId ? { ...draft, id: targetId } : item,
  );
}

function deleteKeyItem(id: string) {
  items.value = items.value.filter((item) => item.id !== id);
}

function importJson() {
  fileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = ""; // 允许重复选择同一文件

  let text: string;
  try {
    text = await file.text();
  } catch {
    importResult.value = { kind: "error", message: "读取文件失败" };
    return;
  }

  const outcome = parseKeyItemsFile(text);
  if (!outcome.ok) {
    importResult.value = { kind: "error", message: outcome.error };
    return;
  }

  const merged = mergeItems(items.value, outcome.validItems);
  items.value = merged.items;
  importResult.value = {
    kind: "success",
    added: merged.added,
    updated: merged.updated,
    skipped: outcome.skipped,
  };
}

function exportAndDownload() {
  const blob = new Blob([serializeItems(items.value)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFilename();
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `llm-api-keys-${date}-${time}.json`;
}
</script>
```

- [ ] **步骤 2：类型检查**

运行：`pnpm exec vue-tsc -b`
预期：无错误（新 import 全部被使用、无未使用变量）。

- [ ] **步骤 3：运行测试**

运行：`pnpm test`
预期：PASS（纯函数模块不受组件接线影响，既有 + 新增用例全绿）。

- [ ] **步骤 4：构建验证**

运行：`pnpm build`
预期：PASS，vite 产出 `dist/`。

- [ ] **步骤 5：dev 冒烟**

运行：`pnpm dev --port 5199 & sleep 4; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5199/; kill %1 2>/dev/null`
预期：输出 `200`（macOS 无 timeout 命令时可用等价的「后台起 dev + curl + kill」写法）。

- [ ] **步骤 6：Commit**

```bash
git add src/App.vue
git commit -m "feat: wire up json import and export in App"
```

## 任务 3：同步 AGENTS.md 与验收

**文件：**
- 修改：`AGENTS.md`（全量替换为下方内容）

- [ ] **步骤 1：全量改写 `AGENTS.md`**

用以下内容**整文件替换** `AGENTS.md`（修正过期 storage 键名 `__item_storage_key__` → `__llm_api_key_items__`；新增 alert 原语、key-item-file 模块与导入 / 导出数据流）：

```markdown
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
```

- [ ] **步骤 2：最终验收**

运行：`pnpm test`
预期：PASS（校验 + 导入导出用例全绿）。

运行：`pnpm build`
预期：PASS（vue-tsc + vite build 成功）。

- [ ] **步骤 3：Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync AGENTS.md with import/export feature"
```

---

## 完成标准

1. `pnpm test` 通过（既有校验用例 + 新增 `key-item-file` 用例）。
2. `pnpm build` 通过。
3. dev 手工冒烟：导出下载 `llm-api-keys-YYYYMMDD-HHmmss.json`、内容为缩进 JSON 数组；导入合法文件 → 结果弹窗显示新增 / 更新 / 跳过条数且列表与 localStorage 更新；导入含重复 id 文件 → 原位更新；导入非法 JSON → 失败弹窗且列表不变；重复选择同一文件可再次导入。
4. AGENTS.md 与代码现状同步（storage 键名、ui/alert、key-item-file、导入导出链路）。
