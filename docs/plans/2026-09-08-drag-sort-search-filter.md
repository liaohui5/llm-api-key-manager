# 拖动排序与提供商搜索过滤 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为密钥表格增加基于 VueDraggablePlus 的手柄拖拽排序（持久化到 localStorage），并在按钮行左侧新增按提供商名称搜索过滤的输入框（带清空按钮）。

**架构：** 方案 A——状态上浮 + 受控表格。过滤逻辑提取为 `src/lib/key-item-filter.ts` 纯函数（可单测）；`App.vue` 持有 `searchKeyword`，用 computed 派生过滤后列表传给 KeyList；KeyList 内部维护 VueDraggable 的 v-model 副本，拖拽结束 emit `reorder` 由 App 写回 `items.value`。搜索激活时禁用拖拽。

**技术栈：** Vue 3.5（`<script setup lang="ts">`）、TypeScript、Vite 8、Tailwind v4、shadcn-vue（`Input`/`Table`/`TableEmpty`）、`@tabler/icons-vue`、`useLocalStorage`（@vueuse/core）、`vue-draggable-plus`、vitest（node 环境纯函数单测）。

**计划文档位置说明：** 按用户偏好，规格与计划均放 `docs/` 下并提交 git（仓库已忽略 `docs/superpowers`）。规格参考：`docs/specs/2026-09-08-drag-sort-search-filter-design.md`（commit `1548cc2`）。

---

## 实现要点（先读）

- 仓库 lib 文件用别名 `@/`（如 `import type { Item } from "@/types"`）；业务代码用双引号 + 分号；`src/components/ui/` 内是 shadcn 风格（单引号、无分号），本次不改动 ui 原语。
- 单元测试放 `tests/unit/*.test.ts`，窗口环境为 node，仅测纯函数（UI 靠 `pnpm build` 的类型检查 + 手动验证）。
- 每个任务结束时跑 `pnpm test`（26 用例基线 + 新增）与 `pnpm build`（`vue-tsc -b`，注意 `noUnusedLocals`）确认绿灯再 commit。
- 表格列数变化：原 6 列 → 最左新增「拖拽」列共 7 列；`TableEmpty` 的 `colspan` 用 7。

---

### 任务 1：安装 vue-draggable-plus 依赖

**文件：**
- 修改：`package.json`、`pnpm-lock.yaml`（由 pnpm add 自动更新）

- [ ] **步骤 1：安装依赖**

```bash
pnpm add vue-draggable-plus
```

预期：`package.json` dependencies 增加 `vue-draggable-plus`（最新稳定版，自带 `sortablejs` 传递依赖）。

- [ ] **步骤 2：跑基线确认安装无伤既有功能**

运行：`pnpm test && pnpm build`
预期：2 个测试文件 26 用例全过；构建（`vue-tsc -b` + `vite build`）通过。

- [ ] **步骤 3：Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): 添加 vue-draggable-plus 依赖"
```

---

### 任务 2：过滤纯函数 `filterKeyItems` 及其单测（TDD）

**文件：**
- 创建：`src/lib/key-item-filter.ts`
- 创建：`tests/unit/key-item-filter.test.ts`

> 本任务严格 TDD：先写失败测试，再写实现。

- [ ] **步骤 1：编写失败测试**

创建 `tests/unit/key-item-filter.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { filterKeyItems } from "../../src/lib/key-item-filter";
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

