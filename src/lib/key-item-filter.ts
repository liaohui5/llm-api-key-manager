import type { Item } from "@/types";

export function filterKeyItems(items: Item[], keyword: string): Item[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return items;
  return items.filter((item) => item.provider.toLowerCase().includes(kw));
}