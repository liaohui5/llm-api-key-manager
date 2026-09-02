# 「添加 / 修改」API 密钥功能实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 llm-api-key-manager 接上「添加 / 修改」API 密钥条目交互：点击按钮弹出 Dialog 表单，经中文内联校验后新增 / 原位更新 localStorage 数据，并修复 `pnpm build` 当前因 6 个未使用桩函数导致的失败。

**架构：** `App.vue` 继续唯一持有 `items`（useLocalStorage）。新增共享表单弹窗组件 `key-item-form-dialog`（mode = create | edit），内含本地草稿 + 纯函数校验；提交以 `ItemDraft` 事件上抛，父组件负责生成 id（uuid 包）与列表变更。新增 shadcn-vue 风格 `ui/dialog`、`ui/input`、`ui/label` 原语（仿现有 Popover 写法，基于已安装 reka-ui 2.10.4，零新运行时依赖）。`KeyList` 行内「修改」按钮发出 `edit` 事件。

**技术栈：** Vue 3.5（`<script setup lang="ts">`）、TypeScript ~6.0、Vite 8、Tailwind CSS v4（样式全在 `src/style.css` 的 CSS 变量）、reka-ui 2.10.4（Dialog/Label 原语）、@tabler/icons-vue（IconX）、uuid（新增 id）、vitest（仅单测校验纯函数，node 环境无 DOM）。

**前置说明（每个任务都适用）：**

- 所有工作分支：`dev`（任务 0 建立）。
- 代码风格：`src/` 下手写业务代码（App.vue、key-list、types.ts、validation.ts、测试）沿用**双引号 + 分号**；`src/components/ui/` 下新增原语沿用现有 shadcn 生成代码风格（**单引号、无分号**）——与邻居文件保持一致。
- `pnpm build` 在任务 4 之前仍会因 `src/App.vue` 的 6 个桩函数报 TS6133——这是**已知的基线错误**，任务 1–3 的类型验证只看「除 App.vue 已知 6 条外无新增错误」；任务 4 接线后恢复全绿。
- 复用现成代码：`button` 原语已在 `src/components/ui/button`，不要重建。
- 已核实（无需再查）：reka-ui 2.10.4 从 `reka-ui` 导出 `DialogRoot/DialogPortal/DialogOverlay/DialogContent/DialogTitle/DialogClose/Label` 及配套类型 `DialogRootProps/DialogRootEmits/DialogContentProps/DialogContentEmits/DialogTitleProps/DialogOverlayProps/DialogCloseProps/LabelProps`、工具 `useForwardProps/useForwardPropsEmits`；`@vueuse/core` 导出 `reactiveOmit`；`uuid` 导出命名 `v4`。`@lucide/vue` 未安装、`cn-font-heading` 类在本仓库不存在——本计划全部避开，关闭按钮用 `@tabler/icons-vue` 的 `IconX`。

---

## 任务 0：建立 dev 分支

- [ ] **步骤 1：创建并切换到 dev 分支**

运行：`git switch -c dev`
预期：当前分支变为 `dev`（基于 main，已包含设计文档与 AGENTS.md 的提交）。

## 任务 1：校验模块（TDD）+ vitest 单测基建

**文件：**
- 创建：`tests/unit/validation.test.ts`
- 创建：`vitest.config.ts`
- 创建：`src/components/key-item-form-dialog/validation.ts`
- 修改：`src/types.ts`（追加 `ItemDraft`）
- 修改：`package.json`（scripts 增 `test`；pnpm 自动写入 devDependencies）
- 修改：`tsconfig.node.json`（include 增 `vitest.config.ts`）

- [ ] **步骤 1：安装 vitest**

运行：`pnpm add -D vitest`
预期：devDependencies 出现 vitest；如有 peer 警告可忽略（vitest 自带独立 vite 依赖，不影响项目 vite 8）。

