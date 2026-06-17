<template>
  <AdminLayout :baseUrl="apiUrl" @logout="logout">
    <div v-if="loading" class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <h4 class="text-lg font-bold text-gray-800">Q&A 管理</h4>
          <div class="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
            <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key; page = 1; fetchData()"
              class="px-3 py-1 text-xs rounded transition-colors"
              :class="activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'">
              {{ tab.label }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input v-model="search" @input="onSearch" placeholder="搜索内容..."
            class="px-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 w-48" />
          <button @click="showForm = !showForm"
            class="px-3 py-1 text-xs rounded-lg border transition-colors"
            :class="showForm ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'">
            {{ showForm ? '收起' : '新增' }}
          </button>
        </div>
      </div>

      <div v-if="showForm" class="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
        <div class="flex gap-2 mb-3">
          <button @click="qaMode = 'q'"
            class="px-3 py-1 text-xs rounded transition-colors"
            :class="qaMode === 'q' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'">
            发布问题
          </button>
          <button @click="qaMode = 'a'"
            class="px-3 py-1 text-xs rounded transition-colors"
            :class="qaMode === 'a' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'">
            发布回答
          </button>
        </div>
        <textarea v-model="qaForm.content" :placeholder="qaMode === 'q' ? '输入问题内容...' : '输入回答内容...'" rows="4"
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 mb-3 resize-y"></textarea>
        <div class="flex items-center justify-between gap-2" v-if="qaMode === 'a'">
          <select v-model="qaForm.parentId" class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400">
            <option :value="null">选择要回答的问题...</option>
            <option v-for="q in unansweredQuestions" :key="q.id" :value="q.id">{{ q.contentText?.slice(0, 80) }}</option>
          </select>
        </div>
        <div class="flex justify-end mt-3">
          <button @click="postQA"
            class="px-4 py-2 text-xs rounded-lg text-white transition-colors"
            :class="qaMode === 'q' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'">
            {{ qaMode === 'q' ? '发布问题' : '发布回答' }}
          </button>
        </div>
      </div>

      <div class="rounded-lg shadow-sm border overflow-hidden bg-white border-gray-200">
        <div class="divide-y divide-gray-100">
          <div v-if="questions.length === 0" class="px-6 py-12 text-center text-gray-400 text-sm">
            暂无 Q&A 数据
          </div>

          <div v-for="item in questions" :key="item.id" class="transition-colors">
            <div class="px-6 py-4" :class="{ 'bg-amber-50/50': item.status === 'pending' }">
              <div class="flex items-start gap-3">
                <span class="font-bold text-blue-600 whitespace-nowrap flex-shrink-0 text-sm w-5">Q：</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm text-gray-700 break-words" v-html="item.contentHtml || item.contentText"></span>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <span v-if="item.status === 'pending'" class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">待审核</span>
                      <button @click="editItem(item)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all text-xs" title="编辑">
                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                      </button>
                      <button v-if="item.status === 'pending'" @click="approveItem(item.id)"
                        class="w-7 h-7 flex items-center justify-center rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all text-xs" title="通过">
                        <i class="fa-solid fa-check text-xs"></i>
                      </button>
                      <button v-if="!item.children?.length" @click="replyTo(item)"
                        class="w-7 h-7 flex items-center justify-center rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all text-xs" title="回答">
                        <i class="fa-solid fa-reply text-xs"></i>
                      </button>
                      <button @click="togglePin(item.id)"
                        class="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                        :class="item.pinned ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'"
                        :title="item.pinned ? '取消置顶' : '置顶'">
                        <i class="fa-solid fa-thumbtack text-xs"></i>
                      </button>
                      <button @click="del(item.id)"
                        class="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all text-xs" title="删除">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{{ item.author }}</span>
                    <span>{{ formatDate(item.pubDate) }}</span>
                  </div>
                </div>
              </div>

              <template v-if="item.children && item.children.length > 0">
                <div v-for="reply in item.children" :key="reply.id" class="flex items-start gap-3 mt-3 ml-5 pl-3 border-l-2 border-emerald-200">
                  <span class="font-bold text-emerald-600 whitespace-nowrap flex-shrink-0 text-sm w-5">A：</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm text-gray-700 break-words" v-html="reply.contentHtml || reply.contentText"></span>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <button @click="editItem(reply)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all text-xs" title="编辑">
                          <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button @click="del(reply.id)"
                          class="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all text-xs" title="删除">
                          <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{{ reply.author }}</span>
                      <span>{{ formatDate(reply.pubDate) }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
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

      <div v-if="editModalVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="editModalVisible = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
          <h5 class="text-lg font-bold text-gray-800 mb-4">{{ editingItem?.parentId ? '编辑回答' : '编辑问题' }}</h5>
          <textarea v-model="editContent" rows="5"
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 mb-4 resize-y"></textarea>
          <div class="flex justify-end gap-2">
            <button @click="editModalVisible = false"
              class="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">取消</button>
            <button @click="saveEdit"
              class="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors">保存</button>
          </div>
        </div>
      </div>
    </template>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../utils/request'
import toast from '../utils/toast'
import AdminLayout from '../components/AdminLayout.vue'

const router = useRouter()
const loading = ref(false)
const questions = ref([])
const page = ref(1)
const pagination = ref({ page: 1, totalPage: 1 })
const totalCount = ref(0)
const apiUrl = ref(localStorage.getItem('apiUrl') || window.location.origin)
const showForm = ref(false)
const qaMode = ref('q')
const qaForm = reactive({ content: '', parentId: null })
const search = ref('')
const searchTimer = ref(null)
const activeTab = ref('all')

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
]

const unansweredQuestions = computed(() =>
  questions.value
    .map(q => ({ ...q }))
    .filter(q => !q.parentId && !q.children?.length)
)

const buildTree = (flat) => {
  const map = {}
  const roots = []
  for (const item of flat) {
    item.children = []
    map[item.id] = item
  }
  for (const item of flat) {
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children.push(item)
    } else if (!item.parentId) {
      roots.push(item)
    }
  }
  return roots
}

