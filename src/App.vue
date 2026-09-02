<template>
  <div class="w-8/10 mx-auto">
    <h2 class="text-2xl text-center py-4">大模型提供商API密钥管理</h2>
    <div class="flex items-center justify-end py-2">
      <Button variant="outline" class="hover:cursor-pointer">添加新的API密钥</Button>
    </div>

    <KeyList :items="items" @delete="deleteKeyItem" />

    <!-- <CreateKeyItem /> -->
    <!-- <UpdateKeyItem /> -->
  </div>
</template>

<script setup lang="ts">
// import CreateKeyItem from "@/components/create-key-item/index.vue";
// import UpdateKeyItem from "@/components/update-key-item/index.vue";
import KeyList from "@/components/key-list/index.vue";
import { Button } from "@/components/ui/button/index.ts";
import { useLocalStorage } from "@vueuse/core";
import { type Item } from "@/types";

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

function showCreateForm() {}

function hideCreateForm() {}

function createKeyItem() {}

function showUpdateForm() {}

function hideUpdateForm() {}

function updateKeyItem() {}

function deleteKeyItem(id: string) {
  items.value = items.value.filter((item) => item.id !== id);
}
</script>
