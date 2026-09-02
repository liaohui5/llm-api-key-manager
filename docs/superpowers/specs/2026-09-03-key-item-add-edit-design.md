# API 密钥「添加 / 修改」功能设计

> 日期：2026-09-03 · 状态：已批准 · 关联项目：llm-api-key-manager

## 背景与目标

当前应用仅支持密钥条目的列表展示与删除；「添加」按钮与行内「修改」按钮无任何行为，`App.vue` 中 6 个处理函数为空桩（这也是 `pnpm build` 当前失败的原因：TS6133 未使用局部变量）。

本次目标：为「添加 / 修改」接上完整交互，遵循现有代码风格（Vue 3 `<script setup>`、shadcn-vue reka-nova 原语、Tailwind v4、中文界面文案），不引入新依赖、不改动复制与删除等既有功能。

## 需求

- 默认不显示任何表单。
- 点击「添加新的API密钥」→ 弹出空表单弹窗 → 填写并校验 → 确认后新增一条。
- 点击行内「修改」→ 弹出预填该条目的表单弹窗 → 修改并校验 → 确认后原位更新。
- 取消（取消按钮 / 遮罩点击 / Esc）丢弃草稿，不落盘。

## 澄清结论

| 议题 | 决策 |
|------|------|
| 表单承载方式 | 新增 Dialog 模态弹窗（shadcn-vue 风格），不复用 Popover |
| 校验规则 | provider、api_url、api_token 必填；api_url 必须是合法 http(s) URL；docs_url、remark 选填 |
| 组件组织 | 单一共用弹窗组件 `key-item-form-dialog`，以 mode 区分创建 / 编辑；删除两个占位目录 |

## 架构与数据流

状态继续由 `App.vue` 唯一持有（经 `useLocalStorage` 自动持久化）。

- 新增状态：
  - `createOpen: Ref<boolean>` —— 创建弹窗可见性
  - `editItem: Ref<Item | null>` —— 正在编辑的条目（null 表示未编辑，且编辑弹窗关闭）
- 6 个原桩函数接上真实逻辑（同时消除 TS6133）：
  - `showCreateForm()` → `createOpen.value = true`
  - `hideCreateForm()` → `createOpen.value = false`
  - `showUpdateForm(item: Item)` → `editItem.value = item`
  - `hideUpdateForm()` → `editItem.value = null`
  - `createKeyItem(draft: ItemDraft)` → 以 uuid 生成 id，`items.value.push({ ...draft, id })`
  - `updateKeyItem(draft: ItemDraft)` → 按 `editItem.value.id` 原位替换
- `KeyList` 行内「修改」按钮：新增 `emit("edit", item)`，按钮原为空置状态。
- `App.vue` 挂载两份弹窗组件实例（编辑弹窗的可见性由 `editItem !== null` 直接派生，不另设状态）：
  - `<KeyItemFormDialog mode="create" v-model:open="createOpen" @submit="createKeyItem" />`
  - `<KeyItemFormDialog mode="edit" :open="editItem !== null" :item="editItem" @update:open="hideUpdateForm" @submit="updateKeyItem" />`

弹窗内部维护本地草稿副本（编辑模式在打开时由 `item` 拷贝，只提交不直接改列表）。

