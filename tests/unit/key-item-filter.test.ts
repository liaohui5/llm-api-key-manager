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