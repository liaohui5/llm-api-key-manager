<template>
  <div class="w-8/10 mx-auto">
    <h2 class="text-2xl text-center py-4">大模型提供商API密钥管理</h2>
    <div class="flex items-center justify-end py-2">
      <Button variant="outline" class="hover:cursor-pointer" @click="showCreateForm">
        添加新的API密钥
      </Button>
    </div>

    <KeyList :items="items" @delete="deleteKeyItem" @edit="showUpdateForm" />

    <KeyItemFormDialog
      mode="create"
      :open="createOpen"
      @update:open="hideCreateForm"
      @submit="createKeyItem"
    />
    <KeyItemFormDialog
      mode="edit"
      :open="editItem !== null"
      :item="editItem"
      @update:open="hideUpdateForm"
      @submit="updateKeyItem"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useLocalStorage } from "@vueuse/core";
import KeyList from "@/components/key-list/index.vue";
import KeyItemFormDialog from "@/components/key-item-form-dialog/index.vue";
import { Button } from "@/components/ui/button/index.ts";
import { type Item, type ItemDraft } from "@/types";

const __ITEM_KEY__ = "__item_storage_key__";
const items = useLocalStorage<Item[]>(__ITEM_KEY__, [
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
</script>
