<template>
  <div class="w-8/10 mx-auto pb-30">
    <!-- top title -->
    <h2 class="text-2xl text-center py-10">大模型提供商API密钥管理</h2>

    <!-- top tips -->
    <div class="flex justify-center py-2">
      <Alert class="w-3/7">
        <IconInfoCircle />
        <AlertTitle>注意所有内容仅存在本地 localStorage, 如果要持久保存请导出到本地文件</AlertTitle>
      </Alert>
    </div>

    <!-- buttons -->
    <div class="flex items-center justify-end py-2">
      <Button variant="outline" class="mx-2 hover:cursor-pointer" @click="importJson">
        <span>导入JSON数据</span>
      </Button>
      <Button variant="outline" class="mx-2 hover:cursor-pointer" @click="exportAndDownload">
        <span>导出到本地</span>
      </Button>
      <Button variant="outline" class="hover:cursor-pointer" @click="showCreateForm">
        <span>添加新的API密钥</span>
      </Button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onFileSelected"
    />

    <!-- llm api items table -->
    <KeyList :items="items" @copy="handleCopy" @delete="deleteKeyItem" @edit="showUpdateForm" />

    <!-- create form dialog -->
    <KeyItemFormDialog
      mode="create"
      :open="createOpen"
      @update:open="hideCreateForm"
      @submit="createKeyItem"
    />

    <!-- update form dialog -->
    <KeyItemFormDialog
      mode="edit"
      :open="hasEditItem"
      :item="editItem"
      @update:open="hideUpdateForm"
      @submit="updateKeyItem"
    />

    <!-- import result dialog -->
    <Dialog v-model:open="resultOpen">
      <DialogContent class="sm:max-w-md">
        <DialogTitle>{{ resultTitle }}</DialogTitle>
        <p v-if="importResult && importResult.kind === 'success'" class="text-sm text-foreground">
          新增 {{ importResult.added }} 条，更新 {{ importResult.updated }} 条，跳过
          {{ importResult.skipped }} 条
        </p>
        <p
          v-else-if="importResult && importResult.kind === 'error'"
          class="text-sm text-destructive"
        >
          {{ importResult.message }}
        </p>
        <DialogFooter>
          <Button variant="outline" @click="resultOpen = false">关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useLocalStorage } from "@vueuse/core";
import KeyList from "@/components/key-list/index.vue";
import KeyItemFormDialog from "@/components/key-item-form-dialog/index.vue";
import { IconInfoCircle } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button/index.ts";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { type Item, type ItemDraft } from "@/types";
import { mergeItems, parseKeyItemsFile, serializeItems, exportFilename } from "@/lib/key-item-file";
import { downloadBlob } from "@/lib/download";
import copy2clipboard from "copy-to-clipboard";

const __ITEMS_STORAGE_KEY__ = "__llm_api_key_items__";
const items = useLocalStorage<Item[]>(__ITEMS_STORAGE_KEY__, [
  {
    id: "905fd4d1-38a4-48b5-95e5-2f0122dfd902",
    provider: "公益API",
    api_url: "https://api.hcnsec.cn/v1",
    api_token: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    docs_url: "https://api.hcnsec.cn",
    remark: "提供免费模型",
  },
]);

const createOpen = ref(false);
const editItem = ref<Item | null>(null);
const hasEditItem = computed(() => editItem.value !== null);

type ImportResult =
  | { kind: "success"; added: number; updated: number; skipped: number }
  | { kind: "error"; message: string };

const fileInput = ref<HTMLInputElement | null>(null);
const importResult = ref<ImportResult | null>(null);
const resultOpen = computed({
  get: () => importResult.value !== null,
  set: (open: boolean) => {
    if (!open) importResult.value = null;
  },
});
const resultTitle = computed(() =>
  importResult.value?.kind === "success" ? "导入结果" : "导入失败",
);

function showCreateForm() {
  createOpen.value = true;
}

function hideCreateForm() {
  createOpen.value = false;
}

function showUpdateForm(item: Item) {
  editItem.value = item;
}

function hideUpdateForm() {
  editItem.value = null;
}

function createKeyItem(draft: ItemDraft) {
  items.value.push({ ...draft, id: uuidv4() });
}

function updateKeyItem(draft: ItemDraft) {
  const targetId = editItem.value?.id;
  if (!targetId) return;
  items.value = items.value.map((item) =>
    item.id === targetId ? { ...draft, id: targetId } : item,
  );
}

function deleteKeyItem(id: string) {
  items.value = items.value.filter((item) => item.id !== id);
}

function importJson() {
  fileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = ""; // 允许重复选择同一文件

  let text: string;
  try {
    text = await file.text();
  } catch {
    importResult.value = { kind: "error", message: "读取文件失败" };
    return;
  }

  const outcome = parseKeyItemsFile(text);
  if (!outcome.ok) {
    importResult.value = { kind: "error", message: outcome.error };
    return;
  }

  const merged = mergeItems(items.value, outcome.validItems);
  items.value = merged.items;
  importResult.value = {
    kind: "success",
    added: merged.added,
    updated: merged.updated,
    skipped: outcome.skipped,
  };
}

function exportAndDownload() {
  const text = serializeItems(items.value);
  const blob = new Blob([text], { type: "application/json" });
  downloadBlob(blob, exportFilename());
}

async function handleCopy(text: string) {
  try {
    await copy2clipboard(text);
  } catch (error) {
    console.error(">>> copy failed");
    console.error(error);
  }
}
</script>