- [ ] **步骤 2：新建 `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **步骤 3：在 `package.json` scripts 增加 test 脚本**

在 `scripts` 中加一行：

```json
    "test": "vitest run",
```

- [ ] **步骤 4：`tsconfig.node.json` 的 include 数组加上 `vitest.config.ts`**

改后：

```json
  "include": ["vite.config.ts", "vitest.config.ts"]
```

- [ ] **步骤 5：在 `src/types.ts` 末尾追加 `ItemDraft` 类型**

```ts
export type ItemDraft = Omit<Item, "id">;
```

- [ ] **步骤 6：编写失败的测试**

创建 `tests/unit/validation.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  isHttpUrl,
  validateKeyItemDraft,
} from "../../src/components/key-item-form-dialog/validation";
import type { ItemDraft } from "../../src/types";

function draft(overrides: Partial<ItemDraft> = {}): ItemDraft {
  return {
    provider: "示例提供商",
    api_url: "https://api.example.com/v1",
    api_token: "sk-test-123",
    docs_url: "",
    remark: "",
    ...overrides,
  };
}

describe("validateKeyItemDraft", () => {
  it("合法草稿不产生错误", () => {
    expect(validateKeyItemDraft(draft())).toEqual({});
  });

  it("校验前会 trim 空白", () => {
    expect(
      validateKeyItemDraft(
        draft({
          provider: "  示例提供商  ",
          api_url: "  https://api.example.com/v1  ",
          api_token: "  sk-test-123  ",
        }),
      ),
    ).toEqual({});
  });

  it("provider 缺失时报错", () => {
    const errors = validateKeyItemDraft(draft({ provider: "" }));
    expect(errors.provider).toBe("请输入提供商名称");
  });

  it("provider 全空白等同缺失", () => {
    const errors = validateKeyItemDraft(draft({ provider: "   " }));
    expect(errors.provider).toBe("请输入提供商名称");
  });

  it("api_url 缺失时报错", () => {
    const errors = validateKeyItemDraft(draft({ api_url: "" }));
    expect(errors.api_url).toBe("请输入接口地址");
  });

  it("api_url 非法格式时报错", () => {
    for (const bad of ["not-a-url", "example.com/v1", "ftp://example.com/v1", "https://", "http://"]) {
      const errors = validateKeyItemDraft(draft({ api_url: bad }));
      expect(errors.api_url).toBe("接口地址需为合法的 http/https URL");
    }
  });

  it("api_url 支持 http/https（含端口与路径）", () => {
    expect(validateKeyItemDraft(draft({ api_url: "http://localhost:8080/v1" }))).toEqual({});
    expect(validateKeyItemDraft(draft({ api_url: "https://api.hcnsec.cn/v1" }))).toEqual({});
  });

  it("api_token 缺失时报错", () => {
    const errors = validateKeyItemDraft(draft({ api_token: "" }));
    expect(errors.api_token).toBe("请输入接口密钥");
  });

  it("docs_url 与 remark 为选填，不填不报错", () => {
    expect(validateKeyItemDraft(draft())).toEqual({});
  });

  it("isHttpUrl 只接受 http/https", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("example.com")).toBe(false);
  });
});
```

- [ ] **步骤 7：运行测试确认失败**

运行：`pnpm test`
预期：FAIL，报 `Cannot find module '../../src/components/key-item-form-dialog/validation'`（模块尚不存在）。

- [ ] **步骤 8：编写校验模块使测试通过**

创建 `src/components/key-item-form-dialog/validation.ts`：

```ts
import type { ItemDraft } from "@/types";

export type KeyItemField = keyof ItemDraft;

