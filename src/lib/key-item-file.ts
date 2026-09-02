import type { Item } from "@/types";
import { isHttpUrl } from "@/components/key-item-form-dialog/validation";

export interface MergeResult {
  items: Item[];
  added: number;
  updated: number;
}

export type ParseOutcome =
  | { ok: true; validItems: Item[]; skipped: number }
  | { ok: false; error: string };

export function serializeItems(items: Item[]): string {
  return JSON.stringify(items, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 选填字段：缺省 → ""；存在但非字符串 → null（整条无效） */
function optionalString(value: unknown): string | null {
  if (value === undefined) return "";
  return typeof value === "string" ? value.trim() : null;
}

function normalizeEntry(raw: unknown): Item | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const provider = typeof raw.provider === "string" ? raw.provider.trim() : "";
  const apiUrl = typeof raw.api_url === "string" ? raw.api_url.trim() : "";
  const apiToken = typeof raw.api_token === "string" ? raw.api_token.trim() : "";
  if (!id || !provider || !apiUrl || !apiToken || !isHttpUrl(apiUrl)) return null;

  const docsUrl = optionalString(raw.docs_url);
  const remark = optionalString(raw.remark);
  if (docsUrl === null || remark === null) return null;

  return { id, provider, api_url: apiUrl, api_token: apiToken, docs_url: docsUrl, remark };
}

export function parseKeyItemsFile(text: string): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件内容不是合法的 JSON" };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "文件不是合法的 JSON 数组" };
  }

  const validItems: Item[] = [];
  let skipped = 0;
  for (const entry of parsed) {
    const item = normalizeEntry(entry);
    if (item) validItems.push(item);
    else skipped++;
  }
  return { ok: true, validItems, skipped };
}

export function mergeItems(existing: Item[], incoming: Item[]): MergeResult {
  const items = [...existing];
  const indexById = new Map<string, number>();
  existing.forEach((item, index) => indexById.set(item.id, index));

  let added = 0;
  let updated = 0;
  for (const item of incoming) {
    const index = indexById.get(item.id);
    if (index === undefined) {
      indexById.set(item.id, items.length);
      items.push(item);
      added++;
    } else {
      items[index] = item;
      updated++;
    }
  }
  return { items, added, updated };
}
