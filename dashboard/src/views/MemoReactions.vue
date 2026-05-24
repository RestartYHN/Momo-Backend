<template>
  <div class="p-4">
    <h4 class="text-lg font-bold mb-3">Memo 反应管理</h4>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead><tr class="border-b"><th class="py-2">Memo ID</th><th class="py-2">反应</th><th class="py-2">次数</th><th class="py-2">最后时间</th><th class="py-2 w-20">操作</th></tr></thead>
        <tbody>
          <tr v-for="r in data" :key="r.memo_id+r.reaction_type" class="border-b hover:bg-gray-50">
            <td class="py-2 font-mono text-xs">{{ r.memo_id }}</td>
            <td class="py-2 text-lg">{{ r.reaction_type }}</td>
            <td class="py-2">{{ r.cnt }}</td>
            <td class="py-2 text-xs text-gray-400">{{ r.last_at }}</td>
            <td class="py-2"><button @click="del(r.memo_id, r.reaction_type)" class="text-xs text-red-500 hover:underline">删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex gap-2 mt-4 text-xs">
      <button @click="page--" :disabled="page<=1" class="px-2 py-1 border rounded">◀</button>
      <span class="px-2 py-1">{{ page }} / {{ totalPage }}</span>
      <button @click="page++" :disabled="page>=totalPage" class="px-2 py-1 border rounded">▶</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request'

const data = ref([])
const page = ref(1)
const totalPage = ref(1)

onMounted(fetchData)

async function fetchData() {
  const res = await request.get('/admin/memo-reactions', { params: { page: page.value } })
  data.value = res.data
  totalPage.value = res.pagination.totalPage
}
async function del(memo, type) {
  await request.delete('/admin/memo-reactions', { params: { memo, type } })
  fetchData()
}
</script>
