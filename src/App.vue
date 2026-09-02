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

    <!-- llm api items table -->
    <KeyList :items="items" @delete="deleteKeyItem" @edit="showUpdateForm" />

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
import { type Item, type ItemDraft } from "@/types";

const __ITEMS_STORAGE_KEY__ = "__llm_api_key_items__";
const items = useLocalStorage<Item[]>(__ITEMS_STORAGE_KEY__, [
  {
    id: "905fd4d1-38a4-48b5-95e5-2f0122dfd902",
    provider: "新疆公益API",
    api_url: "https://api.hcnsec.cn/v1",
    api_token: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    docs_url: "https://api.hcnsec.cn",
    remark: "提供免费模型",
  },
]);

const createOpen = ref(false);
const editItem = ref<Item | null>(null);
const hasEditItem = computed(() => editItem.value !== null);

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
  // 导入JSON数据并验证(过滤掉不符合 Item)的数据
}

function exportAndDownload() {
  // TODO: 导出到本地 -> 触发浏览器下载
}
</script>
