<template>
  <AdminLayout :baseUrl="apiUrl" @logout="logout">
    <div v-if="loading" class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-lg font-bold text-gray-800">Memo 反应管理</h4>
        <span class="text-xs text-gray-400">共 {{ pagination.totalPage }} 页</span>
      </div>

      <div class="rounded-lg shadow-sm border overflow-hidden bg-white border-gray-200">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b bg-gray-50 border-gray-200">
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">Memo ID</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">类型</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500 w-16 text-center">次数</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">最后更新</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-right text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="r in data" :key="r.memo_id+r.reaction_type" class="transition-colors hover:bg-gray-50">
                <td class="px-6 py-3">
                  <span class="text-xs font-mono text-gray-700">{{ r.memo_id }}</span>
                </td>
                <td class="px-6 py-3 text-2xl">{{ r.reaction_type }}</td>
                <td class="px-6 py-3 text-center">
                  <span class="text-sm font-mono text-gray-600">{{ r.cnt }}</span>
                </td>
                <td class="px-6 py-3">
                  <span class="text-xs text-gray-400">{{ r.last_at }}</span>
                </td>
                <td class="px-6 py-3 text-right">
                  <button @click="del(r.memo_id, r.reaction_type)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                    title="删除">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="px-6 py-3 border-t flex items-center justify-between bg-gray-50 border-gray-200">
          <span class="text-xs text-gray-500">共 {{ pagination.totalPage }} 页</span>
          <div class="flex items-center space-x-1">
            <button @click="page--" :disabled="page<=1"
              class="px-3 py-1 text-xs font-medium rounded border disabled:opacity-40 transition-colors border-gray-300 bg-white text-gray-700 hover:bg-gray-50">上一页</button>
            <span class="px-4 text-xs font-bold text-gray-700">{{ page }}</span>
            <button @click="page++" :disabled="page>=pagination.totalPage"
              class="px-3 py-1 text-xs font-medium rounded border disabled:opacity-40 transition-colors border-gray-300 bg-white text-gray-700 hover:bg-gray-50">下一页</button>
          </div>
        </div>
      </div>
    </template>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../utils/request'
import toast from '../utils/toast'
import AdminLayout from '../components/AdminLayout.vue'

const router = useRouter()
const loading = ref(false)
const data = ref([])
const page = ref(1)
const pagination = ref({ page: 1, totalPage: 1 })
const apiUrl = ref(localStorage.getItem('apiUrl') || window.location.origin)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/admin/memo-reactions', { params: { page: page.value } })
    data.value = res.data
    pagination.value = res.pagination
  } catch { toast.error('加载失败') }
  finally { loading.value = false }
}

const del = async (memo, type) => {
  try {
    await request.delete('/admin/memo-reactions', { params: { memo, type } })
    toast.success('已删除')
    fetchData()
  } catch { toast.error('删除失败') }
}

const logout = () => { localStorage.removeItem('token'); router.push('/login') }

onMounted(fetchData)
</script>
