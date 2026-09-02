# API 密钥「导入 / 导出」功能设计

> 日期：2026-09-03 · 状态：已批准 · 关联项目：llm-api-key-manager · 依赖：已完成的「添加 / 修改」功能（dev 分支）

## 背景与目标

数据仅存于浏览器 localStorage（键 `__llm_api_key_items__`），无后端。顶部提示条已告知用户「仅存本地 localStorage，如果要持久保存请导出到本地文件」。当前 `App.vue` 已预留「导入JSON数据」/「导出到本地」按钮与空壳函数 `importJson()` / `exportAndDownload()`（含 TODO 注释）。

目标：接上导入 / 导出完整交互——导出当前列表为 JSON 文件并触发浏览器下载；导入 JSON 文件，按 id 与现有列表合并去重，用结果弹窗反馈。遵循仓库既有约定：核心逻辑为纯函数（vitest 单测）、业务代码双引号 + 分号、中文界面文案、不引入新依赖。

## 需求

- 导出：点「导出到本地」→ 把当前 `items` 序列化为裸数组 JSON → 触发浏览器下载 `llm-api-keys-YYYYMMDD-HHmmss.json`。
- 导入：点「导入JSON数据」→ 选择本地 .json 文件 → 解析并逐条校验 → 与现有列表按 id 合并（去重）→ 写回列表并持久化 → 弹出结果弹窗。
- 文件非法（非 JSON / 非数组 / 解析失败）：整体拒绝，列表不变，结果弹窗显示失败信息。
- 部分条目非法：合法条目照常合并，弹窗报告「新增 X 条 / 更新 Y 条 / 跳过 Z 条」。

## 澄清结论

| 议题 | 决策 |
|------|------|
| 导入语义 | 按 id 合并去重 |
| 去重冲突 | 文件条目 id 已存在 → 原位覆盖更新（保序）；无冲突 → 追加末尾 |
| 导出格式 | 裸数组 `Item[]`（不带版本包装） |
| 校验口径 | 结构（普通对象 + 字段字符串）+ 必填（provider / api_url / api_token / id 非空）+ api_url 为合法 http(s) URL；不合格条目过滤计数 |
| 结果反馈 | Dialog 弹窗展示结果（新增 / 更新 / 跳过条数或失败原因） |
| 模块划分 | 纯函数模块 `src/lib/key-item-file.ts` + App.vue 胶水，不建独立结果弹窗组件 |

## 架构与文件

### 新增 `src/lib/key-item-file.ts`（纯函数，零 DOM，可单测）

接口：

```ts
export interface MergeResult {
  items: Item[];          // 合并后的完整列表
  added: number;          // 新增条数
  updated: number;        // 覆盖更新条数
}

export type ParseOutcome =
  | { ok: true; validItems: Item[]; skipped: number }
  | { ok: false; error: string };

export function serializeItems(items: Item[]): string;

export function parseKeyItemsFile(text: string): ParseOutcome;

export function mergeItems(existing: Item[], incoming: Item[]): MergeResult;
```

- `serializeItems`：`JSON.stringify(items, null, 2)` 输出裸数组。
- `parseKeyItemsFile`：
  - `JSON.parse` 失败或结果非数组 → `{ ok: false, error: "文件不是合法的 JSON 数组" }`；
  - 逐条校验（判定一律针对 **trim 后** 的值，再判非空与 URL）：条目须为普通对象（非 null / 非数组）；`id / provider / api_url / api_token` 须为存在且 trim 后非空的字符串；`docs_url / remark` 缺省或为字符串；api_url 复用 `src/components/key-item-form-dialog/validation.ts` 导出的 `isHttpUrl`（URL 判定的唯一来源）；只抽取 Item 已知字段、忽略多余键；
  - 合法条目收集进 `validItems`，不合法条目计入 `skipped`；**id 缺失即视为不合法条目**（去重键缺失，无法合并）；
  - **入库归一化**：合法条目的字段一律取 trim 后的字符串（与「添加 / 修改」表单保存行为一致）；文件缺少 `docs_url` / `remark` 时补为 `""`，保证 `validItems` 恒为完整 `Item`（`remark` 允许为空串），避免首尾空白或缺失字段入库。
