/**
 * AI 服务与智能 - 聊天界面
 * 支持文章总结、知识库检索、智能对话
 */
import { useEffect, useRef, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { useToast } from '../../components/Toast.jsx'
import { RobotIcon, SparklesIcon, SendIcon, BrainIcon, FileTextIcon, PlusIcon } from '../../icons.jsx'
import ToggleSwitch from '../../components/ToggleSwitch.jsx'

const MODEL_OPTIONS = [
  { id: 'openai', name: 'OpenAI GPT-4', provider: 'openai', required: ['apiKey'] },
  { id: 'azure', name: 'Azure OpenAI', provider: 'azure', required: ['apiKey', 'endpoint', 'deployment'] },
  { id: 'anthropic', name: 'Anthropic Claude', provider: 'anthropic', required: ['apiKey'] },
  { id: 'local', name: '本地 Ollama', provider: 'local', required: ['endpoint'] },
]

const DEFAULT_CONFIG = {
  model: 'openai',
  apiKey: '',
  endpoint: '',
  deployment: '',
  systemPrompt: '你是一个智能博客助手。请帮助用户总结文章内容、回答关于博客的问题。',
}

export default function AIChat({ navigate }) {
  useDocumentMeta({ title: 'AI 服务与智能', siteTitle: '管理后台' })
  const toast = useToast()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // 状态管理
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('ai_config')
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG
  })
  const [isConfigured, setIsConfigured] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'summarize' | 'knowledge'
  const [selectedPostId, setSelectedPostId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // 检查配置状态
  useEffect(() => {
    const hasKey = config.apiKey && config.apiKey.length > 10
    setIsConfigured(hasKey)
  }, [config])

  // 自动滚动到消息底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 获取文章列表
  const posts = DataStore.Posts.getAll({ includeUnpublished: false })

  // 保存配置
  const saveConfig = () => {
    localStorage.setItem('ai_config', JSON.stringify(config))
    toast.success('AI 配置已保存')
  }

  // 测试连接
  const testConnection = async () => {
    if (!config.apiKey) {
      toast.error('请先输入 API Key')
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      })
      if (response.ok) {
        toast.success('连接成功！')
        setIsConfigured(true)
      } else {
        toast.error('连接失败，请检查 API Key')
      }
    } catch (err) {
      toast.error('网络错误: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 发送消息
  const sendMessage = async () => {
    if (!inputText.trim() || !isConfigured) return

    const userMessage = { role: 'user', content: inputText, timestamp: Date.now() }
    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsLoading(true)

    try {
      const allPosts = DataStore.Posts.getAll({ includeUnpublished: false })
      const context = allPosts.map(p => `## ${p.title}\n${p.content.substring(0, 500)}...`).join('\n\n')

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model === 'openai' ? 'gpt-4o-mini' : 'gpt-4',
          messages: [
            { role: 'system', content: `${config.systemPrompt}\n\n以下是博客内容上下文：\n${context}` },
            userMessage
          ],
          max_tokens: 1000
        })
      })

      if (!response.ok) throw new Error('请求失败')

      const data = await response.json()
      const assistantMessage = {
        role: 'assistant',
        content: data.choices[0].message.content,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      toast.error('AI 回复失败: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 生成文章总结
  const summarizePost = async (postId) => {
    const post = DataStore.Posts.getById(postId)
    if (!post || !isConfigured) return

    setIsLoading(true)
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: '请生成这篇文章的摘要，200字以内，突出核心观点。' },
            { role: 'user', content: post.content }
          ]
        })
      })
      const data = await response.json()
      toast.success('总结生成成功')
      setMessages(prev => [...prev,
        { role: 'user', content: `请总结这篇文章: ${post.title}`, timestamp: Date.now() },
        { role: 'assistant', content: data.choices[0].message.content, timestamp: Date.now() }
      ])
    } catch (err) {
      toast.error('总结失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 知识库搜索
  const searchKnowledge = async (query) => {
    if (!query.trim() || !isConfigured) return

    setIsLoading(true)
    try {
      const allPosts = DataStore.Posts.getAll({ includeUnpublished: false })
      const relevantPosts = allPosts.filter(p =>
        p.title.includes(query) || p.content.includes(query) || (p.tags || []).includes(query)
      )

      const context = relevantPosts.length > 0
        ? relevantPosts.map(p => `## ${p.title}\n${p.content.substring(0, 300)}`).join('\n\n')
        : '未找到相关文章'

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: '根据提供的博客内容回答问题。如果内容不足，请说明。' },
            { role: 'user', content: `问题: ${query}\n\n相关内容:\n${context}` }
          ]
        })
      })
      const data = await response.json()
      setMessages(prev => [...prev,
        { role: 'user', content: query, timestamp: Date.now() },
        { role: 'assistant', content: data.choices[0].message.content, timestamp: Date.now() }
      ])
    } catch (err) {
      toast.error('搜索失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2><BrainIcon size={24} className="inline mr-2" /> AI 服务与智能</h2>
          <p className="muted">人工智能驱动的博客助手，支持智能总结、知识库检索</p>
        </div>
      </div>

      {/* 功能开关 */}
      <div className="settings-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="settings-card-title">AI 功能总开关</h3>
            <p className="muted small">开启后将显示 AI 助手入口和相关功能</p>
          </div>
          <ToggleSwitch
            checked={isConfigured}
            onChange={(val) => {
              if (val && !isConfigured) {
                navigate('/admin/ai-config')
              }
            }}
          />
        </div>
      </div>

      {/* 配置入口 */}
      {!isConfigured && (
        <div className="settings-card" style={{ marginBottom: 20, background: 'var(--warn-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 className="settings-card-title"><SparklesIcon size={18} /> 配置 AI 服务</h3>
              <p className="muted small">请先配置 API Key 才能使用 AI 功能</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/admin/ai-config')}>
              <PlusIcon size={16} /> 去配置
            </button>
          </div>
        </div>
      )}

      {/* 主界面 */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, height: 'calc(100vh - 200px)' }}>
        {/* 左侧边栏 */}
        <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className={`btn ${activeTab === 'chat' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', gap: 10 }}
            onClick={() => setActiveTab('chat')}
          >
            <MessageIcon size={18} /> 智能对话
          </button>
          <button
            className={`btn ${activeTab === 'summarize' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', gap: 10 }}
            onClick={() => setActiveTab('summarize')}
          >
            <FileTextIcon size={18} /> 文章总结
          </button>
          <button
            className={`btn ${activeTab === 'knowledge' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', gap: 10 }}
            onClick={() => setActiveTab('knowledge')}
          >
            <BrainIcon size={18} /> 知识库检索
          </button>

          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <p className="muted small" style={{ marginBottom: 8 }}>已加载文章</p>
            <p className="muted" style={{ fontSize: 24, fontWeight: 700 }}>{posts.length}</p>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.length === 0 && (
                  <div className="empty-state">
                    <RobotIcon size={48} style={{ opacity: 0.3 }} />
                    <p>开始与 AI 对话，询问关于您博客的任何问题</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && <RobotIcon size={32} style={{ opacity: 0.6, flexShrink: 0 }} />}
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '12px 16px',
                        borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.role === 'user' ? 'var(--primary)' : 'var(--surface)',
                        color: msg.role === 'user' ? '#fff' : 'var(--text)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
                    <RobotIcon size={32} style={{ opacity: 0.6 }} />
                    <div style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: '18px' }}>
                      <span className="muted">思考中...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                <input
                  ref={inputRef}
                  className="input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="输入您的问题..."
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={sendMessage} disabled={!inputText.trim() || isLoading}>
                  <SendIcon size={18} />
                </button>
              </div>
            </>
          )}

          {activeTab === 'summarize' && (
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <h3 style={{ marginBottom: 16 }}>选择文章生成总结</h3>
              {posts.length === 0 ? (
                <p className="muted">暂无文章可总结</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {posts.map(post => (
                    <div key={post.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{post.title}</div>
                        <div className="muted small">{post.createdAt && new Date(post.createdAt).toLocaleDateString()}</div>
                      </div>
                      <button className="btn btn-sm btn-primary" onClick={() => summarizePost(post.id)}>
                        <SparklesIcon size={14} /> 生成总结
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ marginBottom: 16 }}>知识库检索</h3>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="输入关键词搜索..."
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={() => searchKnowledge(searchQuery)}>
                  <SearchIcon size={18} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)', borderRadius: 8, padding: 16 }}>
                {messages.filter(m => m.role === 'assistant').length === 0 ? (
                  <p className="muted">输入关键词开始检索知识库</p>
                ) : (
                  messages.filter(m => m.role === 'assistant').map((msg, i) => (
                    <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                      <div className="muted small" style={{ marginBottom: 4 }}>AI 回答</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 需要补充的图标 import
import { MessageIcon, SearchIcon, SendIcon } from '../../icons.jsx'
