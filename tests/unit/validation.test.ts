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
    for (const bad of [
      "not-a-url",
      "example.com/v1",
      "ftp://example.com/v1",
      "https://",
      "http://",
    ]) {
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
