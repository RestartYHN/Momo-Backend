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
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">Memo</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">类型</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500 w-20 text-center">总次数</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500 w-20 text-center">用户</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500 w-20 text-center">管理</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">最后更新</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500 w-20 text-center">操作</th>
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
                <td class="px-6 py-3 text-center">
                  <span class="text-xs text-gray-400">{{ r.user_cnt }}</span>
                </td>
                <td class="px-6 py-3 text-center">
                  <input v-model.number="edits[r.memo_id+r.reaction_type]" type="number" min="0"
                    class="w-14 text-center text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                    :placeholder="r.admin_cnt" />
                </td>
                <td class="px-6 py-3">
                  <span class="text-xs text-gray-400">{{ r.last_at }}</span>
                </td>
                <td class="px-6 py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button @click="saveEdit(r.memo_id, r.reaction_type)"
                      class="w-7 h-7 flex items-center justify-center rounded bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-xs" title="保存">✓</button>
                    <button @click="del(r.memo_id, r.reaction_type)"
                      class="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all text-xs" title="删除">✕</button>
                  </div>
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
import { ref, reactive, onMounted } from 'vue'
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
const edits = reactive({})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/admin/memo-reactions', { params: { page: page.value } })
    data.value = res.data
    pagination.value = res.pagination
  } catch { toast.error('加载失败') }
  finally { loading.value = false }
}

const saveEdit = async (memo, type) => {
  const key = memo + type
  const v = edits[key]
  if (v == null) return
  try {
    await request.put('/admin/memo-reactions', { memo, type, count: v })
    edits[key] = undefined
    toast.success('已更新')
    fetchData()
  } catch { toast.error('更新失败') }
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
