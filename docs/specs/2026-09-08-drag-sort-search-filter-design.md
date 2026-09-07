# 拖动排序与提供商搜索过滤 设计规格

- 日期：2026-09-08
- 分支：dev
- 状态：已通过用户分节评审（2026-09-08）

## 1. 背景与目标

在「大模型提供商 API 密钥管理」表格中增加两个能力：

1. **拖动排序**：用户可通过拖拽调整条目顺序，顺序随 `localStorage` 持久化。
2. **按提供商名称搜索过滤**：在按钮行左侧新增搜索输入框，按 `provider` 名称过滤表格；输入框内置清空按钮，清空后恢复全部展示。

## 2. 已确认的决策

| 决策点 | 结论 |
|--------|------|
| 搜索激活时拖拽行为 | 过滤时**禁用拖拽**，清空关键字后恢复 |
| 拖拽交互入口 | 表格最左新增**专用拖拽手柄列**（抓手图标） |
| 实现方案 | 方案 A：状态上浮 + 受控表格（过滤纯函数入 lib 可单测；拖拽结束 emit reorder 写回 App.vue） |
| 搜索关键字持久化 | 不持久化到 localStorage（临时交互，刷新重置） |
| 空态（过滤无结果） | 仅当父组件传入 `emptyText` 且列表为空时显示；不传时保持现状（只剩表头） |
| 搜索匹配规则 | trim 后、不区分大小写的 `includes` 匹配 `provider` |
| 规格文档位置 | `docs/specs/` 并提交 git（仓库已忽略 `docs/superpowers`） |

## 3. 依赖

- 新增 `vue-draggable-plus`（自带 `sortablejs` 传递依赖），用 `pnpm add vue-draggable-plus` 安装。

## 4. 架构与数据流

### 4.1 状态与数据流（App.vue）

- 新增 `searchKeyword = ref("")`。
- 新增 `filteredItems = computed(() => filterKeyItems(items.value, searchKeyword.value))`，作为表格展示列表。
- 模板传入 KeyList：

  ```vue
  <KeyList
    :items="filteredItems"
    :draggable="searchKeyword.length === 0"
    :empty-text="searchKeyword && filteredItems.length === 0 ? '未找到匹配的提供商' : undefined"
    @reorder="(list) => (items.value = list)"
    ...
  />
  ```

- 拖拽排序写回 `items.value` 后，`useLocalStorage` 自动持久化新顺序。

### 4.2 过滤纯函数（新文件 `src/lib/key-item-filter.ts`）

```ts
filterKeyItems(items: Item[], keyword: string): Item[]
```

规则：

- `keyword.trim().toLowerCase()` 后对 `provider` 做不区分大小写的 `includes` 匹配。
- 关键字为空（trim 后）时直接返回原数组引用，不产生无谓拷贝。
- 不修改入参，返回新数组（需过滤时）。

### 4.3 KeyList 组件改造（`src/components/key-list/index.vue`）

- props 新增：
  - `draggable?: boolean`，默认 `true`；
  - `emptyText?: string`，默认 `undefined`。
- emits 新增：`(e: "reorder", items: Item[])`。
- 内部维护 `dragList = ref<Item[]>([])` 作为 VueDraggable 的 `v-model`，用以下 watch 跟随外部数据（覆盖新增条目时的原地 `push`）：

  ```ts
  watch(
    () => props.items,
    (value) => {
      dragList.value = [...value];
    },
    { deep: true, immediate: true },
  );
  ```

- 表体：用 `<VueDraggable>` 替代 `<TableBody>`，保留其原有样式类：

  ```vue
  <VueDraggable
    v-model="dragList"
    tag="tbody"
    :disabled="!draggable"
    handle=".drag-handle"
    :animation="200"
    class="[&_tr:last-child]:border-0"
    @end="onDragEnd"
  >
    <!-- TableRow ... -->
  </VueDraggable>
  ```

- `onDragEnd`：`emits("reorder", [...dragList])`。
- 表格最左新增 1 列「拖拽手柄」（`IconGripVertical` + `.drag-handle` 类），全表共 7 列。
- 空态：仅当 `items.length === 0 && emptyText` 时，用 `TableEmpty`（`colspan=7`）渲染 `emptyText`。

### 4.4 数据流一图流

- 输入关键字 → `filteredItems` → KeyList 展示（拖拽禁用）。
- 拖拽手柄拖动 → VueDraggable 就地重排 `dragList` → `@end` emit `reorder` → App.vue 写回 `items.value` → 自动持久化。

## 5. UI 布局与交互

### 5.1 工具栏行（App.vue）

- 按钮行容器由 `justify-end` 改为 `justify-between`：
  - **左侧**：搜索输入框；
  - **右侧**：原有三个按钮（导入 JSON 数据 / 导出到本地 / 添加新的 API 密钥），按钮组代码不动。
- 搜索输入框构成：外层 `relative` 容器 + shadcn `Input`（`w-72`、`pr-8`）+ **内嵌清空按钮**（`IconX`，绝对定位于输入框内右侧，仅 `v-if="searchKeyword"` 时出现；点击后 `searchKeyword = ""` 并让输入框重新聚焦）。
- placeholder：`按提供商名称搜索`。
- 不做防抖（本地数组量小，实时过滤即可）。

### 5.2 拖拽手柄视觉与禁用态

- 可拖拽时：手柄图标 `cursor-grab`。
- `draggable = false`（搜索激活）时：图标 `opacity-50 cursor-not-allowed`，行不可拖。
- 拖拽列列头居中显示 `IconGripVertical`，列宽 `w-10` 左右。

### 5.3 文案

- 新增用户可见文案全部中文：「按提供商名称搜索」「未找到匹配的提供商」等。

## 6. 测试

新增 `tests/unit/key-item-filter.test.ts`，沿用现有风格（`describe/it/expect` + `item()` 工厂 + 中文描述），覆盖：

- 空关键字返回原数组引用；
- 关键字前后空格 trim；
- 不区分大小写匹配；
- 包含匹配（多个命中）；
- 无匹配时返回 `[]`；
- 不修改入参。

拖拽排序本身由库处理，不写单测（仓库惯例：vitest 只跑 node 环境纯函数）。

## 7. 构建与收尾

- `pnpm add vue-draggable-plus`。
- `pnpm test` 全部通过。
- `pnpm build`（`vue-tsc -b` + `vite build`）通过，注意 `noUnusedLocals` 等严格项。
- 同步更新 `AGENTS.md`：新增依赖、新文件、表格列数变化、KeyList 新 props/emits。

## 8. 非目标（YAGNI）

- 不做搜索以外的字段匹配（按用户需求仅匹配 `provider`）。
- 不持久化搜索关键字。
- 不做防抖与高亮命中文本。
- 不重构工具栏到独立组件（方案 C 被否决）。
- 不改动「删除全部后只剩表头」的既有行为。