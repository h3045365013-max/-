<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import builtInBooks from './data/books.json'
import { createMemory, orderForReview, updateMemory } from './utils/review.js'

const STORAGE_KEY = 'sentence-vocab-v1'
const navItems = [{ id: 'study', label: '首页背诵' }, { id: 'mistakes', label: '错题本' }, { id: 'favorites', label: '我的收藏' }, { id: 'books', label: '词书管理' }]
const readSaved = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} } }
const saved = readSaved()
const books = ref(saved.books?.length ? saved.books : builtInBooks)
const activeBookId = ref(saved.activeBookId || 'kaoyan')
const memories = ref(saved.memories || {})
const page = ref('study')
const index = ref(0)
const cardStage = ref('sentence')
const todayCount = ref(saved.todayDate === new Date().toDateString() ? (saved.todayCount || 0) : 0)
const todayDate = ref(new Date().toDateString())
const dark = ref(saved.dark || false)
const notice = ref('')
let noticeTimer

const activeBook = computed(() => books.value.find(book => book.id === activeBookId.value) || books.value[0])
const orderedWords = computed(() => activeBook.value ? orderForReview(activeBook.value.words, memories.value) : [])
const word = computed(() => orderedWords.value.length ? orderedWords.value[((index.value % orderedWords.value.length) + orderedWords.value.length) % orderedWords.value.length] : null)
const totalWords = computed(() => books.value.reduce((sum, book) => sum + book.words.length, 0))
const masteredCount = computed(() => activeBook.value?.words.filter(item => memories.value[item.word]?.level === 2).length || 0)
const mastery = computed(() => activeBook.value?.words.length ? Math.round(masteredCount.value / activeBook.value.words.length * 100) : 0)
const mistakes = computed(() => activeBook.value?.words.filter(item => (memories.value[item.word]?.wrong || 0) > 0) || [])
const favorites = computed(() => activeBook.value?.words.filter(item => memories.value[item.word]?.favorite) || [])
const visibleList = computed(() => page.value === 'mistakes' ? mistakes.value : favorites.value)

watch([books, activeBookId, memories, todayCount, dark], () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ books: books.value, activeBookId: activeBookId.value, memories: memories.value, todayCount: todayCount.value, todayDate: todayDate.value, dark: dark.value }))
}, { deep: true })
watch([activeBookId, page], () => resetCard())
onMounted(() => document.documentElement.classList.toggle('dark', dark.value))
watch(dark, value => document.documentElement.classList.toggle('dark', value))

