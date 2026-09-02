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