- `mergeItems`：不原地修改入参。按 id 建索引：incoming 中 id 已存在 → 覆盖对应位置（保持原顺序）；不存在 → 追加末尾。返回新数组与计数。

### 修改 `src/App.vue`（仅胶水）

- 新增隐藏文件输入：`<input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onFileSelected" />`。
- `importJson()`：`fileInput.value?.click()`。
- `onFileSelected(event)`：取第一个文件 → `await file.text()` → `parseKeyItemsFile` → `ok:false` 则设 `importResult = { kind: "error", message }` 并弹窗；`ok:true` 则 `mergeItems(items.value, validItems)` → `items.value = result.items`（useLocalStorage 自动写回）→ `importResult = { kind: "success", added, updated, skipped }` → 弹窗；最后重置 `event.target.value = ""`（允许重复选择同一文件）。
- `exportAndDownload()`：`serializeItems(items.value)` → `Blob`（type `application/json`）→ `URL.createObjectURL` → 临时 `<a download>` 点击 → `revokeObjectURL`。文件名 `llm-api-keys-${YYYYMMDD}-${HHmmss}.json`（本地时间）。
- 结果弹窗：用现有 `ui/dialog` 原语内联于 App.vue；状态：

```ts
type ImportResult =
  | { kind: "success"; added: number; updated: number; skipped: number }
  | { kind: "error"; message: string };
const importResult = ref<ImportResult | null>(null);
const resultOpen = computed({ get: () => importResult.value !== null, set: (v) => { if (!v) importResult.value = null; } });
```

- Dialog 内容：标题「导入结果」（成功，正文「新增 X 条，更新 Y 条，跳过 Z 条」）/「导入失败」（错误，正文 message）；底部「关闭」按钮（outline）；右上关闭、遮罩、Esc 均可关（reka-ui 默认行为）。
- 文件输入仅作触发，不渲染可见控件；`class="hidden"`（Tailwind `display:none`）。

### 新增 `tests/unit/key-item-file.test.ts`

覆盖：合法数组序列化往返、空数组导出、解析成功计数（合法 + 部分跳过 + id 缺失跳过）、非 JSON / 非数组整体失败、多余键被忽略、docs_url/remark 缺省接受、api_url 非法拒绝、merge 的更新保序 / 追加末尾 / 不原地改入参 / 计数正确。

## 交互细节

- 按钮与文案保持现状（「导入JSON数据」「导出到本地」）。
- 导出含当前全部条目（含演示 seed 条目，除非用户已删）。
- api_token 明文随导出（与 localStorage 现状一致），不做加密、不做 CSV、不做导入预览。
- 结果弹窗出现在列表区之上，不打断其他操作。

## 验证标准

1. `pnpm test` 全绿（新增 key-item-file 用例 + 既有 validation 10 用例）。
2. `pnpm build` PASS。
3. dev 手工冒烟：导出下载文件名与内容正确；导入合法文件 → 弹窗「新增 X 条…」，列表与 localStorage 更新；导入含重复 id 文件 → 原位更新；导入非法 JSON → 失败弹窗且列表不变；重复选同一文件可再次导入。

## 范围外

- 不做 CSV / 加密 / 版本包装（version 字段）/ 导入预览 / 拖拽上传 / 批量编辑。
- 不动既有添加 / 修改 / 删除 / 复制按钮逻辑。
- 不改动已批准的「添加 / 修改」规格文档。

## 依赖与沿用

- 复用：`isHttpUrl`（validation.ts）、`Item / ItemDraft`（types.ts）、`ui/dialog` 原语、`Button`、`useLocalStorage`、vitest。
- 新增依赖：无（文件读写用浏览器原生 API）。
- 文档：同步更新 `AGENTS.md`（模块清单、导入 / 导出链路、storage 键名已为 `__llm_api_key_items__`）。
