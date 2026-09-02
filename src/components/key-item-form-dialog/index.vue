<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button/index.ts";
import { type Item, type ItemDraft } from "@/types";
import {
  validateKeyItemDraft,
  type KeyItemErrors,
  type KeyItemField,
} from "./validation";

const props = withDefaults(
  defineProps<{
    mode: "create" | "edit";
    open: boolean;
    item?: Item | null;
  }>(),
  {
    item: null,
  },
);

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "submit", draft: ItemDraft): void;
}>();

const dialogOpen = computed({
  get: () => props.open,
  set: (open: boolean) => emit("update:open", open),
});

const title = computed(() =>
  props.mode === "create" ? "添加新的API密钥" : "修改API密钥",
);

const emptyDraft = (): DraftState => ({
  provider: "",
  api_url: "",
  api_token: "",
  docs_url: "",
  remark: "",
});

/** 草稿本地状态：全部字段必填 string（含 remark），避免对可选字段直接 .trim() 的类型错误 */
type DraftState = Record<KeyItemField, string>;

const draft = reactive<DraftState>(emptyDraft());
const errors = ref<KeyItemErrors>({});

/** 一次性提交守卫：reka 关闭动画期间按钮仍可触发保存，防止创建模式重复入库 */
const submitted = ref(false);

function clearErrors(): void {
  errors.value = {};
}

function resetDraft(): void {
  submitted.value = false;
  clearErrors();
  if (props.mode === "edit" && props.item) {
    draft.provider = props.item.provider;
    draft.api_url = props.item.api_url;
    draft.api_token = props.item.api_token;
    draft.docs_url = props.item.docs_url;
    draft.remark = props.item.remark ?? "";
  } else {
    Object.assign(draft, emptyDraft());
  }
}

watch(
  () => [props.open, props.item, props.mode],
  () => {
    if (props.open) resetDraft();
  },
  { immediate: true },
);

const fieldGroups: { field: KeyItemField; label: string; placeholder: string }[] = [
  { field: "provider", label: "提供商", placeholder: "如: deepseek" },
  { field: "api_url", label: "接口地址", placeholder: "https://api.deepseek.com/v1" },
  { field: "api_token", label: "接口密钥", placeholder: "sk-..." },
  { field: "docs_url", label: "文档地址(选填)", placeholder: "https://..." },
  { field: "remark", label: "备注说明(选填)", placeholder: "" },
];

function clearError(field: KeyItemField): void {
  if (errors.value[field]) {
    const next = { ...errors.value };
    delete next[field];
    errors.value = next;
  }
}

function handleSubmit(): void {
  if (submitted.value) return;
  const payload: ItemDraft = {
    provider: draft.provider.trim(),
    api_url: draft.api_url.trim(),
    api_token: draft.api_token.trim(),
    docs_url: draft.docs_url.trim(),
    remark: draft.remark.trim(),
  };
  const nextErrors = validateKeyItemDraft(payload);
  if (Object.keys(nextErrors).length > 0) {
    errors.value = nextErrors;
    return;
  }
  emit("submit", payload);
  submitted.value = true;
  dialogOpen.value = false;
}

function handleCancel(): void {
  dialogOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-lg">
      <DialogTitle>{{ title }}</DialogTitle>

      <form class="flex flex-col gap-3.5" @submit.prevent="handleSubmit">
        <div v-for="group in fieldGroups" :key="group.field" class="flex flex-col gap-1.5">
          <Label>{{ group.label }}</Label>
          <Input
            v-model="draft[group.field]"
            :type="group.field === 'api_token' ? 'password' : 'text'"
            :placeholder="group.placeholder"
            :aria-invalid="errors[group.field] ? 'true' : undefined"
            :aria-describedby="errors[group.field] ? `${group.field}-error` : undefined"
            @input="clearError(group.field)"
          />
          <p
            v-if="errors[group.field]"
            :id="`${group.field}-error`"
            class="text-destructive text-xs"
          >
            {{ errors[group.field] }}
          </p>
        </div>

        <DialogFooter class="mt-1">
          <Button type="button" variant="outline" @click="handleCancel">取消</Button>
          <Button type="submit">保存</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
