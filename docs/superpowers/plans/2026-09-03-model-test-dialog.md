# 模型测试功能 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为每条密钥记录新增「测试」能力：点击表格「测试」按钮打开弹窗，填写模型名与消息，用原生 fetch 发一次 OpenAI 兼容对话请求，成功/失败结果都展示在同一弹窗内；支持点击「自动获取」从 `api_url` 拉取模型列表供 `<select>` 选择。

**架构：** 新增 `src/components/test-form-dialog/` 目录：`api.ts`（纯函数：URL 拼接、拉取模型、发送对话，可单测）+ `index.vue`（弹窗 UI 与状态编排，本地状态不触碰 localStorage）。`App.vue` 增加 `testItem` ref 与弹窗挂载。不引入 `openai` 依赖，不用 shadcn Select 原语（原生 `<select>`）。

**技术栈：** Vue 3.5 `<script setup lang="ts">`、shadcn-vue Dialog/Input/Label/Button 原语、`@tabler/icons-vue`、vitest（node 环境，`vi.stubGlobal("fetch")` mock）。

**规格：** `docs/superpowers/specs/2026-09-03-model-test-dialog-design.md`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| 创建 `src/components/test-form-dialog/api.ts` | 纯函数：`joinApiPath` / `fetchModels` / `sendChatCompletion`（原生 fetch，Bearer 认证） |
| 创建 `tests/unit/api.test.ts` | 上述纯函数单测（mock 全局 fetch） |
| 创建 `src/components/test-form-dialog/index.vue` | 测试弹窗 UI + 状态编排 |
| 修改 `src/App.vue` | `testItem` ref / `hasTestItem` / `showTestForm` 实现 / `hideTestForm` / 挂载弹窗 |

现有已提交代码（上一轮 commit 已含）：`key-list/index.vue` 已有「测试」按钮并 emit `test(item)`；`App.vue` 已有 `@test="showTestForm"` 接线与 `showTestForm` 空实现（ToDo 注释）。

---

## 任务 1：`api.ts` 纯函数（TDD）

**文件：**
- 创建：`src/components/test-form-dialog/api.ts`
- 测试：`tests/unit/api.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `tests/unit/api.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchModels,
  joinApiPath,
  sendChatCompletion,
} from "../../src/components/test-form-dialog/api";

describe("joinApiPath", () => {
  it("baseURL 无尾斜杠时补一个斜杠再拼路径", () => {
    expect(joinApiPath("https://host/v1", "/models")).toBe("https://host/v1/models");
  });

  it("baseURL 有尾斜杠时不重复加斜杠", () => {
    expect(joinApiPath("https://host/v1/", "/models")).toBe("https://host/v1/models");
  });

  it("path 不带前导斜杠也能拼对", () => {
    expect(joinApiPath("https://host/v1", "models")).toBe("https://host/v1/models");
  });
});

describe("fetchModels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("解析 data[].id 返回模型 id 数组", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] }),
      }),
    );
    await expect(
      fetchModels("https://host/v1", "sk-test"),
    ).resolves.toEqual(["gpt-4o", "gpt-4o-mini"]);
  });

  it("非 2xx 响应抛出错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchModels("https://host/v1", "sk-test")).rejects.toThrow();
  });
});

describe("sendChatCompletion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("解析 choices[0].message.content 并组装正确请求", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "你好" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendChatCompletion("https://host/v1", "sk-test", "gpt-4o", "hello"),
    ).resolves.toBe("你好");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://host/v1/chat/completions");
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
    });
  });

  it("响应缺少 content 时抛出错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      }),
    );
    await expect(
      sendChatCompletion("https://host/v1", "sk-test", "gpt-4o", "hello"),
    ).rejects.toThrow();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm test`
预期：FAIL——`api.ts` 不存在（模块解析失败）。

- [ ] **步骤 3：编写实现代码**

创建 `src/components/test-form-dialog/api.ts`：

```ts
/** 拼接 baseURL 与路径：baseURL 以 / 结尾时不重复加斜杠，path 前导斜杠容错 */
export function joinApiPath(baseURL: string, path: string): string {
  const slash = baseURL.endsWith("/") ? "" : "/";
  return `${baseURL}${slash}${path.replace(/^\/+/, "")}`;
}

