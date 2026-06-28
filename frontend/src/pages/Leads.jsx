import { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const ROTULOS = {
  dia: 'Data', nome: 'Nome', telefone: 'Telefone',
  cidade: 'Cidade', bairro: 'Bairro',
  'FACEBOOK/INSTAGRAM': 'Canal', resultado: 'Resultado',
  importado_em: 'Importado em',
}

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const CIDADES = [
  { id: 'ouro_fino',  label: 'Ouro Fino' },
  { id: 'borda_mata', label: 'Clientes Borda' },
]

export default function Leads() {
  const hoje = new Date()

  const [dados,    setDados]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState(null)
  const [syncing,  setSyncing]  = useState(false)
  const [syncInfo, setSyncInfo] = useState(null)
  const [filtros,  setFiltros]  = useState({})
  const fileRef = useRef()

  const [cidade,     setCidade]     = useState('ouro_fino')
  const [mesFiltro,  setMesFiltro]  = useState(hoje.getMonth())
  const [anoFiltro,  setAnoFiltro]  = useState(hoje.getFullYear())
  const [anoGrafico, setAnoGrafico] = useState(hoje.getFullYear())

  const carregarDados = (orig = cidade) => {
    setLoading(true)
    setErro(null)
    axios.get(`/api/dados?origem=${orig}`)
      .then(res => { setDados(res.data); setLoading(false) })
      .catch(err => { setErro(err.response?.data?.detail || err.message); setLoading(false) })
  }

  const handleCidadeChange = (nova) => {
    setCidade(nova)
    setFiltros({})
    carregarDados(nova)
  }

  useEffect(() => { carregarDados() }, [])

  const handleSync = async () => {
    setSyncing(true); setErro(null)
    try {
      const res = await axios.post(`/api/sync?origem=${cidade}`)
      setSyncInfo(res.data); carregarDados()
    } catch (err) {
      setErro('Erro na sincronizacao: ' + (err.response?.data?.detail || err.message))
    }
    setSyncing(false)
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files[0]
    if (!file) return
    setSyncing(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await axios.post('/api/upload', fd)
      fileRef.current.value = ''; setSyncInfo(res.data); carregarDados()
    } catch (err) {
      setErro('Erro no upload: ' + (err.response?.data?.detail || err.message))
    }
    setSyncing(false)
  }

  const parseData = (s) => {
    if (!s) return null
    // Garante que datas YYYY-MM-DD não sejam interpretadas como UTC
    const iso = s.length === 10 ? s + 'T00:00:00' : s
    const d = new Date(iso)
    return isNaN(d) ? null : d
  }

  // Anos disponíveis nos dados
  const anosDisponiveis = useMemo(() => {
    if (!dados) return [hoje.getFullYear()]
    const anos = new Set()
    dados.registros.forEach(r => {
      const d = parseData(r.dia)
      if (d) anos.add(d.getFullYear())
    })
    return [...anos].sort((a, b) => b - a)
  }, [dados])

  // Leads do mês/ano selecionado
  const leadsDoMes = useMemo(() => {
    if (!dados) return []
    return dados.registros.filter(r => {
      const d = parseData(r.dia)
      return d && d.getFullYear() === anoFiltro && d.getMonth() === mesFiltro
    })
  }, [dados, mesFiltro, anoFiltro])

  // Leads por mês do ano selecionado (gráfico)
  const dadosPorMesDoAno = useMemo(() => {
    if (!dados) return []
    const contagem = Array(12).fill(0)
    dados.registros.forEach(r => {
      const d = parseData(r.dia)
      if (!d || d.getFullYear() !== anoGrafico) return
      contagem[d.getMonth()]++
    })
    return MESES_ABREV.map((nome, i) => ({ nome, total: contagem[i] }))
  }, [dados, anoGrafico])

  // Leads por canal do mês selecionado
  const dadosPorCanal = useMemo(() => {
    const contagem = {}
    leadsDoMes.forEach(r => {
      const canal = r['FACEBOOK/INSTAGRAM'] || 'Não informado'
      contagem[canal] = (contagem[canal] || 0) + 1
    })
    return Object.entries(contagem)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, total]) => ({ nome, total }))
  }, [leadsDoMes])

  // Tabela filtrada pelo mês + filtros de coluna
  const registrosFiltrados = useMemo(() => {
    if (!dados) return []
    return leadsDoMes.filter(row =>
      dados.colunas.every(col => {
        const f = (filtros[col] || '').trim().toLowerCase()
        return !f || String(row[col] ?? '').toLowerCase().includes(f)
      })
    )
  }, [leadsDoMes, dados, filtros])

  const temFiltro = Object.values(filtros).some(v => (v || '').trim() !== '')

  if (loading) return <div className="loading">Carregando leads...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Leads — {CIDADES.find(c => c.id === cidade)?.label}</h1>
        <div className="page-actions">
          <button className="btn-sync" onClick={handleSync} disabled={syncing}>
            {syncing ? '⟳ Sincronizando...' : '⟳ Sincronizar OneDrive'}
          </button>
          <label className="btn-upload">
            Importar Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" onChange={handleUpload} hidden />
          </label>
        </div>
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {syncInfo && (
        <div className="alert-success">
          Sincronizacao concluida — {syncInfo.lidos} lidos, <strong>{syncInfo.inseridos} novos inseridos</strong>
        </div>
      )}

      {(!dados || dados.total === 0) ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          Nenhum dado. Clique em <strong>Sincronizar OneDrive</strong> para importar.
        </div>
      ) : (
        <>
          {/* Seletor de cidade */}
          <div className="cidade-tabs">
            {CIDADES.map(c => (
              <button
                key={c.id}
                className={'cidade-tab' + (cidade === c.id ? ' active' : '')}
                onClick={() => handleCidadeChange(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Seletor de mês */}
          <div className="card mes-selector-card">
            <span className="mes-selector-label">Analisar mês:</span>
            <select
              className="select-periodo"
              value={mesFiltro}
              onChange={e => setMesFiltro(Number(e.target.value))}
            >
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              className="select-periodo"
              value={anoFiltro}
              onChange={e => setAnoFiltro(Number(e.target.value))}
            >
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* KPIs */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-value">{dados.total}</div>
              <div className="kpi-label">Total de Leads</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#4a90d9' }}>{leadsDoMes.length}</div>
              <div className="kpi-label">Leads — {MESES_ABREV[mesFiltro]}/{anoFiltro}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{dadosPorCanal.length}</div>
              <div className="kpi-label">Canais no mês</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{registrosFiltrados.length}</div>
              <div className="kpi-label">{temFiltro ? 'Filtrados' : 'Exibindo'}</div>
            </div>
          </div>

          <div className="charts-row">
            <div className="card chart-card">
              <div className="chart-card-header">
                <h2>Leads por mês</h2>
                <select
                  className="select-periodo select-periodo--sm"
                  value={anoGrafico}
                  onChange={e => setAnoGrafico(Number(e.target.value))}
                >
                  {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dadosPorMesDoAno} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#4a90d9" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <h2>Leads por canal — {MESES_ABREV[mesFiltro]}/{anoFiltro}</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={dadosPorCanal}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#27ae60" radius={[0, 4, 4, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="table-header">
              <h2>Registros — {MESES[mesFiltro]}/{anoFiltro} ({registrosFiltrados.length})</h2>
              {temFiltro && (
                <button className="btn-limpar" onClick={() => setFiltros({})}>
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    {dados.colunas.map(col => (
                      <th key={col}>
                        <div className="th-inner">
                          <span>{ROTULOS[col] || col}</span>
                          <input
                            className="filtro-input"
                            type="text"
                            placeholder="Filtrar..."
                            value={filtros[col] || ''}
                            onChange={e => setFiltros(p => ({ ...p, [col]: e.target.value }))}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.length === 0 ? (
                    <tr><td colSpan={dados.colunas.length} className="sem-resultado">Nenhum resultado.</td></tr>
                  ) : registrosFiltrados.map((row, i) => (
                    <tr key={i}>
                      {dados.colunas.map(col => <td key={col}>{row[col] ?? ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
