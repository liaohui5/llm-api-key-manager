<template>
  <VueDraggable
    v-model="dragList"
    target=".drag-tbody"
    handle=".drag-handle"
    :disabled="!draggable"
    :animation="200"
    @end="onDragEnd"
  >
    <Table class="border">
      <!-- table header -->
      <TableHeader>
        <TableRow>
          <TableHead class="w-10">
            <IconGripVertical class="mx-auto h-4 w-4 text-muted-foreground" />
          </TableHead>
          <TableHead>提供商</TableHead>
          <TableHead>接口地址</TableHead>
          <TableHead>接口密钥</TableHead>
          <TableHead>备注说明</TableHead>
          <TableHead>文档地址</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <!-- table body -->
      <TableBody class="drag-tbody">
        <!-- row -->
        <TableRow v-for="item of dragList" :key="item.id">
          <TableCell class="w-10">
            <IconGripVertical
              class="drag-handle mx-auto h-4 w-4"
              :class="draggable ? 'cursor-grab' : 'cursor-not-allowed opacity-50'"
            />
          </TableCell>
          <TableCell>{{ item.provider }}</TableCell>
          <TableCell>
            <div class="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="mr-1">{{ onlyShow15Chars(item.api_url) }}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{{ item.api_url }}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="ghost" @click="handleCopy(item.api_url)">
                      <IconCopy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>仅复制</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="ghost" @click="handleCopy(item.api_url, true)">
                      <IconCopy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>复制 `/chat/completions` 后缀地址</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableCell>
          <TableCell>
            <div class="flex items-center">
              <span class="mr-1">{{ onlyShow15Chars(item.api_token) }}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="ghost" @click="handleCopy(item.api_token)">
                      <IconCopy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>复制</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableCell>
          <TableCell>{{ item.remark }}</TableCell>
          <TableCell>
            <Button variant="link" v-if="item.docs_url">
              <a :href="item.docs_url" class="text-blue-500" target="_blank">新标签页打开</a>
            </Button>
          </TableCell>
          <TableCell>
            <div class="flex justify-around">
              <Button class="hover:cursor-pointer" variant="outline" @click="handleEdit(item)"
                >修改</Button
              >

              <Button class="hover:cursor-pointer" variant="outline" @click="handleTest(item)"
                >测试</Button
              >

              <Popover>
                <PopoverTrigger>
                  <Button class="hover:cursor-pointer" variant="destructive">删除</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div>确定要删除吗?</div>
                  <div class="flex justify-around">
                    <Button class="hover:cursor-pointer" variant="outline">取消</Button>
                    <Button
                      class="hover:cursor-pointer"
                      variant="destructive"
                      @click="handleDelete(item)"
                      >确定</Button
                    >
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </TableCell>
        </TableRow>
        <TableEmpty v-if="dragList.length === 0 && emptyText" :colspan="7">
          {{ emptyText }}
        </TableEmpty>
      </TableBody>
    </Table>
  </VueDraggable>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table/index.ts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconCopy, IconGripVertical } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button/index.ts";
import { VueDraggable } from "vue-draggable-plus";
import { type Item } from "@/types";

const props = withDefaults(
  defineProps<{
    items: Item[];
    draggable?: boolean;
    emptyText?: string;
  }>(),
  {
    items: () => [],
    draggable: true,
    emptyText: undefined,
  },
);

// VueDraggable 的 v-model 副本：跟随外部 items，避免直接修改 props
const dragList = ref<Item[]>([]);
watch(
  () => props.items,
  (value) => {
    dragList.value = [...value];
  },
  { deep: true, immediate: true },
);

function onlyShow15Chars(str: string): string {
  if (str.length > 15) {
    return str.slice(0, 15) + "...";
  }
  return str;
}

const emits = defineEmits<{
  (e: "delete", id: string): void;
  (e: "copy", id: string): void;
  (e: "edit", item: Item): void;
  (e: "test", item: Item): void;
  (e: "reorder", items: Item[]): void;
}>();

function handleDelete(item: Item) {
  emits("delete", item.id);
}

function handleEdit(item: Item) {
  emits("edit", item);
}

function handleCopy(str: string, isWithSuffix: boolean = false) {
  const slash = str.endsWith("/") ? "" : "/";
  isWithSuffix ? emits("copy", `${str}${slash}chat/completions`) : emits("copy", str);
}

function handleTest(item: Item) {
  emits("test", item);
}

function onDragEnd() {
  const before = props.items.map((item) => item.id).join(",");
  const after = dragList.value.map((item) => item.id).join(",");
  if (before === after) return;
  emits("reorder", [...dragList.value]);
}
</script>