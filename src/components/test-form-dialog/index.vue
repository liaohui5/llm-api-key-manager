<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import OpenAI from "openai";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button/index.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Item } from "@/types";

const props = withDefaults(
  defineProps<{
    open: boolean;
    item?: Item | null;
  }>(),
  {
    item: null,
  },
);

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
}>();

const dialogOpen = computed({
  get: () => props.open,
  set: (open: boolean) => emit("update:open", open),
});

/** 模型自动获取状态 */
type ModelsStatus = "idle" | "loading" | "success" | "error";

/** 测试请求状态 */
type TestStatus = "idle" | "loading" | "success" | "error";

interface TestState {
  message: string;
  modelName: string;
  modelsStatus: ModelsStatus;
  models: string[];
  testStatus: TestStatus;
  testResult: string;
  testError: string;
}

function emptyState(): TestState {
  return {
    message: "hello",
    modelName: "",
    modelsStatus: "idle",
    models: [],
    testStatus: "idle",
    testResult: "",
    testError: "",
  };
}

const state = reactive<TestState>(emptyState());

/** 一次性提交守卫：防止关闭动画期间重复触发 */
const submitted = ref(false);

function resetState(): void {
  submitted.value = false;
  Object.assign(state, emptyState());
}

watch(
  () => [props.open, props.item],
  () => {
    if (props.open && props.item) {
      resetState();
      // 打开时自动获取模型列表
      fetchModels();
    }
  },
  { immediate: true },
);

/** 自动获取模型列表 */
async function fetchModels(): Promise<void> {
  if (!props.item) return;
  state.modelsStatus = "loading";
  state.models = [];
  try {
    const client = new OpenAI({
      baseURL: props.item.api_url,
      apiKey: props.item.api_token,
      dangerouslyAllowBrowser: true,
    });
    const res = await client.models.list();
    const ids = res.data
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .sort();
    state.models = ids;
    if (ids.length > 0) {
      state.modelsStatus = "success";
      state.modelName = ids[0];
    } else {
      state.modelsStatus = "error";
    }
  } catch (error) {
    console.error(">>> fetch models failed");
    console.error(error);
    state.modelsStatus = "error";
  }
}

/** 发送测试请求 */
async function handleTest(): Promise<void> {
  if (submitted.value) return;
  if (!props.item) return;
  const modelName = state.modelName.trim();
  const message = state.message.trim();
  if (!modelName || !message) return;

  submitted.value = true;
  state.testStatus = "loading";
  state.testResult = "";
  state.testError = "";

  try {
    const client = new OpenAI({
      baseURL: props.item.api_url,
      apiKey: props.item.api_token,
      dangerouslyAllowBrowser: true,
    });
    const res = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: message }],
    });
    const content = res.choices?.[0]?.message?.content ?? "";
    state.testResult = content || "(模型返回空内容)";
    state.testStatus = "success";
  } catch (error) {
    console.error(">>> test request failed");
    console.error(error);
    state.testStatus = "error";
    if (error instanceof Error && error.message) {
      state.testError = error.message;
    } else {
      state.testError = "请求失败，请检查接口地址、密钥或模型名称是否正确";
    }
  } finally {
    submitted.value = false;
  }
}

function handleCancel(): void {
  dialogOpen.value = false;
}

const canSubmit = computed(
  () =>
    state.modelName.trim().length > 0 &&
    state.message.trim().length > 0 &&
    state.testStatus !== "loading",
);
</script>

<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-lg">
      <DialogTitle>测试 API 密钥</DialogTitle>

      <form class="flex flex-col gap-3.5" @submit.prevent="handleTest">
        <!-- api_url 只读 -->
        <div class="flex flex-col gap-1.5">
          <Label>接口地址</Label>
          <Input :model-value="item?.api_url ?? ''" readonly class="opacity-70" />
        </div>

        <!-- api_token 只读 -->
        <div class="flex flex-col gap-1.5">
          <Label>接口密钥</Label>
          <Input :model-value="item?.api_token ?? ''" type="password" readonly class="opacity-70" />
        </div>

        <!-- model_name: 自动获取成功用 select，否则用 input -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <Label>模型名称</Label>
            <!-- 右上角：自动获取文字按钮 -->
            <Button type="button" variant="link" size="xs" class="h-auto p-0"
              :disabled="state.modelsStatus === 'loading'" @click="fetchModels">
              {{ state.modelsStatus === "loading" ? "获取中..." : "自动获取" }}
            </Button>
          </div>

          <!-- 获取成功且有模型：用 select 选择 -->
          <Select v-if="state.modelsStatus === 'success' && state.models.length > 0" v-model="state.modelName">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="请选择模型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in state.models" :key="m" :value="m">
                {{ m }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- 获取失败或未获取：手动填写 input -->
          <Input v-else v-model="state.modelName" placeholder="请输入模型名称，如 gpt-3.5-turbo" />

          <!-- 获取失败提示 -->
          <p v-if="state.modelsStatus === 'error'" class="text-destructive text-xs">
            自动获取失败，请手动填写模型名称
          </p>

          <!-- 右下角：查看文档按钮 -->
          <div v-if="item?.docs_url" class="flex justify-end">
            <a :href="item.docs_url" target="_blank" rel="noopener noreferrer"
              class="text-xs text-primary underline hover:opacity-80">
              查看文档
            </a>
          </div>
        </div>

        <!-- message: 默认 hello，可修改 -->
        <div class="flex flex-col gap-1.5">
          <Label>测试消息</Label>
          <Textarea v-model="state.message" placeholder="请输入要发送的测试消息" class="min-h-20" />
        </div>

        <!-- 测试结果展示 -->
        <div v-if="state.testStatus === 'success'" class="flex flex-col gap-1.5">
          <Label>模型响应</Label>
          <pre
            class="bg-muted rounded-lg p-3 text-xs whitespace-pre-wrap wrap-break-word max-h-60 overflow-auto">{{ state.testResult }}</pre>
        </div>

        <!-- 测试失败展示 -->
        <div v-if="state.testStatus === 'error'" class="flex flex-col gap-1.5">
          <p class="text-destructive text-xs">
            请求失败：{{ state.testError }}
          </p>
        </div>

        <DialogFooter class="mt-1">
          <Button type="button" variant="outline" @click="handleCancel">
            关闭
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            {{ state.testStatus === "loading" ? "测试中..." : "发送测试" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