export type KeyItemErrors = Partial<Record<KeyItemField, string>>;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateKeyItemDraft(draft: ItemDraft): KeyItemErrors {
  const errors: KeyItemErrors = {};
  const provider = draft.provider.trim();
  const apiUrl = draft.api_url.trim();
  const apiToken = draft.api_token.trim();

  if (!provider) {
    errors.provider = "请输入提供商名称";
  }
  if (!apiUrl) {
    errors.api_url = "请输入接口地址";
  } else if (!isHttpUrl(apiUrl)) {
    errors.api_url = "接口地址需为合法的 http/https URL";
  }
  if (!apiToken) {
    errors.api_token = "请输入接口密钥";
  }
  return errors;
}
```

- [ ] **步骤 9：运行测试确认通过**

运行：`pnpm test`
预期：PASS，全部用例通过（含 trim、URL 格式、必填、选填用例）。

- [ ] **步骤 10：类型检查无新增错误（基线外）**

运行：`pnpm exec vue-tsc -b 2>&1 | grep -v "src/App.vue" || true`
预期：除已知 App.vue 桩函数 TS6133 外无其他输出（validation.ts、types.ts 改动类型干净）。

- [ ] **步骤 11：Commit**

```bash
git add tests/unit/validation.test.ts vitest.config.ts src/components/key-item-form-dialog/validation.ts src/types.ts package.json pnpm-lock.yaml tsconfig.node.json
git commit -m "feat: add key item draft validation with unit tests"
```

## 任务 2：新增 ui/dialog、ui/input、ui/label 原语

**文件：**
- 创建：`src/components/ui/dialog/Dialog.vue`、`DialogOverlay.vue`、`DialogContent.vue`、`DialogTitle.vue`、`DialogFooter.vue`、`index.ts`
- 创建：`src/components/ui/input/Input.vue`、`index.ts`
- 创建：`src/components/ui/label/Label.vue`、`index.ts`

本目录风格：**单引号、无分号**，与现有 `src/components/ui/popover`、`src/components/ui/tooltip` 保持一致。

- [ ] **步骤 1：创建 `src/components/ui/dialog/Dialog.vue`（根原语，照 Popover.vue 模式）**

```vue
<script setup lang="ts">
import type { DialogRootEmits, DialogRootProps } from 'reka-ui'
import { DialogRoot, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<DialogRootProps>()
const emits = defineEmits<DialogRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DialogRoot
    v-slot="slotProps"
    data-slot="dialog"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DialogRoot>
</template>
```

- [ ] **步骤 2：创建 `src/components/ui/dialog/DialogOverlay.vue`**

```vue
<script setup lang="ts">
import type { DialogOverlayProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogOverlay } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<DialogOverlayProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="delegatedProps"
    :class="
      cn(
        'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-black/40 duration-100',
        props.class,
      )
    "
  >
    <slot />
  </DialogOverlay>
</template>
```

- [ ] **步骤 3：创建 `src/components/ui/dialog/DialogContent.vue`**

注意：关闭按钮图标用 `@tabler/icons-vue` 的 `IconX`（仓库未装 @lucide/vue）；按钮原语用仓库本地路径。

```vue
<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { IconX } from '@tabler/icons-vue'
import { reactiveOmit } from '@vueuse/core'
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import DialogOverlay from './DialogOverlay.vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-6 text-sm shadow-lg ring-1 duration-100 outline-none sm:max-w-md',
          props.class,
        )
      "
    >
      <slot />

      <DialogClose
        data-slot="dialog-close"
        as-child
      >
        <Button variant="ghost" size="icon-sm" class="absolute top-2 right-2">
          <IconX />
          <span class="sr-only">关闭</span>
        </Button>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