async function requestJson(
  baseURL: string,
  apiToken: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(joinApiPath(baseURL, path), {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

/** 拉取模型列表，返回模型 id 数组；非 2xx 或解析失败抛错 */
export async function fetchModels(baseURL: string, apiToken: string): Promise<string[]> {
  const data = (await requestJson(baseURL, apiToken, "/models")) as {
    data?: { id?: string }[];
  };
  return (data.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** 发送一次非流式对话请求，返回模型回复文本；非 2xx 或缺少 content 抛错 */
export async function sendChatCompletion(
  baseURL: string,
  apiToken: string,
  model: string,
  message: string,
): Promise<string> {
  const data = (await requestJson(baseURL, apiToken, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: message }],
    }),
  })) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("响应缺少 choices[0].message.content");
  }
  return content;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm test`
预期：PASS——7 个用例全过（新文件 7 个 + 原 26 个）。

- [ ] **步骤 5：Commit**

```bash
git add src/components/test-form-dialog/api.ts tests/unit/api.test.ts
git commit -m "feat: 测试功能的 API 纯函数（拉取模型/发送对话）"
```

---

## 任务 2：测试弹窗组件 `index.vue`

**文件：**
- 创建：`src/components/test-form-dialog/index.vue`

组件无 node 环境单测（仓库现状只测纯函数），验证方式是 `pnpm build` 类型检查 + `pnpm dev` 手动验证。

- [ ] **步骤 1：编写组件**

创建 `src/components/test-form-dialog/index.vue`：

```vue
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button/index.ts";
import { IconLoader2 } from "@tabler/icons-vue";
import { type Item } from "@/types";
import { fetchModels, sendChatCompletion } from "./api";

const props = withDefaults(
  defineProps<{
    open: boolean;
    item: Item | null;
  }>(),
  {
    item: null,
  },
);

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
}>();

const dialogOpen = computed({
  get: () => props.open,
  set: (open: boolean) => emit("update:open", open),
});

const modelName = ref("");
const message = ref("hello");
const models = ref<string[]>([]);
const modelsLoading = ref(false);
const modelsError = ref(false);
const sending = ref(false);
const sendError = ref("");
const responseText = ref("");

function reset() {
  modelName.value = "";
  message.value = "hello";
  models.value = [];
  modelsLoading.value = false;
  modelsError.value = false;
  sending.value = false;
  sendError.value = "";
  responseText.value = "";
}

watch(
  () => [props.open, props.item],
  () => {
    if (props.open) reset();
  },
  { immediate: true },
);

async function fetchModelList() {
  if (!props.item) return;
  modelsLoading.value = true;
  modelsError.value = false;
  try {
    models.value = await fetchModels(props.item.api_url, props.item.api_token);
  } catch {
    modelsError.value = true;
    models.value = [];
  } finally {
    modelsLoading.value = false;
  }
}

function onModelSelect(event: Event) {
  const target = event.target as HTMLSelectElement;
  if (target.value) modelName.value = target.value;
}

