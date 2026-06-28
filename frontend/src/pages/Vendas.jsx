import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const ROTULOS = {
  data: 'Data', nome: 'Nome', instalacao: 'Instalado',
  mes: 'Mês', dia_semana: 'Dia', vendedor: 'Vendedor',
  importado_em: 'Importado em',
}

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CORES       = ['#27ae60', '#e74c3c', '#3498db', '#f39c12', '#9b59b6']

const CIDADES = [
  { id: 'borda_mata',    label: 'Clientes Borda' },
  { id: 'ouro_fino',     label: 'Ouro Fino' },
  { id: 'inconfidentes', label: 'Inconfidentes' },
]

export default function Vendas() {
  const hoje = new Date()

  const [dados,       setDados]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [erro,        setErro]        = useState(null)
  const [syncing,     setSyncing]     = useState(false)
  const [syncInfo,    setSyncInfo]    = useState(null)
  const [syncInfoCanc, setSyncInfoCanc] = useState(null)
  const [filtros,     setFiltros]     = useState({})

  const [dadosCanc, setDadosCanc] = useState(null)

  const [cidade,     setCidade]     = useState('borda_mata')
  const [mesFiltro,  setMesFiltro]  = useState(hoje.getMonth())
  const [anoFiltro,  setAnoFiltro]  = useState(hoje.getFullYear())
  const [anoGrafico, setAnoGrafico] = useState(hoje.getFullYear())

  const carregarDados = (orig = cidade) => {
    setLoading(true)
    setErro(null)
    axios.get(`/api/vendas?origem=${orig}`)
      .then(res => { setDados(res.data); setLoading(false) })
      .catch(err => { setErro(err.response?.data?.detail || err.message); setLoading(false) })
  }

  const carregarCancelamentos = (orig = cidade) => {
    axios.get(`/api/cancelamentos?origem=${orig}`)
      .then(res => setDadosCanc(res.data))
      .catch(() => {})
  }

  const handleCidadeChange = (nova) => {
    setCidade(nova)
    setFiltros({})
    carregarDados(nova)
    carregarCancelamentos(nova)
  }

  useEffect(() => { carregarDados(); carregarCancelamentos() }, [])

  const handleSync = async () => {
    setSyncing(true)
    setErro(null)
    try {
      const res = await axios.post(`/api/sync-vendas?origem=${cidade}`)
      setSyncInfo(res.data)
      // Sincroniza cancelamentos das 3 cidades de uma vez
      const resC = await Promise.all(
        ['borda_mata', 'ouro_fino', 'inconfidentes'].map(o =>
          axios.post(`/api/sync-cancelamentos?origem=${o}`)
        )
      )
      setSyncInfoCanc(resC.map(r => r.data))
      carregarDados()
      carregarCancelamentos()
    } catch (err) {
      setErro('Erro na sincronizacao: ' + (err.response?.data?.detail || err.message))
    }
    setSyncing(false)
  }

  // Anos disponíveis nos dados
  const anosDisponiveis = useMemo(() => {
    if (!dados) return [hoje.getFullYear()]
    const anos = new Set()
    dados.registros.forEach(r => {
      if (!r.data) return
      const ano = new Date(r.data + 'T00:00:00').getFullYear()
      if (!isNaN(ano)) anos.add(ano)
    })
    return [...anos].sort((a, b) => b - a)
  }, [dados])

  // Registros do mês/ano selecionado
  const vendasDoMes = useMemo(() => {
    if (!dados) return []
    return dados.registros.filter(r => {
      if (!r.data) return false
      const d = new Date(r.data + 'T00:00:00')
      return d.getFullYear() === anoFiltro && d.getMonth() === mesFiltro
    })
  }, [dados, mesFiltro, anoFiltro])

  // Registros dos últimos 7 dias
  const vendasUltimaSemana = useMemo(() => {
    if (!dados) return []
    const limite = new Date()
    limite.setDate(limite.getDate() - 7)
    limite.setHours(0, 0, 0, 0)
    return dados.registros.filter(r => {
      if (!r.data) return false
      return new Date(r.data + 'T00:00:00') >= limite
    })
  }, [dados])

  // Vendas por mês do ano selecionado para o gráfico (todos os 12 meses)
  const dadosPorMesDoAno = useMemo(() => {
    if (!dados) return []
    const contagem = Array(12).fill(0)
    dados.registros.forEach(r => {
      if (!r.data) return
      const d = new Date(r.data + 'T00:00:00')
      if (isNaN(d) || d.getFullYear() !== anoGrafico) return
      contagem[d.getMonth()]++
    })
    return MESES_ABREV.map((nome, i) => ({ nome, total: contagem[i] }))
  }, [dados, anoGrafico])

  // Status de instalação do mês selecionado (todos os valores distintos)
  const statusInstalacaoMes = useMemo(() => {
    const contagem = {}
    vendasDoMes.forEach(r => {
      const s = (r.instalacao || '').trim() || 'Não informado'
      contagem[s] = (contagem[s] || 0) + 1
    })
    return Object.entries(contagem)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, value]) => ({ nome, value }))
  }, [vendasDoMes])

  // Top vendedores do mês selecionado
  const dadosPorVendedor = useMemo(() => {
    const contagem = {}
    vendasDoMes.forEach(r => {
      const v = (r.vendedor || 'Não informado').trim()
      contagem[v] = (contagem[v] || 0) + 1
    })
    return Object.entries(contagem)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([nome, total]) => ({ nome, total }))
  }, [vendasDoMes])

  const registrosFiltrados = useMemo(() => {
    if (!dados) return []
    return vendasDoMes.filter(row =>
      dados.colunas.every(col => {
        const f = (filtros[col] || '').trim().toLowerCase()
        return !f || String(row[col] ?? '').toLowerCase().includes(f)
      })
    )
  }, [vendasDoMes, dados, filtros])

  // Gráfico: cancelamentos por mês (só para cidades que têm campo mes)
  const cancPorMes = useMemo(() => {
    if (!dadosCanc) return []
    const temMes = dadosCanc.registros.some(r => r.mes)
    if (!temMes) return []
    const NOMES_MES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const contagem = {}
    dadosCanc.registros.forEach(r => {
      const m = parseInt(r.mes, 10)
      if (!m) return
      contagem[m] = (contagem[m] || 0) + 1
    })
    return Object.keys(contagem)
      .map(m => ({ nome: NOMES_MES[Number(m)] || m, mes: Number(m), total: contagem[m] }))
      .sort((a, b) => a.mes - b.mes)
  }, [dadosCanc])

  // Colunas visíveis da tabela de cancelamentos
  const cancColsVisiveis = useMemo(() => {
    if (!dadosCanc) return []
    const base = [
      { chave: 'nome',   label: dadosCanc.headers?.[0] || 'Cliente' },
      { chave: 'motivo', label: dadosCanc.headers?.[1] || 'Motivo' },
    ]
    if (dadosCanc.headers?.[2]) base.push({ chave: 'col_c', label: dadosCanc.headers[2] })
    if (cancPorMes.length === 0 && dadosCanc.registros.some(r => r.mes))
      base.push({ chave: 'mes', label: 'Mês' })
    return base
  }, [dadosCanc, cancPorMes])

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este registro?')) return
    try {
      await axios.delete(`/api/vendas/${id}`)
      setDados(prev => ({
        ...prev,
        registros: prev.registros.filter(r => r.id !== id),
        total: prev.total - 1,
      }))
    } catch (err) {
      setErro('Erro ao remover: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleDeleteCanc = async (id) => {
    if (!window.confirm('Remover este cancelamento?')) return
    try {
      await axios.delete(`/api/cancelamentos/${id}`)
      setDadosCanc(prev => ({
        ...prev,
        registros: prev.registros.filter(r => r.id !== id),
        total: prev.total - 1,
      }))
    } catch (err) {
      setErro('Erro ao remover: ' + (err.response?.data?.detail || err.message))
    }
  }

  const temFiltro = Object.values(filtros).some(v => (v || '').trim() !== '')
  const instDoMes = vendasDoMes.filter(r => {
    const v = (r.instalacao || '').trim().toLowerCase()
    return (v.includes('instal') && !v.includes('não instal') && !v.includes('nao instal')) || v === 'sim'
  }).length
  const pendDoMes = vendasDoMes.length - instDoMes

  if (loading) return <div className="loading">Carregando vendas...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Vendas — {CIDADES.find(c => c.id === cidade)?.label}</h1>
        <div className="page-actions">
          <button className="btn-sync" onClick={handleSync} disabled={syncing}>
            {syncing ? '⟳ Sincronizando...' : '⟳ Sincronizar'}
          </button>
        </div>
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {syncInfo && (
        <div className="alert-success">
          Vendas: {syncInfo.lidos} lidas, <strong>{syncInfo.inseridos} novas inseridas</strong>
          {syncInfoCanc && (
            <> &nbsp;|&nbsp; Cancelamentos: <strong>{syncInfoCanc.reduce((s, r) => s + (r.inseridos || 0), 0)} novos inseridos</strong></>
          )}
        </div>
      )}

      {(!dados || dados.total === 0) ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          Nenhuma venda. Clique em <strong>Sincronizar</strong> para importar.
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

          {/* Seletor de mês para análise */}
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
              <div className="kpi-value">{vendasDoMes.length}</div>
              <div className="kpi-label">Vendas — {MESES_ABREV[mesFiltro]}/{anoFiltro}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#27ae60' }}>{instDoMes}</div>
              <div className="kpi-label">Instalados no mês</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#e74c3c' }}>{pendDoMes}</div>
              <div className="kpi-label">Pendentes no mês</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#3498db' }}>{vendasUltimaSemana.length}</div>
              <div className="kpi-label">Últimos 7 dias</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#c0392b' }}>{dadosCanc?.total ?? '—'}</div>
              <div className="kpi-label">Total Cancelamentos</div>
            </div>
          </div>

          {/* Gráfico por mês + Pizza instalação */}
          <div className="charts-row">
            <div className="card chart-card">
              <div className="chart-card-header">
                <h2>Vendas por mês</h2>
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
                  <Bar dataKey="total" name="Vendas" fill="#4a90d9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <h2>Instalação — {MESES_ABREV[mesFiltro]}/{anoFiltro}</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusInstalacaoMes}
                    cx="50%" cy="45%"
                    labelLine={false}
                    label={({ name, value, percent }) =>
                      value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                    }
                    outerRadius={85}
                    dataKey="value"
                  >
                    {statusInstalacaoMes.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>


          {/* Vendedores do mês */}
          {dadosPorVendedor.length > 0 && (
            <div className="card chart-card">
              <h2>Vendedores — {MESES_ABREV[mesFiltro]}/{anoFiltro}</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, dadosPorVendedor.length * 38)}>
                <BarChart
                  data={dadosPorVendedor}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#f39c12" radius={[0, 4, 4, 0]} name="Vendas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela de vendas */}
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
                    <th style={{ width: '2.5rem' }} />
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.length === 0 ? (
                    <tr><td colSpan={dados.colunas.length + 1} className="sem-resultado">Nenhum resultado.</td></tr>
                  ) : registrosFiltrados.map((row, i) => (
                    <tr key={i}>
                      {dados.colunas.map(col => <td key={col}>{row[col] ?? ''}</td>)}
                      <td>
                        <button
                          className="btn-delete-row"
                          title="Remover registro"
                          onClick={() => handleDelete(row.id)}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico cancelamentos por mês (Borda tem dados de mês) */}
          {cancPorMes.length > 0 && (
            <div className="card chart-card">
              <h2>Cancelamentos por mês — {CIDADES.find(c => c.id === cidade)?.label}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cancPorMes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Cancelamentos" fill="#c0392b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela de cancelamentos */}
          {dadosCanc && (
            <div className="card">
              <div className="table-header">
                <h2 style={{ color: '#c0392b' }}>
                  Cancelamentos — {CIDADES.find(c => c.id === cidade)?.label} ({dadosCanc.total})
                </h2>
                {dadosCanc.total === 0 && (
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>
                    Clique em Sincronizar para importar cancelamentos.
                  </span>
                )}
              </div>
              {dadosCanc.total > 0 && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        {cancColsVisiveis.map(c => (
                          <th key={c.chave}>{c.label}</th>
                        ))}
                        <th style={{ width: '2.5rem' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {dadosCanc.registros.map((row, i) => (
                        <tr key={i}>
                          {cancColsVisiveis.map(c => (
                            <td key={c.chave}>{row[c.chave] ?? ''}</td>
                          ))}
                          <td>
                            <button
                              className="btn-delete-row"
                              title="Remover cancelamento"
                              onClick={() => handleDeleteCanc(row.id)}
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