```

- [ ] **步骤 4：创建 `src/components/ui/dialog/DialogTitle.vue`**

注意：去掉官方模板里的 `cn-font-heading`（本仓库样式表不存在该工具类）。

```vue
<script setup lang="ts">
import type { DialogTitleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogTitle, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DialogTitle
    data-slot="dialog-title"
    v-bind="forwardedProps"
    :class="cn('text-base leading-none font-medium', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
```

- [ ] **步骤 5：创建 `src/components/ui/dialog/DialogFooter.vue`（按钮栏容器，不含内建按钮）**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="dialog-footer"
    :class="cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', props.class)"
  >
    <slot />
  </div>
</template>
```

- [ ] **步骤 6：创建 `src/components/ui/dialog/index.ts` 桶导出**

```ts
export { default as Dialog } from './Dialog.vue'
export { default as DialogContent } from './DialogContent.vue'
export { default as DialogFooter } from './DialogFooter.vue'
export { default as DialogOverlay } from './DialogOverlay.vue'
export { default as DialogTitle } from './DialogTitle.vue'
```

- [ ] **步骤 7：创建 `src/components/ui/input/Input.vue`**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :class="cn(
      'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
  >
</template>
```

- [ ] **步骤 8：创建 `src/components/ui/input/index.ts`**

```ts
export { default as Input } from './Input.vue'
```

- [ ] **步骤 9：创建 `src/components/ui/label/Label.vue`**

```vue
<script setup lang="ts">
import type { LabelProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { Label } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <Label
    data-slot="label"
    v-bind="delegatedProps"
    :class="
      cn(
        'gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed',
        props.class,
      )
    "
  >
    <slot />
  </Label>
</template>
```

- [ ] **步骤 10：创建 `src/components/ui/label/index.ts`**

```ts
export { default as Label } from './Label.vue'
```

- [ ] **步骤 11：类型检查无新增错误（基线外）**

运行：`pnpm exec vue-tsc -b 2>&1 | grep -v "src/App.vue" || true`
预期：除已知 App.vue 桩函数 TS6133 外无其他输出（新增原语类型干净）。

- [ ] **步骤 12：Commit**

```bash
git add src/components/ui/dialog src/components/ui/input src/components/ui/label
git commit -m "feat: add dialog, input and label ui primitives"
```

## 任务 3：新增 key-item-form-dialog 共享表单弹窗组件

**文件：**
- 创建：`src/components/key-item-form-dialog/index.vue`
- 依赖：任务 1 的 `validation.ts`、任务 2 的原语、`src/types.ts` 的 `ItemDraft`

本文件属业务代码，沿用**双引号 + 分号**风格。

- [ ] **步骤 1：创建 `src/components/key-item-form-dialog/index.vue`**

```vue
<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button/index.ts";
import { type Item, type ItemDraft } from "@/types";
import {
  validateKeyItemDraft,
  type KeyItemErrors,
  type KeyItemField,
} from "./validation";

const props = withDefaults(
  defineProps<{
    mode: "create" | "edit";
    open: boolean;
    item?: Item | null;
  }>(),
  {
    item: null,
  },
);

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "submit", draft: ItemDraft): void;
}>();

const dialogOpen = computed({
  get: () => props.open,
  set: (open: boolean) => emit("update:open", open),
});

const title = computed(() =>
  props.mode === "create" ? "添加新的API密钥" : "修改API密钥",
);

const emptyDraft = (): DraftState => ({
  provider: "",
  api_url: "",
  api_token: "",
  docs_url: "",
  remark: "",
});

/** 草稿本地状态：全部字段必填 string（含 remark），避免对可选字段直接 .trim() 的类型错误 */
type DraftState = Record<KeyItemField, string>;

const draft = reactive<DraftState>(emptyDraft());
const errors = ref<KeyItemErrors>({});

function clearErrors(): void {
  errors.value = {};
}

function resetDraft(): void {
  clearErrors();
  if (props.mode === "edit" && props.item) {
    draft.provider = props.item.provider;
    draft.api_url = props.item.api_url;
    draft.api_token = props.item.api_token;
    draft.docs_url = props.item.docs_url;
    draft.remark = props.item.remark ?? "";
  } else {
    Object.assign(draft, emptyDraft());
  }
}

watch(
  () => [props.open, props.item, props.mode],
  () => {
    if (props.open) resetDraft();
  },
  { immediate: true },
);

