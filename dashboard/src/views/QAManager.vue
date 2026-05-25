<template>
  <AdminLayout :baseUrl="apiUrl" @logout="logout">
    <div v-if="loading" class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-lg font-bold text-gray-800">Q&A 管理</h4>
        <span class="text-xs text-gray-400">共 {{ pagination.totalPage }} 页</span>
      </div>

      <div class="rounded-lg shadow-sm border overflow-hidden bg-white border-gray-200">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b bg-gray-50 border-gray-200">
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500 w-24">问题</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">内容</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500 w-16 text-center">回复</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-gray-500">时间</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase text-right text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="q in questions" :key="q.id" class="transition-colors hover:bg-gray-50">
                <td class="px-6 py-3">
                  <span class="font-bold text-sm text-gray-800">{{ q.author }}</span>
                </td>
                <td class="px-6 py-3">
                  <p class="text-sm text-gray-600 max-w-md line-clamp-2">{{ q.contentText }}</p>
                </td>
                <td class="px-6 py-3 text-center">
                  <span class="text-xs px-2 py-0.5 rounded-full" :class="q.replyCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">{{ q.replyCount ? '已答' : '待答' }}</span>
                </td>
                <td class="px-6 py-3">
                  <span class="text-xs text-gray-400">{{ formatDate(q.pubDate) }}</span>
                </td>
                <td class="px-6 py-3 text-right">
                  <div class="flex justify-end gap-1">
                    <button @click="togglePin(q.id)"
                      class="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                      :class="q.pinned ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'"
                      :title="q.pinned ? '取消置顶' : '置顶'">
                      <i class="fa-solid fa-thumbtack text-xs"></i>
                    </button>
                    <button @click="del(q.id)"
                      class="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all text-xs" title="删除">
                      <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="px-6 py-3 border-t flex items-center justify-between bg-gray-50 border-gray-200">
          <span class="text-xs text-gray-500">共 {{ pagination.totalPage }} 页</span>
          <div class="flex items-center space-x-1">
            <button @click="page--" :disabled="page<=1" class="px-3 py-1 text-xs font-medium rounded border disabled:opacity-40 transition-colors border-gray-300 bg-white text-gray-700 hover:bg-gray-50">上一页</button>
            <span class="px-4 text-xs font-bold text-gray-700">{{ page }}</span>
            <button @click="page++" :disabled="page>=pagination.totalPage" class="px-3 py-1 text-xs font-medium rounded border disabled:opacity-40 transition-colors border-gray-300 bg-white text-gray-700 hover:bg-gray-50">下一页</button>
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
const questions = ref([])
const page = ref(1)
const pagination = ref({ page: 1, totalPage: 1 })
const apiUrl = ref(localStorage.getItem('apiUrl') || window.location.origin)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/admin/comments/list', { params: { page: page.value, post_slug: 'about-qa' } })
    questions.value = res.data.comments || []
    pagination.value = res.data.pagination
  } catch { toast.error('加载失败') }
  finally { loading.value = false }
}

const togglePin = async (id) => {
  try { await request.put(`/admin/comments/${id}/pin`); fetchData() } catch { toast.error('操作失败') }
}
const del = async (id) => {
  try { await request.delete(`/admin/comments/${id}`); toast.success('已删除'); fetchData() } catch { toast.error('删除失败') }
}
const formatDate = (str) => new Date(str).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const logout = () => { localStorage.removeItem('token'); router.push('/login') }

onMounted(fetchData)
</script>
