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