const fieldGroups: { field: KeyItemField; label: string; placeholder: string }[] = [
  { field: "provider", label: "提供商", placeholder: "如：新疆公益API" },
  { field: "api_url", label: "接口地址", placeholder: "https://api.example.com/v1" },
  { field: "api_token", label: "接口密钥", placeholder: "sk-..." },
  { field: "docs_url", label: "文档地址（选填）", placeholder: "https://..." },
  { field: "remark", label: "备注说明（选填）", placeholder: "" },
];

function clearError(field: KeyItemField): void {
  if (errors.value[field]) {
    const next = { ...errors.value };
    delete next[field];
    errors.value = next;
  }
}

function handleSubmit(): void {
  const payload: ItemDraft = {
    provider: draft.provider.trim(),
    api_url: draft.api_url.trim(),
    api_token: draft.api_token.trim(),
    docs_url: draft.docs_url.trim(),
    remark: draft.remark.trim(),
  };
  const nextErrors = validateKeyItemDraft(payload);
  if (Object.keys(nextErrors).length > 0) {
    errors.value = nextErrors;
    return;
  }
  emit("submit", payload);
  dialogOpen.value = false;
}

function handleCancel(): void {
  dialogOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-lg">
      <DialogTitle>{{ title }}</DialogTitle>

      <form class="flex flex-col gap-3.5" @submit.prevent="handleSubmit">
        <div v-for="group in fieldGroups" :key="group.field" class="flex flex-col gap-1.5">
          <Label>{{ group.label }}</Label>
          <Input
            v-model="draft[group.field]"
            :type="group.field === 'api_token' ? 'password' : 'text'"
            :placeholder="group.placeholder"
            :aria-invalid="errors[group.field] ? 'true' : undefined"
            :aria-describedby="errors[group.field] ? `${group.field}-error` : undefined"
            @input="clearError(group.field)"
          />
          <p
            v-if="errors[group.field]"
            :id="`${group.field}-error`"
            class="text-destructive text-xs"
          >
            {{ errors[group.field] }}
          </p>
        </div>

        <DialogFooter class="mt-1">
          <Button type="button" variant="outline" @click="handleCancel">取消</Button>
          <Button type="submit">保存</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
```

说明：`api_token` 用 `password` 类型输入（密钥不全程明文回显，仍可编辑；规格「预填全部字段」指值已就位可改）。`draft[group.field]` 动态绑定下 `v-model` 与类型收窄均成立（全部字段为 string）。

- [ ] **步骤 2：类型检查无新增错误（基线外）**

运行：`pnpm exec vue-tsc -b 2>&1 | grep -v "src/App.vue" || true`
预期：除已知 App.vue 桩函数 TS6133 外无其他输出。

- [ ] **步骤 3：Commit**

```bash
git add src/components/key-item-form-dialog/index.vue
git commit -m "feat: add shared key item form dialog"
```

## 任务 4：接线 App.vue / KeyList，删除占位目录，恢复构建

**文件：**
- 修改：`src/App.vue`（全量替换）
- 修改：`src/components/key-list/index.vue`（修改按钮接事件、新增 edit emit）
- 删除：`src/components/create-key-item/`、`src/components/update-key-item/`

- [ ] **步骤 1：改写 `src/components/key-list/index.vue`**

(a) 在 `defineEmits` 声明中追加 edit 事件——把：

```ts
const emits = defineEmits<{
  (e: "delete", id: string): void;
}>();
```

改成：

```ts
const emits = defineEmits<{
  (e: "delete", id: string): void;
  (e: "edit", item: Item): void;
}>();
```

(b) 把「修改」按钮从空置改为触发事件——把：

```html
            <Button class="hover:cursor-pointer" variant="outline">修改</Button>
```

改成：

```html
            <Button
              class="hover:cursor-pointer"
              variant="outline"
              @click="handleEdit(item)"
              >修改</Button
            >
```

(c) 在 `handleDelete` 旁新增 `handleEdit`——把：

```ts
function handleDelete(item: Item) {
  emits("delete", item.id);
}
```

改成：

```ts
function handleDelete(item: Item) {
  emits("delete", item.id);
}

function handleEdit(item: Item) {
  emits("edit", item);
}
```

- [ ] **步骤 2：全量改写 `src/App.vue`**

```vue
<template>
  <div class="w-8/10 mx-auto">
    <h2 class="text-2xl text-center py-4">大模型提供商API密钥管理</h2>
    <div class="flex items-center justify-end py-2">
      <Button variant="outline" class="hover:cursor-pointer" @click="showCreateForm">
        添加新的API密钥
      </Button>
    </div>

    <KeyList :items="items" @delete="deleteKeyItem" @edit="showUpdateForm" />

    <KeyItemFormDialog
      mode="create"
      :open="createOpen"
      @update:open="hideCreateForm"
      @submit="createKeyItem"
    />
    <KeyItemFormDialog
      mode="edit"
      :open="editItem !== null"
      :item="editItem"
      @update:open="hideUpdateForm"
      @submit="updateKeyItem"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useLocalStorage } from "@vueuse/core";
