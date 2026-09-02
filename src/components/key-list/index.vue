<template>
  <Table class="border">
    <!-- table header -->
    <TableHeader>
      <TableRow>
        <TableHead>提供商</TableHead>
        <TableHead>接口地址</TableHead>
        <TableHead>接口密钥</TableHead>
        <TableHead>文档地址</TableHead>
        <TableHead>备注说明</TableHead>
        <TableHead>操作</TableHead>
      </TableRow>
    </TableHeader>
    <!-- table body -->
    <TableBody>
      <!-- row -->
      <TableRow v-for="item of items" :key="item.id">
        <TableCell>{{ item.provider }}</TableCell>
        <TableCell>
          <div class="flex items-center">
            <span class="mr-1">{{ onlyShow15Chars(item.api_url) }}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost">
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
                  <Button variant="ghost">
                    <IconCopy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>复制 /chat/completions 接口地址</p>
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
                  <Button variant="ghost">
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
        <TableCell>
          <a :href="item.docs_url" class="text-blue-500" target="_blank">新标签页打开</a>
        </TableCell>
        <TableCell>{{ item.remark }}</TableCell>
        <TableCell>
          <div class="flex justify-around">
            <Button
              class="hover:cursor-pointer"
              variant="outline"
              @click="handleEdit(item)"
              >修改</Button
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
    </TableBody>
  </Table>
</template>

<script lang="ts" setup>
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table/index.ts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconCopy } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button/index.ts";
import { type Item } from "@/types";

withDefaults(defineProps<{ items: Item[] }>(), {
  items: () => [],
});

function onlyShow15Chars(str: string): string {
  if (str.length > 15) {
    return str.slice(0, 15) + "...";
  }
  return str;
}

const emits = defineEmits<{
  (e: "delete", id: string): void;
  (e: "edit", item: Item): void;
}>();

function handleDelete(item: Item) {
  emits("delete", item.id);
}

function handleEdit(item: Item) {
  emits("edit", item);
}
</script>