describe("filterKeyItems", () => {
  it("空关键字（含纯空白）返回原数组引用", () => {
    const items = [item()];
    expect(filterKeyItems(items, "")).toBe(items);
    expect(filterKeyItems(items, "   ")).toBe(items);
  });

  it("按提供商名称包含匹配", () => {
    const items = [
      item({ id: "1", provider: "OpenAI" }),
      item({ id: "2", provider: "DeepSeek" }),
      item({ id: "3", provider: "阿里云" }),
    ];
    expect(filterKeyItems(items, "Open").map((i) => i.id)).toEqual(["1"]);
    expect(filterKeyItems(items, "Deep").map((i) => i.id)).toEqual(["2"]);
  });

  it("关键字前后空格会被 trim", () => {
    const items = [
      item({ id: "1", provider: "OpenAI" }),
      item({ id: "2", provider: "DeepSeek" }),
    ];
    expect(filterKeyItems(items, "  openai  ").map((i) => i.id)).toEqual(["1"]);
  });

  it("大小写不敏感", () => {
    const items = [
      item({ id: "1", provider: "OpenAI" }),
      item({ id: "2", provider: "openai-plus" }),
    ];
    expect(filterKeyItems(items, "OPENAI").length).toBe(2);
  });

  it("无匹配时返回空数组", () => {
    const items = [item({ id: "1", provider: "OpenAI" })];
    expect(filterKeyItems(items, "不存在的提供商")).toEqual([]);
  });

  it("不修改入参", () => {
    const items = [
      item({ id: "1", provider: "OpenAI" }),
      item({ id: "2", provider: "DeepSeek" }),
    ];
    const snapshot = JSON.stringify(items);
    filterKeyItems(items, "Open");
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm test`
预期：FAIL，报错 `Failed to resolve import "../../src/lib/key-item-filter"`（文件尚不存在）。

- [ ] **步骤 3：编写实现**

创建 `src/lib/key-item-filter.ts`：

```ts
import type { Item } from "@/types";

export function filterKeyItems(items: Item[], keyword: string): Item[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return items;
  return items.filter((item) => item.provider.toLowerCase().includes(kw));
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm test`
预期：26 + 新增 6 = 32 用例全过；`filterKeyItems` 相关用例 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/lib/key-item-filter.ts tests/unit/key-item-filter.test.ts
git commit -m "feat(搜索): 新增按提供商名称过滤的纯函数"
```

---

### 任务 3：KeyList 支持手柄拖拽排序

**文件：**
- 修改：`src/components/key-list/index.vue`

> KeyList 新增 props（`draggable`、`emptyText`）均为可选，默认值与现有行为兼容，因此本任务完成后 `App.vue` 无需改动即可编译通过。拖拽 emit 的 `reorder` 暂无监听者，属预期。

- [ ] **步骤 1：改写 script 部分**

将 `src/components/key-list/index.vue` 的 `<script lang="ts" setup>` 替换为：

```ts
import { ref, watch } from "vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table/index.ts";
import { TableEmpty } from "@/components/ui/table/index.ts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconCopy, IconGripVertical } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button/index.ts";
import { VueDraggable } from "vue-draggable-plus";
import { type Item } from "@/types";

const props = withDefaults(
  defineProps<{
    items: Item[];
    draggable?: boolean;
    emptyText?: string;
  }>(),
  {
    items: () => [],
    draggable: true,
    emptyText: undefined,
  },
);

// VueDraggable 的 v-model 副本：跟随外部 items，避免直接改 props
const dragList = ref<Item[]>([]);
watch(
  () => props.items,
  (value) => {
    dragList.value = [...value];
  },
  { deep: true, immediate: true },
);

function onlyShow15Chars(str: string): string {
  if (str.length > 15) {
    return str.slice(0, 15) + "...";
  }
  return str;
}

const emits = defineEmits<{
  (e: "delete", id: string): void;
  (e: "copy", id: string): void;
  (e: "edit", item: Item): void;
  (e: "test", item: Item): void;
  (e: "reorder", items: Item[]): void;
}>();

function handleDelete(item: Item) {
  emits("delete", item.id);
}

function handleEdit(item: Item) {
  emits("edit", item);
}

function handleCopy(str: string, isWithSuffix: boolean = false) {
  const slash = str.endsWith("/") ? "" : "/";
  isWithSuffix ? emits("copy", `${str}${slash}chat/completions`) : emits("copy", str);
}

function handleTest(item: Item) {
  emits("test", item);
}

function onDragEnd() {
  const before = props.items.map((item) => item.id).join(",");
  const after = dragList.value.map((item) => item.id).join(",");
  if (before === after) return;
  emits("reorder", [...dragList.value]);
}
```

- [ ] **步骤 2：改写 template 部分**

将 `src/components/key-list/index.vue` 的 `<template>` 替换为（外层包 VueDraggable，`target` 指向 `tbody`，行遍历 `dragList`，最左新增拖拽列）：

```html
<template>
  <VueDraggable
    v-model="dragList"
    target=".drag-tbody"
    handle=".drag-handle"
    :disabled="!draggable"
    :animation="200"
    @end="onDragEnd"
  >
    <Table class="border">
      <!-- table header -->
      <TableHeader>
        <TableRow>
          <TableHead class="w-10">
            <IconGripVertical class="mx-auto h-4 w-4 text-muted-foreground" />
          </TableHead>
          <TableHead>提供商</TableHead>
          <TableHead>接口地址</TableHead>
          <TableHead>接口密钥</TableHead>
          <TableHead>备注说明</TableHead>
          <TableHead>文档地址</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <!-- table body -->
      <TableBody class="drag-tbody">
        <!-- row -->
        <TableRow v-for="item of dragList" :key="item.id">
          <TableCell class="w-10">
            <IconGripVertical
              class="drag-handle mx-auto h-4 w-4"
              :class="draggable ? 'cursor-grab' : 'cursor-not-allowed opacity-50'"
            />
          </TableCell>
          <TableCell>{{ item.provider }}</TableCell>
          <TableCell>
            <div class="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="mr-1">{{ onlyShow15Chars(item.api_url) }}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{{ item.api_url }}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="ghost" @click="handleCopy(item.api_url)">
                      <IconCopy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>仅复制</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="ghost" @click="handleCopy(item.api_url, true)">
                      <IconCopy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>复制 `/chat/completions` 后缀地址</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableCell>
          <TableCell>
            <div class="flex items-center">
              <span class="mr-1">{{ onlyShow15Chars(item.api_token) }}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="ghost" @click="handleCopy(item.api_token)">
                      <IconCopy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>复制</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableCell>
          <TableCell>{{ item.remark }}</TableCell>
          <TableCell>
            <Button variant="link" v-if="item.docs_url">
              <a :href="item.docs_url" class="text-blue-500" target="_blank">新标签页打开</a>
            </Button>
          </TableCell>
          <TableCell>
            <div class="flex justify-around">
              <Button class="hover:cursor-pointer" variant="outline" @click="handleEdit(item)"
                >修改</Button
              >
              <Button class="hover:cursor-pointer" variant="outline" @click="handleTest(item)"
                >测试</Button
              >
              <Popover>
                <PopoverTrigger>
                  <Button class="hover:cursor-pointer" variant="destructive">删除</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div>确定要删除吗?</div>
                  <div class="flex justify-around">
                    <Button class="hover:cursor-pointer" variant="outline">取消</Button>
                    <Button
                      class="hover:cursor-pointer"
                      variant="destructive"
                      @click="handleDelete(item)"
                      >确定</Button
                    >
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </TableCell>
        </TableRow>
        <TableEmpty v-if="dragList.length === 0 && emptyText" :colspan="7">
          {{ emptyText }}
        </TableEmpty>
      </TableBody>
    </Table>
  </VueDraggable>
</template>
```

> 说明：`TableBody` 的 `class` 会经 `cn()` 与自带类合并，`drag-tbody` 作为 Sortable 的 target 选择器。

- [ ] **步骤 3：类型与构建验证**

运行：`pnpm build`
预期：`vue-tsc -b` 通过（新 props/emits/import 无 TS6133 等报错），`vite build` 产出到 `dist/`。

- [ ] **步骤 4：Commit**

```bash
git add src/components/key-list/index.vue
git commit -m "feat(表格): 表格支持拖拽手柄排序"
```

---

### 任务 4：App.vue 新增搜索工具栏行并接线

**文件：**
- 修改：`src/App.vue`

- [ ] **步骤 1：改写 script 部分**

将 `src/App.vue` 的若干处脚本修改如下：

在 `import { Button } ...` 之后补充图标与输入框、过滤函数 import：

```ts
import { IconInfoCircle, IconX } from "@tabler/icons-vue";
import { Input } from "@/components/ui/input";
import { filterKeyItems } from "@/lib/key-item-filter";
```

（将原来单独的 `import { IconInfoCircle } ...` 行替换为上面的合并写法。）

在状态区（`const testItem = ...` 之后）新增：

```ts
const searchKeyword = ref("");
const filteredItems = computed(() => filterKeyItems(items.value, searchKeyword.value));

function clearSearchKeyword() {
  searchKeyword.value = "";
}
```

在处理区新增 reorder 写回（可放在 `deleteKeyItem` 之后）：

```ts
function reorderItems(reordered: Item[]) {
  items.value = reordered;
}
```

- [ ] **步骤 2：改写 template 工具栏行**

将 `src/App.vue` 中「buttons」区块整体替换为：

```html
<!-- toolbar: 搜索 + 操作按钮 -->
<div class="flex items-center justify-between py-2">
  <!-- 左侧：按提供商名称搜索输入框（内嵌清空按钮） -->
  <div class="relative w-72">
    <Input v-model="searchKeyword" placeholder="按提供商名称搜索" class="pr-8" />
    <!-- @mousedown.prevent 防止点击清空按钮时输入框失焦 -->
    <button
      v-if="searchKeyword"
      type="button"
      class="absolute inset-y-0 right-1 my-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      @mousedown.prevent
      @click="clearSearchKeyword"
    >
      <IconX class="h-4 w-4" />
    </button>
  </div>

  <!-- 右侧：操作按钮组（原导入/导出/添加，保持原样） -->
  <div class="flex items-center">
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
</div>
```

将下方 `KeyList` 调用改为传入过滤后的列表并接线：

```html
<KeyList
  :items="filteredItems"
  :draggable="searchKeyword.length === 0"
  :empty-text="searchKeyword && filteredItems.length === 0 ? '未找到匹配的提供商' : undefined"
  @copy="handleCopy"
  @delete="deleteKeyItem"
  @edit="showUpdateForm"
  @test="showTestForm"
  @reorder="reorderItems"
/>
```

- [ ] **步骤 3：验证类型与构建**

运行：`pnpm build`
预期：`vue-tsc -b` 通过；`vite build` 通过。

- [ ] **步骤 4：运行全部单测**

运行：`pnpm test`
预期：32 用例全过（含任务 2 的新增）。

- [ ] **步骤 5：手动验证（dev server）**

运行：`pnpm dev`，在浏览器 `http://localhost:5173` 验证：

1. 拖动第一行手柄可移动该行，顺序在刷新后保持（localStorage 持久化）。
2. 在搜索框输入「公益」→ 表格只显示匹配项且不可拖拽。
3. 输入不存在关键字 → 显示「未找到匹配的提供商」单行空态。
4. 点击搜索框内清空按钮 → 关键字清空、输入框保持聚焦、恢复全部展示且可拖拽。

预期：以上 4 点全部符合。

- [ ] **步骤 6：Commit**

```bash
git add src/App.vue
git commit -m "feat(搜索): 工具栏新增按提供商名称过滤的搜索框"
```

---

### 任务 5：同步 AGENTS.md 并收尾

**文件：**
- 修改：`AGENTS.md`

> 保持 AGENTS.md 与代码一致（仓库惯例：AGENTS 面向后续开发）。

- [ ] **步骤 1：更新依赖与文件清单**

在 `AGENTS.md` 的「技术栈与环境」中，`工具库` 一行追加 `vue-draggable-plus`（拖拽排序）；在「目录结构」的 lib 清单追加 `src/lib/key-item-filter.ts` 与 `tests/unit/key-item-filter.test.ts`；将测试用例数「26 个」更新为「32 个」；在 `key-list/index.vue` 描述中补充「新增拖拽手柄列（共 7 列）与 reorder emit、draggable/emptyText props」；在 `App.vue` 描述补充 `searchKeyword`/`filteredItems` 状态与工具栏布局；「常用命令」处 `pnpm test` 用例数同步为 32。

- [ ] **步骤 2：更新「关键模块与数据流」**

在「展示链路」章节补一段「拖动排序与搜索过滤」小节，说明：`filterKeyItems` 纯函数、`App.vue` 的 `searchKeyword`→`filteredItems`、KeyList 用 VueDraggablePlus+`target` 选择 `tbody`、拖拽结束 `reorder` 写回 `items.value` 自动持久化、搜索激活时禁用拖拽、空态 `emptyText`。

- [ ] **步骤 3：验证**

运行：`pnpm test && pnpm build`
预期：仍全绿。

- [ ] **步骤 4：Commit**

```bash
git add AGENTS.md
git commit -m "docs: 同步 AGENTS.md 到拖拽排序与搜索过滤功能"
```

---

## 完成验收

- `pnpm test`：4 个测试文件 32 用例全过。
- `pnpm build`（`vue-tsc -b` + `vite build`）通过。
- 手动验证（任务 4 步骤 5 的 4 点）全部符合。
- 预期 commit 序列：`chore(deps)` → `feat(搜索)`→`feat(表格)`→`feat(搜索)`→`docs`，共 5 个提交。