import KeyList from "@/components/key-list/index.vue";
import KeyItemFormDialog from "@/components/key-item-form-dialog/index.vue";
import { Button } from "@/components/ui/button/index.ts";
import { type Item, type ItemDraft } from "@/types";

const __ITEM_KEY__ = "__item_storage_key__";
const items = useLocalStorage<Item[]>(__ITEM_KEY__, [
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
</script>
```

说明：
- 原 6 个空桩函数全部接上真实逻辑并在模板中被引用（showCreateForm/hideCreateForm/showUpdateForm/hideUpdateForm/createKeyItem/updateKeyItem），TS6133 消失，`pnpm build` 恢复。
- 编辑弹窗可见性由 `editItem !== null` 派生，无额外状态。
- 新增项 push 到数组末尾（追加语义，与设计一致）；编辑按 id 原位替换保持顺序。
- `uuidv4` 生成新条目 id（uuid 依赖此前未使用，正好接上）。

- [ ] **步骤 3：删除两个占位目录**

运行：`git rm -r src/components/create-key-item src/components/update-key-item`
预期：两个目录及其中 index.vue 被删除。

- [ ] **步骤 4：运行完整构建**

运行：`pnpm build`
预期：PASS——vue-tsc 无错误，vite 产出 `dist/`。

- [ ] **步骤 5：dev server 冒烟（启动即退）**

运行：`timeout 12 pnpm dev --port 5199 & sleep 4; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5199/; kill %1 2>/dev/null`
预期：输出 `200`。

- [ ] **步骤 6：Commit**

```bash
git add src/App.vue src/components/key-list/index.vue
git add -u
git commit -m "feat: wire up create and edit key item dialogs"
```

## 任务 5：同步 AGENTS.md 与验收

**文件：**
- 修改：`AGENTS.md`（全量替换为下方内容）

- [ ] **步骤 1：全量改写 `AGENTS.md`**

```markdown
# llm-api-key-manager（大模型提供商 API 密钥管理）

> 纯前端 Vue 3 单页应用：以表格管理大模型提供商的 API 密钥条目（提供商 / 接口地址 / 密钥 / 文档地址 / 备注），支持添加、修改、删除。数据经 `@vueuse/core` 的 `useLocalStorage` 持久化到浏览器 localStorage（键 `__item_storage_key__`），无后端、`src` 内无任何网络请求。用户可见文案为中文。新增 / 修改共用弹窗表单 `key-item-form-dialog`，校验为纯函数 `validateKeyItemDraft`，有 vitest 单测覆盖。

## 技术栈与环境

- 框架：Vue 3.5（`<script setup lang="ts">` SFC）+ TypeScript ~6.0
- 构建：Vite 8 + `@vitejs/plugin-vue`；类型检查走 `vue-tsc`（build 脚本内）；`package.json` 为 `"type": "module"`
- 样式：Tailwind CSS v4（CSS-first，**无 `tailwind.config.*`**，主题 token 全部在 `src/style.css`）+ `tw-animate-css`
- UI：shadcn-vue 2 + reka-ui 2（`components.json`：style `reka-nova`、icon `tabler`）；图标库 `@tabler/icons-vue`
- 工具：`@vueuse/core`（useLocalStorage）、`clsx` / `tailwind-merge` / `class-variance-authority`（`cn()`）、`uuid`（新增条目 id）
- 无路由（无 vue-router）、无状态库（无 pinia）、无 lint / format 脚本；根目录 `.oxfmtrc.json` 是 oxfmt 配置（双引号、分号、trailingCommas all），未接入 npm scripts
- 测试：vitest（仅校验纯函数，node 环境，`tests/unit/validation.test.ts`），脚本 `pnpm test`
- 包管理：pnpm（`pnpm-lock.yaml`；`pnpm-workspace.yaml` 仅 `allowBuilds: vue-demi: true`）
- 路径别名：`@` → `src/`（`vite.config.ts` `resolve.alias` `"@": "/src/"`，与 `tsconfig.json` / `tsconfig.app.json` 的 paths `"@/*": ["./src/*"]` 一致）
- Git：功能在 `dev` 分支开发（计划文档见 `docs/superpowers/plans/`）

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动 Vite dev server（不做类型检查） |
| `pnpm build` | `vue-tsc -b` 类型检查 + `vite build`，产出 `dist/` |
| `pnpm test` | 运行 vitest 单测（校验模块） |
| `pnpm preview` | 预览构建产物（需先 build 产出 `dist/`） |

## 目录结构

（只列实际存在的文件）

- `index.html` — 入口页：`<div id="app">`，加载 `/src/main.ts`；favicon 用 `/favicon.svg`
- `src/main.ts` — 应用入口：`createApp(App).mount("#app")`，引入 `./style.css`
- `src/App.vue` — 根组件（唯一状态持有者）：持有 `items`（localStorage 绑定）；创建 / 编辑弹窗开关；新增 / 修改 / 删除逻辑
- `src/types.ts` — 数据模型 `Item`（全字符串字段，`remark` 可选）与 `ItemDraft = Omit<Item, "id">`
- `src/style.css` — Tailwind v4 主题入口：`@import "tailwindcss"`；`@theme inline` 把 shadcn CSS 变量映射成 Tailwind token；`:root` / `.dark` 定义明暗两套 oklch 变量；`@custom-variant dark` 以 `.dark` 类切换暗色
- `src/lib/utils.ts` — `cn()`（clsx + tailwind-merge），shadcn 组件依赖
- `src/components/key-list/index.vue` — 密钥表格（shadcn Table）：props `items: Item[]`，emits `delete(id)` / `edit(item)`；超 15 字符文本截断为 `前15字符 + "..."`
- `src/components/key-item-form-dialog/index.vue` — 创建 / 修改共用弹窗表单（Dialog + 本地草稿 + 校验），emits `submit(ItemDraft)`
- `src/components/key-item-form-dialog/validation.ts` — 纯函数校验 `validateKeyItemDraft` / `isHttpUrl`，导出 `KeyItemField`、`KeyItemErrors`
- `src/components/ui/` — shadcn-vue 原语：`button/`、`table/`、`popover/`、`tooltip/`、`dialog/`、`input/`、`label/`，每个子目录含 `index.ts` 桶导出
- `tests/unit/validation.test.ts` — 校验模块 vitest 单测
- `public/` — `favicon.svg` 被引用；`vite.svg`、`icons.svg` 为模板遗留，未被引用

## 关键模块与数据流

- 数据模型：`Item { id, provider, api_url, api_token, docs_url, remark? }`；表单负载 `ItemDraft` 无 id
- 状态：`App.vue` 用 `useLocalStorage<Item[]>("__item_storage_key__", [种子数据])`；key 字面量 `__item_storage_key__` 硬编码于 `App.vue`；**api_token 明文存入浏览器 localStorage**；种子含 1 条演示数据（provider「新疆公益API」等）
- 展示链路：`App.vue` 的 `items` → `<KeyList :items>`；表格 6 列 = provider / api_url / api_token / docs_url / remark / 操作；docs_url 以新标签页打开
- 新增链路：行内按钮区上「添加新的API密钥」`showCreateForm` → 创建弹窗（空草稿）→「保存」先校验（不通过则显示中文内联错误、不关闭）→ `emit("submit", draft)` → `createKeyItem` 以 `uuidv4()` 生成 id 后 push 到末尾 → 弹窗自动关闭
- 修改链路：行内「修改」`emit("edit", item)` → `showUpdateForm` 记录 `editItem` → 编辑弹窗打开并从 `item` 拷贝草稿 →「保存」校验通过后 `emit("submit", draft)` → `updateKeyItem` 按 `editItem.id` 原位替换 → 弹窗自动关闭
- 校验：`validation.ts` 的纯函数先 trim 各字段再校验；provider / api_url / api_token 必填，api_url 必须为 http(s) URL，docs_url / remark 选填；错误为「字段 → 中文消息」映射，字段被编辑即清除该条错误
- 取消链路：取消按钮 / 右上关闭 / 遮罩点击 / Esc 仅置 `open=false` 丢弃草稿，不改动数据
- 删除链路（Popover 二次确认）：`emit("delete", id)` → `deleteKeyItem` 过滤数组 → useLocalStorage 自动写回

## 当前状态与注意事项

1. **功能完成度**：列表展示、添加、修改（均带校验）、删除（Popover 二次确认）全部可用；行内复制按钮仍为空置（仅 Tooltip）。
2. **构建与测试**：`pnpm build`、`pnpm test` 均通过。改动涉及多个组件时先跑一遍，避免 `noUnusedLocals`（TS6133）等严格选项把未接线代码放行到 CI 之外。
3. **字体疑似笔误**：`src/style.css` 第 2 行从 Google Fonts 加载的族名为 `JetBrains Mono`（已核实该 @import 返回的族名），而 `@theme` 中 `--font-sans` 引用 `'JetBrains Mono Variable'`——两者不一致，实际渲染会回退到系统 monospace。
4. **主题约定**：改配色只动 `src/style.css` 的 `:root` / `.dark` CSS 变量与 `@theme` 映射，不要新建 `tailwind.config.*`（Tailwind v4 无配置文件）。
5. **新增 shadcn 原语**：在 `src/components/ui/<name>/` 放置组件并提供 `index.ts` 桶导出；ui 目录内保持 shadcn 生成风格（单引号、无分号），业务代码用双引号 + 分号（与 `.oxfmtrc.json` 一致）。
6. **表单校验**：校验逻辑是 `key-item-form-dialog/validation.ts` 的纯函数，新增必填 / 格式规则先在那里改并补单测（`tests/unit/validation.test.ts`），弹窗组件不内置规则字符串。
7. **文案约定**：面向用户的界面文案保持中文。
```

- [ ] **步骤 2：最终验收**

运行：`pnpm test`
预期：PASS（校验单测全绿）。

运行：`pnpm build`
预期：PASS（vue-tsc + vite build 成功）。

- [ ] **步骤 3：Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync AGENTS.md with add/edit feature"
```

---

## 完成标准

1. `pnpm test` 通过（校验规则有单测覆盖）。
2. `pnpm build` 通过（此前因桩函数失败，任务 4 修复）。
3. 默认页面无表单；「添加」/「修改」点击弹出 Dialog 表单；必填与 URL 校验生效；新增追加至末尾、修改原位更新；取消 / 遮罩 / Esc 丢弃草稿。
4. AGENTS.md 与代码同步。
