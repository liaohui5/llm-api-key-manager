# llm-api-key-manager

> 大模型提供商 API 密钥管理：一个纯前端、无后端的单页工具，在浏览器本地集中管理各家 LLM 提供商的接口地址与 API 密钥。

## 简介

llm-api-key-manager（页面标题：大模型提供商API密钥管理）用于管理多个大模型服务商的 API 接入配置——提供商名称、Base URL（接口地址）、API Token（接口密钥）、文档地址与备注。每条记录对应一个 `Item`，界面以表格形式呈现，并提供新增、修改、删除、复制等操作。

应用为纯前端 SPA（Vue 3 + Vite），不包含任何服务端代码。所有数据只保存在浏览器 `localStorage`（存储键 `__llm_api_key_items__`）中，不会上传到任何服务器；界面会提示「所有内容仅存在本地 localStorage，如果要持久保存请导出到本地文件」。适合需要在开发与测试中频繁切换多家 OpenAI 兼容 API 服务（如 deepseek、公益 API 等）的使用者。

## 特性

- **密钥条目管理**：通过对话框表单新增、修改 API 密钥条目；删除需在弹层中二次确认
- **实时表单校验**：提供商、接口地址、接口密钥必填；接口地址必须为合法的 `http`/`https` URL；提交前自动 `trim` 字段，错误信息逐字段即时提示
- **一键复制**：可分别复制接口地址、追加 `/chat/completions` 后缀的完整调用地址、接口密钥到剪贴板
- **长内容友好展示**：接口地址与密钥超过 15 字符时截断显示，悬浮 Tooltip 可查看完整内容
- **本地持久化**：借助 `@vueuse/core` 的 `useLocalStorage` 自动同步到浏览器 `localStorage`，刷新不丢失
- **JSON 导出**：一键把全部条目导出为格式化 JSON 文件，文件名带时间戳（`llm-api-keys-YYYYMMDD-HHmmss.json`）
- **JSON 导入与合并**：导入本地 JSON 文件，逐条校验并跳过非法记录；按 `id` 与现有数据合并（同 id 原位更新、新 id 追加），完成后弹窗汇报新增/更新/跳过数量
- **文档地址直达**：条目含文档地址时，可一键在新标签页打开
- **单元测试**：Vitest 覆盖表单校验、JSON 文件解析与合并逻辑（26 个用例全部通过）

## 快速开始

### 环境要求

- Node.js `^20.19.0 || >=22.12.0`（Vite 8 的运行要求）
- pnpm 作为包管理器（仓库使用 `pnpm-lock.yaml`）
- 现代浏览器（需支持 `localStorage`、Clipboard API）

### 安装

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

启动后浏览器访问 `http://localhost:5173`，即可在页面中添加、管理 API 密钥条目。

### 生产构建

```bash
pnpm build    # vue-tsc 类型检查 + Vite 构建，产物输出到 dist/
pnpm preview  # 本地预览构建产物
```

### 导入 JSON 数据格式

「导出到本地」产生的文件与导入接受的格式一致，为条目对象的 JSON 数组：

```json
[
  {
    "id": "3c9f2a1e-5b7d-4f0a-9c2e-8d1b6a4e7f03",
    "provider": "deepseek",
    "api_url": "https://api.deepseek.com/v1",
    "api_token": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    "docs_url": "https://api-docs.deepseek.com",
    "remark": "示例备注"
  }
]
```

字段说明：`id`、`provider`、`api_url`、`api_token` 为必填项（`api_url` 需为 `http`/`https` URL，缺 `id` 或必填项为空的条目会被跳过）；`docs_url`、`remark` 为选填，缺省视为空字符串，若存在但不是字符串则整条跳过。多余的键会被忽略，条目间以 `id` 判定去重合并。

## 测试

```bash
pnpm test
```

运行 Vitest 单元测试（配置文件 `vitest.config.ts` 只收集 `tests/**/*.test.ts`），预期输出：

```
 Test Files  2 passed (2)
      Tests  26 passed (26)
```

## 许可

未提供（仓库中暂无 LICENSE 文件）。
