/**
 * AI 服务配置页面
 */
import { useState, useEffect } from 'react'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { useToast } from '../../components/Toast.jsx'
import { CheckIcon, TrashIcon, SaveIcon } from '../../icons.jsx'

const MODEL_OPTIONS = [
  { id: 'openai', name: 'OpenAI GPT-4o', provider: 'openai', required: ['apiKey'] },
  { id: 'anthropic', name: 'Anthropic Claude 3', provider: 'anthropic', required: ['apiKey'] },
  { id: 'local', name: '本地 Ollama', provider: 'local', required: ['endpoint'] },
]

export default function AIConfig({ navigate }) {
  useDocumentMeta({ title: 'AI 配置', siteTitle: '管理后台' })
  const toast = useToast()
  const [config, setConfig] = useState({
    model: 'openai',
    apiKey: '',
    endpoint: '',
    systemPrompt: '你是一个智能博客助手，请帮助用户总结文章内容、回答关于博客的问题。',
  })

  useEffect(() => {
    const saved = localStorage.getItem('ai_config')
    if (saved) setConfig(JSON.parse(saved))
  }, [])

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  const saveConfig = () => {
    localStorage.setItem('ai_config', JSON.stringify(config))
    toast.success('配置已保存')
  }

  const testConnection = async () => {
    if (!config.apiKey) {
      toast.error('请先输入 API Key')
      return
    }
    toast.info('正在测试连接...')
    // 实际测试逻辑待实现
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>AI 服务配置</h2>
          <p className="muted">配置大模型 API 以启用智能功能</p>
        </div>
      </div>

      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3 className="settings-card-title">模型选择</h3>
        <select className="input" value={config.model} onChange={(e) => update('model', e.target.value)} style={{ width: '100%', maxWidth: 300 }}>
          {MODEL_OPTIONS.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3 className="settings-card-title">API 密钥</h3>
        <input className="input" type="password" value={config.apiKey} onChange={(e) => update('apiKey', e.target.value)} placeholder="sk-..." style={{ width: '100%', maxWidth: 400 }} />
      </div>

      <div className="settings-card" style={{ marginBottom: 16 }}>
        <h3 className="settings-card-title">系统提示词</h3>
        <textarea className="input" rows={4} value={config.systemPrompt} onChange={(e) => update('systemPrompt', e.target.value)} style={{ width: '100%', maxWidth: 600 }} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" onClick={saveConfig}><SaveIcon size={16} /> 保存配置</button>
        <button className="btn" onClick={testConnection}>测试连接</button>
        <button className="btn" onClick={() => navigate('/admin/ai')}>进入 AI 助手</button>
      </div>
    </div>
  )
}