function resetCard() { index.value = 0; cardStage.value = 'sentence' }
function changePage(next) { page.value = next; resetCard() }
function switchBook(event) { activeBookId.value = event.target.value; page.value = 'study'; resetCard() }
function step(amount) { if (!orderedWords.value.length) return; index.value = (index.value + amount + orderedWords.value.length) % orderedWords.value.length; cardStage.value = 'sentence' }
function flash(message) { notice.value = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notice.value = '', 2200) }
function chooseFamiliarity() { cardStage.value = 'meaning' }
function rateRecall(isCorrect) {
  if (!word.value) return
  memories.value[word.value.word] = updateMemory(memories.value[word.value.word] || createMemory(), isCorrect)
  todayCount.value += 1
  flash(isCorrect ? '记忆已记录，下一次复习已安排' : '已加入本组重测')
  index.value += 1
  cardStage.value = 'sentence'
}
function speak(text) {
  if (!('speechSynthesis' in window)) return flash('当前浏览器不支持语音朗读')
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = 0.88; window.speechSynthesis.speak(utterance)
}
function toggleFavorite(item = word.value) {
  if (!item) return
  const memory = { ...createMemory(), ...(memories.value[item.word] || {}) }
  memory.favorite = !memory.favorite
  memories.value[item.word] = memory
  flash(memory.favorite ? '已加入收藏' : '已取消收藏')
}
function importBook(event) {
  const file = event.target.files?.[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)); const entries = Array.isArray(parsed) ? parsed : parsed.words
      if (!Array.isArray(entries) || !entries.length) throw new Error('JSON需为单词数组或包含 words 数组')
      const valid = entries.every(item => ['word', 'phonetic', 'meaning', 'sentence', 'sentenceCn', 'tag'].every(key => typeof item[key] === 'string' && item[key].trim()))
      if (!valid) throw new Error('每条单词都需含 word、phonetic、meaning、sentence、sentenceCn、tag 字段')
      const id = `custom-${Date.now()}`; const tag = entries[0].tag
      books.value.push({ id, name: parsed.name || `${tag}自定义词书`, tag, words: entries })
      activeBookId.value = id; page.value = 'study'; resetCard(); flash(`导入成功：${entries.length} 个单词`)
    } catch (error) { flash(error.message || '文件读取失败，请检查 JSON 格式') }
    event.target.value = ''
  }
  reader.readAsText(file, 'UTF-8')
}
function exportBook() {
  if (!activeBook.value) return
  const blob = new Blob([JSON.stringify({ name: activeBook.value.name, words: activeBook.value.words }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${activeBook.value.name}.json`; link.click(); URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" @click.prevent="changePage('study')"><span class="brand-mark">句</span><span>句间<span class="brand-dot">.</span><small>WORD BY WORD</small></span></a>
      <nav class="main-nav"><button v-for="item in navItems" :key="item.id" :class="{ active: page === item.id }" @click="changePage(item.id)">{{ item.label }}<i v-if="page === item.id"></i></button></nav>
      <div class="top-actions"><select v-if="page === 'study'" class="book-select" :value="activeBookId" @change="switchBook"><option v-for="book in books" :key="book.id" :value="book.id">{{ book.name }}</option></select><button class="theme-toggle" :aria-label="dark ? '切换浅色模式' : '切换深色模式'" @click="dark = !dark">{{ dark ? '☼' : '◐' }}</button><span class="avatar">H</span></div>
    </header>

    <main class="main-content">
      <section v-if="page === 'study'" class="study-layout">
        <div class="welcome-row"><div><p class="eyebrow">{{ activeBook?.tag || '每日练习' }} · DAILY PRACTICE</p><h1>让单词，<em>在句子里</em>记住。</h1><p class="subheading">每次记忆，都从一个真实语境开始。</p></div><div class="date-chip"><span class="sun-icon">☀</span><span>{{ new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }) }}</span></div></div>
        <div class="workspace">
          <section class="practice-panel">
            <div v-if="word" class="word-card">
              <div class="card-meta"><span class="tag-pill">{{ word.tag }}</span><span class="card-count">{{ String(index + 1).padStart(2, '0') }} <b>/</b> {{ String(orderedWords.length).padStart(2, '0') }}</span></div>
              <p class="prompt-label">{{ cardStage === 'sentence' ? '读一读这个句子，想想目标单词的意思' : '释义与翻译' }}</p>
              <p class="sentence">{{ word.sentence }}</p>
              <template v-if="cardStage === 'sentence'"><div class="choice-row"><button class="choice-button secondary" @click="chooseFamiliarity">不认识</button><button class="choice-button primary" @click="chooseFamiliarity">认识 <span>→</span></button></div></template>
              <template v-else><div class="meaning-panel"><div class="meaning-word"><strong>{{ word.word }}</strong><span>{{ word.phonetic }}</span><button class="sound-button" @click="speak(word.word)">🔊</button></div><p>{{ word.meaning }}</p><p class="translation">{{ word.sentenceCn }}</p></div><div class="choice-row"><button class="choice-button secondary" @click="rateRecall(false)">记错了</button><button class="choice-button primary" @click="rateRecall(true)">记对了 <span>→</span></button></div></template>              <div class="card-footer"><button class="text-action" :class="{ favorited: memories[word.word]?.favorite }" @click="toggleFavorite()">{{ memories[word.word]?.favorite ? '♥ 已收藏' : '♡ 收藏单词' }}</button><button class="text-action" @click="speak(word.sentence)">◖ 朗读例句</button><span class="level-label">{{ ['陌生', '复习中', '已掌握'][memories[word.word]?.level || 0] }}</span></div>
            </div>
            <div v-else class="empty-state">{{ activeBook?.words.length ? '今天的到期单词已经复习完了，新的复习到期后会自动加入。' : '这本词书还没有单词，去词书管理导入吧。' }}</div>
            <div class="pager"><button @click="step(-1)">← <span>上一个</span></button><span>慢慢来，记得更牢</span><button @click="step(1)"><span>下一个</span> →</button></div>
          </section>
          <aside class="side-column"><section class="progress-card"><div class="side-heading"><span>本书掌握度</span><span class="sparkle">✳</span></div><strong class="progress-number">{{ mastery }}<small>%</small></strong><p>已掌握 {{ masteredCount }} / {{ activeBook?.words.length || 0 }} 个单词</p><div class="progress-track"><i :style="{ width: `${mastery}%` }"></i></div><div class="level-legend"><span><i class="dot unfamiliar"></i>陌生 {{ activeBook?.words.filter(item => !memories[item.word]?.level).length || 0 }}</span><span><i class="dot review"></i>复习中 {{ activeBook?.words.filter(item => memories[item.word]?.level === 1).length || 0 }}</span></div><p class="interval-note">答对后间隔：1 · 2 · 4 · 7 · 15 · 30 天</p></section><section class="tip-card"><span class="tip-icon">✦</span><p>记忆小贴士</p><strong>在语境中遇见，<br/>比孤立记忆更长久。</strong><span class="tip-caption">记错的单词会排到本组末尾重测。</span><div class="tip-decoration">a</div></section><div class="streak-card"><span>今日已学习</span><strong>{{ todayCount }} <small>个</small></strong><span class="streak-icon">✳</span></div></aside>
        </div>
      </section>

      <section v-else-if="page === 'books'" class="management-page"><p class="eyebrow">YOUR LIBRARY · 词汇收藏夹</p><h1>词书管理</h1><button class="back-link" @click="changePage('study')">← 返回首页背诵</button><p class="subheading">切换正在学习的词书，或导入自己的单词。</p><div class="manage-toolbar"><label class="upload-button">＋ 导入 JSON 词书<input type="file" accept=".json,application/json" @change="importBook"/></label><button class="outline-button" @click="exportBook">导出当前词书 ↗</button></div><div class="book-grid"><article v-for="book in books" :key="book.id" class="book-card" :class="{ current: activeBookId === book.id }"><span class="book-icon">▤</span><span class="book-tag">{{ book.tag }}</span><h2>{{ book.name }}</h2><p>{{ book.words.length }} 个单词 · {{ book.id.startsWith('custom-') ? '自定义词书' : '内置词书' }}</p><button @click="activeBookId = book.id; page = 'study'">{{ activeBookId === book.id ? '正在学习 ✓' : '开始学习 →' }}</button></article></div><div class="format-note"><strong>导入格式</strong><p>支持单词数组，或包含 <code>name</code> 和 <code>words</code> 的对象。每个单词需提供 word、phonetic、meaning、sentence、sentenceCn、tag 六个字符串字段。</p></div></section>

      <section v-else class="list-page"><p class="eyebrow">YOUR WORDS · {{ page === 'mistakes' ? '再看一遍' : '留在身边' }}</p><h1>{{ page === 'mistakes' ? '错题本' : '我的收藏' }}</h1><button class="back-link" @click="changePage('study')">← 返回首页背诵</button><p class="subheading">{{ page === 'mistakes' ? '答错的单词会在这里，下一次我们会记得更牢。' : '把想反复回味的单词，收进这里。' }}</p><div v-if="visibleList.length" class="saved-word-list"><article v-for="item in visibleList" :key="item.word" class="saved-word"><div><strong>{{ item.word }}</strong><span>{{ item.phonetic }}</span><p>{{ item.meaning }}</p><small>{{ item.sentence }}</small></div><button class="sound-button" @click="speak(item.word)">🔊</button><button class="remove-favorite" @click="page === 'favorites' ? toggleFavorite(item) : null">{{ page === 'favorites' ? '♥' : `错 ${memories[item.word]?.wrong || 0} 次` }}</button></article></div><div v-else class="empty-list"><span>✳</span><strong>{{ page === 'mistakes' ? '暂时没有错题' : '还没有收藏单词' }}</strong><p>回到首页开始练习，喜欢的单词可以随时收藏。</p><button @click="changePage('study')">开始背诵 →</button></div></section>
    </main>
    <footer class="bottom-bar"><span>句间 <i>·</i> 在句子里，记住每个词。</span><div><span>累计 {{ totalWords }} 个单词</span><b>·</b><span>今日 {{ todayCount }} 个</span></div><span class="footer-right">进步一点点，就很好 <i>✳</i></span></footer>
    <Transition name="toast"><div v-if="notice" class="toast">{{ notice }}</div></Transition>
  </div>
</template>