## 新增 / 变更文件

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/components/key-item-form-dialog/index.vue` | 新增 | 共用弹窗表单组件 |
| `src/components/key-item-form-dialog/validation.ts` | 新增 | 纯函数校验模块（见「组件接口」） |
| `src/components/ui/dialog/`（Dialog.vue / DialogContent.vue / DialogTitle.vue / index.ts） | 新增 | 模态弹窗原语，仿现有 Popover 的 reka-nova 写法 |
| `src/components/ui/input/`（Input.vue / index.ts） | 新增 | 文本输入原语 |
| `src/components/ui/label/`（Label.vue / index.ts） | 新增 | 字段标签原语 |
| `src/types.ts` | 修改 | 追加 `ItemDraft = Omit<Item, "id">` |
| `src/App.vue` | 修改 | 接线状态与处理函数、挂载弹窗、清理注释与桩代码 |
| `src/components/key-list/index.vue` | 修改 | 「修改」按钮发出 `edit` 事件 |
| `src/components/create-key-item/`、`src/components/update-key-item/` | 删除 | 占位目录，语义由共用组件接管 |
| `AGENTS.md` | 修改 | 同步功能完成度、原语清单与约定 |

依赖：`uuid`（已在 `package.json`，此前未使用）用于创建时生成 id。无其他新增依赖。

## 组件接口

`KeyItemFormDialog` props / emits：

- props：`mode: "create" | "edit"`、`open: boolean`、`item?: Item | null`
- emits：`update:open(open: boolean)`、`submit(draft: ItemDraft)`

校验规则为纯函数 `validateKeyItemDraft(draft: ItemDraft): Partial<Record<KeyItemField, string>>`，置于组件同目录 `validation.ts`，便于单独测试（不引入测试框架，仅保持逻辑与组件解耦）。其中 `KeyItemField = keyof ItemDraft` 表示表单字段名，返回值为「字段 → 中文错误消息」的映射（只含出错字段）：

- provider 必填
- api_url 必填且为合法 http(s) URL
- api_token 必填
- 入参先 trim 再校验

校验时机：点「保存」时执行；某字段出错后，该字段被修改即清除其错误提示（不整表清空）。错误以中文内联文本显示在字段下方，红色 `text-destructive`。

草稿同步与提交流程：弹窗打开（open 变为 true）时按 mode / item 初始化草稿（创建 = 空表单，编辑 = 拷贝 item）。点「保存」先本地校验：未通过则显示错误且不关闭；通过后先 `emit("submit", draft)`，再 `emit("update:open", false)` 关闭。父组件在 submit 处理中读取 `editItem`（此时尚未清空）以完成原位替换。

## 交互细节

- 编辑弹窗打开时预填全部字段（含 api_token；该值本就以明文存于 localStorage）。
- 新增条目追加到列表末尾（与 seed 初始顺序一致的追加语义）。
- 弹窗标题：创建「添加新的API密钥」，编辑「修改API密钥」。
- 按钮文案：「取消」「保存」（取消 = 关闭弹窗；保存 = 校验通过后提交并关闭）。
- 表单字段顺序与表格列一致：提供商 → 接口地址 → 接口密钥 → 文档地址 → 备注。
- 超出需求范围的行为一律不做：复制按钮、删除流程、表格样式、暗色主题、重复 provider 检测等。

## 验证标准

1. `pnpm build` 通过（此前因桩函数失败，本功能落地后应恢复绿色）。
2. `pnpm dev` 手工冒烟：
   - 默认页面无表单；
   - 必填项留空点「保存」→ 中文错误提示出现、弹窗不关闭；
   - api_url 填非法值（非 http(s)）→ 格式错误提示；
   - 合法新增 → 新条目出现在末尾并写入 localStorage；
   - 「修改」→ 预填正确 → 保存后原位更新、刷新后仍在；
   - 取消 / 遮罩 / Esc → 草稿丢弃，数据不变。

## 范围外

- 行内复制按钮仍为空置（本次只解决添加 / 修改）。
- 不引入表单校验库、测试框架或新的样式依赖。

- 决策记录（2026-09-03）：实现计划制定阶段用户显式批准的决议——引入 vitest（devDependency）为校验纯函数 `validateKeyItemDraft` 提供最小单测覆盖。范围严格限于 `tests/unit/validation.test.ts`（node 环境、无 DOM），通过 `pnpm test`（`vitest run`）一次性执行，仅校验纯函数，不挂载组件。该决议不是对「不引入表单校验库、测试框架或新的样式依赖」的让步：vitest 属 dev-only 测试工具而非运行时依赖，未引入任何表单校验库，校验逻辑仍为弹窗组件外的纯函数。
