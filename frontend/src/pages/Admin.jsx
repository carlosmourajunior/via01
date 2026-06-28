import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const ACOES_LEADS = [
  { id: 'ouro_fino',  label: 'Ouro Fino' },
  { id: 'borda_mata', label: 'Clientes Borda' },
]

const ACOES_VENDAS = [
  { id: 'borda_mata',    label: 'Clientes Borda' },
  { id: 'ouro_fino',     label: 'Ouro Fino' },
  { id: 'inconfidentes', label: 'Inconfidentes' },
]

export default function Admin() {
  const [status,     setStatus]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [resultado,  setResultado]  = useState(null)
  const [executando, setExecutando] = useState(null)
  const [sheets,     setSheets]     = useState(null)
  const [arquivo,    setArquivo]    = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const fileRef = useRef()

  const carregarStatus = () => {
    setLoading(true)
    Promise.all([
      axios.get('/api/admin/status'),
      axios.get('/api/admin/arquivo'),
    ]).then(([s, a]) => {
      setStatus(s.data)
      setArquivo(a.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { carregarStatus() }, [])

  const executar = async (id, label, fn) => {
    if (!window.confirm(`Confirmar: ${label}?`)) return
    setExecutando(id)
    setResultado(null)
    try {
      const res = await fn()
      setResultado({ ok: true, msg: res.data.message })
      carregarStatus()
    } catch (err) {
      setResultado({ ok: false, msg: err.response?.data?.detail || err.message })
    }
    setExecutando(null)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setResultado(null)
    setSheets(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      await axios.post('/api/upload', fd)
      setResultado({ ok: true, msg: `Arquivo "${file.name}" enviado e sincronizado com sucesso.` })
      carregarStatus()
    } catch (err) {
      setResultado({ ok: false, msg: err.response?.data?.detail || err.message })
    }
    fileRef.current.value = ''
    setUploading(false)
  }

  const verSheets = async () => {
    setSheets(null)
    setResultado(null)
    try {
      const res = await axios.get('/api/admin/debug-sheets')
      setSheets(res.data)
    } catch (err) {
      setResultado({ ok: false, msg: err.response?.data?.detail || err.message })
    }
  }

  const btn = (id, label, fn, variant = 'danger') => (
    <button
      key={id}
      className={`admin-btn admin-btn--${variant}`}
      disabled={executando !== null}
      onClick={() => executar(id, label, fn)}
    >
      {executando === id ? 'Executando...' : label}
    </button>
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1>Administração</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-sync" style={{ background: '#6c757d' }} onClick={verSheets}>
            🔍 Diagnóstico de abas
          </button>
          <button className="btn-sync" onClick={carregarStatus}>↻ Atualizar</button>
        </div>
      </div>

      {/* ── Arquivo no servidor ── */}
      <div className={`card admin-section ${!arquivo?.arquivo ? 'admin-section--alert' : ''}`}>
        <h2 className="admin-section-title">Arquivo Excel</h2>
        {arquivo?.arquivo ? (
          <div className="admin-arquivo-info">
            <span className="admin-arquivo-nome">📄 {arquivo.arquivo}</span>
            <span className="admin-arquivo-meta">{arquivo.tamanho_kb} KB · enviado em {arquivo.modificado}</span>
          </div>
        ) : (
          <div className="alert-error" style={{ marginBottom: '1rem' }}>
            Nenhum arquivo no servidor. Envie o Excel para habilitar sincronização.
          </div>
        )}
        <label className="btn-upload" style={{ display: 'inline-block', cursor: 'pointer' }}>
          {uploading ? 'Enviando...' : arquivo?.arquivo ? '↑ Substituir arquivo' : '↑ Enviar arquivo Excel'}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" onChange={handleUpload} hidden />
        </label>
        <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#888' }}>
          Ao enviar, todas as cidades de leads e vendas são sincronizadas automaticamente.
        </p>
      </div>

      {resultado && (
        <div className={resultado.ok ? 'alert-success' : 'alert-error'}>
          {resultado.msg}
        </div>
      )}

      {/* ── Diagnóstico de abas ── */}
      {sheets && (
        <div className="card" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>
            Arquivo: <span style={{ color: '#4a90d9' }}>{sheets.arquivo}</span>
          </div>
          <div style={{ marginBottom: '0.8rem' }}>
            <strong>Abas no arquivo:</strong>{' '}
            {sheets.abas_no_arquivo.map(a => (
              <span key={a} style={{ display: 'inline-block', margin: '0 0.3rem 0.3rem 0', padding: '0.2rem 0.6rem', background: '#f0f2f5', borderRadius: '6px', fontSize: '0.78rem' }}>{a}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <strong>Leads:</strong>
              {Object.entries(sheets.leads).map(([orig, info]) => (
                <div key={orig} style={{ marginTop: '0.4rem', padding: '0.5rem', background: info.erro ? '#fdf0ef' : '#eafaf1', borderRadius: '6px' }}>
                  <strong>{orig}</strong> → <code>{info.sheet}</code><br />
                  {info.erro
                    ? <span style={{ color: '#e74c3c' }}>❌ {info.erro}</span>
                    : <span style={{ color: '#27ae60' }}>✓ {info.colunas?.join(', ')}</span>}
                </div>
              ))}
            </div>
            <div>
              <strong>Vendas:</strong>
              {Object.entries(sheets.vendas).map(([orig, info]) => (
                <div key={orig} style={{ marginTop: '0.4rem', padding: '0.5rem', background: info.erro ? '#fdf0ef' : '#eafaf1', borderRadius: '6px' }}>
                  <strong>{orig}</strong> → <code>{info.sheet}</code><br />
                  {info.erro
                    ? <span style={{ color: '#e74c3c' }}>❌ {info.erro}</span>
                    : <span style={{ color: '#27ae60' }}>✓ {info.colunas?.join(', ')}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Leads ── */}
      <div className="card admin-section">
        <h2 className="admin-section-title">Leads</h2>

        {!loading && status && (
          <div className="admin-counts">
            {Object.entries(status.leads).map(([orig, info]) => (
              <div key={orig} className="admin-count-badge">
                <span className="admin-count-num">{info.total}</span>
                <span className="admin-count-label">{info.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="admin-group">
          <span className="admin-group-label">Limpar registros por cidade:</span>
          <div className="admin-btn-row">
            {ACOES_LEADS.map(c => btn(
              `limpar-leads-${c.id}`,
              `Limpar ${c.label}`,
              () => axios.post(`/api/admin/limpar-leads?origem=${c.id}`),
              'warning'
            ))}
          </div>
        </div>

        <div className="admin-group">
          <span className="admin-group-label">Recriar tabela (apaga tudo e recria do zero):</span>
          <div className="admin-btn-row">
            {btn('recriar-leads', 'Recriar tabela de Leads',
              () => axios.post('/api/admin/recriar-leads'), 'danger')}
          </div>
        </div>
      </div>

      {/* ── Vendas ── */}
      <div className="card admin-section">
        <h2 className="admin-section-title">Vendas</h2>

        {!loading && status && (
          <div className="admin-counts">
            {Object.entries(status.vendas).map(([orig, info]) => (
              <div key={orig} className="admin-count-badge">
                <span className="admin-count-num">{info.total}</span>
                <span className="admin-count-label">{info.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="admin-group">
          <span className="admin-group-label">Limpar registros por cidade:</span>
          <div className="admin-btn-row">
            {ACOES_VENDAS.map(c => btn(
              `limpar-vendas-${c.id}`,
              `Limpar ${c.label}`,
              () => axios.post(`/api/admin/limpar-vendas?origem=${c.id}`),
              'warning'
            ))}
          </div>
        </div>

        <div className="admin-group">
          <span className="admin-group-label">Recriar tabela (apaga tudo e recria do zero):</span>
          <div className="admin-btn-row">
            {btn('recriar-vendas', 'Recriar tabela de Vendas',
              () => axios.post('/api/admin/recriar-vendas'), 'danger')}
          </div>
        </div>

        <div className="admin-group">
          <span className="admin-group-label">Migrações:</span>
          <div className="admin-btn-row">
            {btn('corrigir-origens', 'Corrigir origens (ouro_fino → borda_mata)',
              () => axios.post('/api/admin/corrigir-origens'), 'info')}
          </div>
        </div>
      </div>
    </div>
  )
}