async function handleTest() {
  if (!props.item || sending.value) return;
  const model = modelName.value.trim();
  if (!model) {
    sendError.value = "请填写模型名称";
    return;
  }
  sending.value = true;
  sendError.value = "";
  responseText.value = "";
  try {
    responseText.value = await sendChatCompletion(
      props.item.api_url,
      props.item.api_token,
      model,
      message.value,
    );
  } catch (error) {
    sendError.value = error instanceof Error ? error.message : "请求失败";
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-lg">
      <DialogTitle>测试 API</DialogTitle>

      <form class="flex flex-col gap-3.5" @submit.prevent="handleTest">
        <div class="flex flex-col gap-1.5">
          <Label>接口地址</Label>
          <Input :model-value="props.item?.api_url ?? ''" readonly disabled />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>接口密钥</Label>
          <Input :model-value="props.item?.api_token ?? ''" type="password" readonly disabled />
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <Label>模型名称</Label>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="text-xs text-blue-500 hover:underline hover:cursor-pointer disabled:opacity-50"
                :disabled="modelsLoading"
                @click="fetchModelList"
              >
                {{ modelsLoading ? "获取中..." : "自动获取" }}
              </button>
              <a
                v-if="props.item?.docs_url"
                :href="props.item.docs_url"
                target="_blank"
                class="text-xs text-blue-500 hover:underline"
              >
                查看文档
              </a>
            </div>
          </div>
          <Input v-model="modelName" placeholder="如: gpt-4o" />

          <div v-if="modelsLoading" class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconLoader2 class="size-3.5 animate-spin" />
            正在获取模型列表...
          </div>

          <select
            v-else-if="models.length > 0"
            class="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none"
            @change="onModelSelect"
          >
            <option value="">请选择模型</option>
            <option v-for="model in models" :key="model" :value="model">{{ model }}</option>
          </select>

          <p v-if="modelsError" class="text-destructive text-xs">获取失败，请手动填写</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>消息</Label>
          <Input v-model="message" placeholder="hello" />
        </div>

        <p v-if="sendError" class="text-destructive text-xs">请求失败：{{ sendError }}</p>

        <textarea
          v-if="responseText"
          readonly
          class="border-input h-32 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none"
          :value="responseText"
        ></textarea>

        <DialogFooter class="mt-1">
          <Button type="button" variant="outline" @click="dialogOpen = false">取消</Button>
          <Button type="submit" :disabled="sending">
            {{ sending ? "发送中..." : "测试" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **步骤 2：类型检查**

运行：`pnpm build`
预期：`vue-tsc -b` 通过（注意 `noUnusedLocals`：别留未使用导入；本组件用到的导入都有引用）。

- [ ] **步骤 3：Commit**

```bash
git add src/components/test-form-dialog/index.vue
git commit -m "feat: 测试弹窗组件（自动获取模型/发送对话/结果展示）"
```

---

## 任务 3：`App.vue` 接线

**文件：**
- 修改：`src/App.vue`

- [ ] **步骤 1：挂载弹窗与状态**

修改 `src/App.vue`：

1. 模板：在「update form dialog」之后新增：

```vue
    <!-- test form dialog -->
    <TestFormDialog :open="hasTestItem" :item="testItem" @update:open="hideTestForm" />
```

2. `<script setup>` 导入区（`KeyItemFormDialog` import 之后）新增：

```ts
import TestFormDialog from "@/components/test-form-dialog/index.vue";
```

3. 状态区（`hasEditItem` 之后）新增：

```ts
const testItem = ref<Item | null>(null);
const hasTestItem = computed(() => testItem.value !== null);
```

4. 把现有空的 `showTestForm` 实现替换，并在其后新增 `hideTestForm`：

```ts
function showTestForm(item: Item) {
  testItem.value = item;
}

function hideTestForm() {
  testItem.value = null;
}
```

- [ ] **步骤 2：类型检查 + 全量测试**

运行：`pnpm build && pnpm test`
预期：构建通过，测试 33 个用例全过（26 旧 + 7 新）。

- [ ] **步骤 3：Commit**

```bash
git add src/App.vue
git commit -m "feat: App 接入测试弹窗"
```

---

## 任务 4：整体验证与收尾

**文件：**
- 无新文件；仅验证

- [ ] **步骤 1：全量构建 + 测试**

运行：`pnpm build && pnpm test`
预期：`vue-tsc -b` 与 `vite build` 通过；vitest 全绿。

- [ ] **步骤 2：手动冒烟验证**

运行：`pnpm dev`，浏览器打开 `http://localhost:5173`：
1. 点击某行「测试」→ 弹窗打开，api_url/api_token 只读预填，message 默认 `hello`。
2. 点「自动获取」→ 成功出现 `<select>` 可选模型（选中回填 model_name）；失败显示红字「获取失败，请手动填写」；有 docs_url 的行显示「查看文档」。
3. 填 model_name → 点「测试」→ 成功展示只读 textarea 回复；失败展示红字「请求失败：...」。
4. 关闭再打开，状态已重置。

- [ ] **步骤 3：更新 README（可选）**

如 README 有功能清单，补充「测试」说明。无则跳过。

- [ ] **步骤 4：确认提交历史**

运行：`git log --oneline -6`
预期：包含规格 commit + 3 个功能 commit，工作区干净（除 README 既有未提交改动）。