const fetchData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, post_slug: 'about-qa', limit: 50 }
    if (activeTab.value !== 'all') params.status = activeTab.value
    if (search.value.trim()) params.q = search.value.trim()
    const res = await request.get('/admin/comments/list', { params })
    const flat = res.data.comments || []
    questions.value = buildTree(flat)
    pagination.value = res.data.pagination
    totalCount.value = res.data.totalCount || 0
  } catch { toast.error('加载失败') }
  finally { loading.value = false }
}

const onSearch = () => {
  clearTimeout(searchTimer.value)
  searchTimer.value = setTimeout(() => { page.value = 1; fetchData() }, 300)
}

const postQA = async () => {
  if (!qaForm.content?.trim()) return toast.error('请输入内容')
  if (qaMode.value === 'a' && !qaForm.parentId) return toast.error('请选择要回答的问题')
  try {
    await request.post('/api/comments', {
      post_slug: 'about-qa', author: 'Restart',
      email: 'admin@restartyhn.top', content: qaForm.content,
      parent_id: qaMode.value === 'a' ? qaForm.parentId : null,
      post_url: 'https://restartyhn.top/about/', post_title: 'Q&A'
    })
    toast.success('发布成功')
    qaForm.content = ''; qaForm.parentId = null
    showForm.value = false
    fetchData()
  } catch { toast.error('发布失败') }
}

const togglePin = async (id) => {
  try { await request.put(`/admin/comments/${id}/pin`); fetchData() } catch { toast.error('操作失败') }
}

const approveItem = async (id) => {
  try { await request.put(`/admin/comments/${id}`, { status: 'approved' }); toast.success('已通过'); fetchData() } catch { toast.error('操作失败') }
}
const replyTo = (item) => {
  qaMode.value = 'a'
  qaForm.parentId = item.id
  showForm.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const del = async (id) => {
  if (!confirm('确定要删除吗？')) return
  try { await request.delete(`/admin/comments/${id}`); toast.success('已删除'); fetchData() } catch { toast.error('删除失败') }
}

const editModalVisible = ref(false)
const editingItem = ref(null)
const editContent = ref('')

const editItem = (item) => {
  editingItem.value = item
  editContent.value = item.contentText || ''
  editModalVisible.value = true
}

const saveEdit = async () => {
  if (!editingItem.value) return
  try {
    await request.put(`/admin/comments/${editingItem.value.id}`, { content_text: editContent.value })
    toast.success('已保存')
    editModalVisible.value = false
    fetchData()
  } catch { toast.error('保存失败') }
}

const formatDate = (str) => new Date(str).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const logout = () => { localStorage.removeItem('token'); router.push('/login') }

onMounted(fetchData)
</script>
