import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CIDADES = [
  { id: 'borda_mata',    label: 'Clientes Borda' },
  { id: 'ouro_fino',     label: 'Ouro Fino' },
  { id: 'inconfidentes', label: 'Inconfidentes' },
]
const ANO_ATUAL = new Date().getFullYear()

function fmtDatetime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const CORES_OS = {
  instalacao:    { bg: '#e8f8e8', color: '#1a5e20' },
  manutencao:    { bg: '#fef9e7', color: '#7d6608' },
  default:       { bg: '#eaf2fb', color: '#1a5276' },
}

function osColor(tipo) {
  const t = (tipo || '').toLowerCase()
  if (t.includes('instal')) return CORES_OS.instalacao
  if (t.includes('manut'))  return CORES_OS.manutencao
  return CORES_OS.default
}

function OsBadges({ os }) {
  if (!os || os.length === 0) return <span style={{ color: '#bbb', fontSize: '.75rem' }}>sem OS</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {os.map((o, i) => {
        const { bg, color } = osColor(o.tipo_chamado)
        return (
          <span key={i} style={{ background: bg, color, padding: '1px 6px', borderRadius: 4, fontSize: '.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}
            title={`OS #${o.ixc_os_id} · ${o.status}`}>
            {o.tipo_chamado || '?'} · {o.data_abertura || '—'}
          </span>
        )
      })}
    </div>
  )
}

export default function Comparacao() {
  const [cidade, setCidade] = useState('borda_mata')
  const [ano,    setAno]    = useState(ANO_ATUAL)
  const [mes,    setMes]    = useState(null) // null = todos os meses

  const [dadosExcel,  setDadosExcel]  = useState(null)
  const [dadosIxc,    setDadosIxc]    = useState(null)
  const [dadosAnalise,setDadosAnalise]= useState(null)
  const [statusSync,  setStatusSync]  = useState(null)

  const [loadExcel,   setLoadExcel]   = useState(false)
  const [loadIxc,     setLoadIxc]     = useState(false)
  const [loadAnalise, setLoadAnalise] = useState(false)
  const [syncingCli,  setSyncingCli]  = useState(false)
  const [syncingOs,   setSyncingOs]   = useState(false)

  const [erroExcel,   setErroExcel]   = useState(null)
  const [erroIxc,     setErroIxc]     = useState(null)
  const [erroAnalise, setErroAnalise] = useState(null)
  const [erroSync,    setErroSync]    = useState(null)
  const [msgSync,     setMsgSync]     = useState(null)

  const [abaDiv,      setAbaDiv]      = useState('so_ixc')
  const [similaridade, setSimilaridade] = useState(0.82)

  // busca de cliente individual
  const [buscaNome,    setBuscaNome]    = useState('')
  const [buscaSim,     setBuscaSim]     = useState(0.70)
  const [buscaResult,  setBuscaResult]  = useState(null)
  const [buscaLoading, setBuscaLoading] = useState(false)
  const [buscaErro,    setBuscaErro]    = useState(null)

  const carregarStatus = () => {
    axios.get('/api/ixc/status-sync')
      .then(r => setStatusSync(r.data))
      .catch(() => {})
  }

  const carregar = (orig = cidade, a = ano, m = mes, sim = similaridade) => {
    setLoadExcel(true); setLoadIxc(true); setLoadAnalise(true)
    setErroExcel(null); setErroIxc(null); setErroAnalise(null)

    axios.get(`/api/vendas?origem=${orig}`)
      .then(r => setDadosExcel(r.data))
      .catch(e => setErroExcel(e.response?.data?.detail || e.message))
      .finally(() => setLoadExcel(false))

    axios.get(`/api/ixc/cadastros?origem=${orig}&ano=${a}`)
      .then(r => setDadosIxc(r.data))
      .catch(e => setErroIxc(e.response?.data?.detail || e.message))
      .finally(() => setLoadIxc(false))

    const mesParam = m !== null ? `&mes=${m}` : ''
    axios.get(`/api/ixc/analise?origem=${orig}&ano=${a}${mesParam}&similaridade=${sim}`)
      .then(r => setDadosAnalise(r.data))
      .catch(e => setErroAnalise(e.response?.data?.detail || e.message))
      .finally(() => setLoadAnalise(false))
  }

  useEffect(() => { carregar(); carregarStatus() }, [])

  const buscarCliente = (e) => {
    e.preventDefault()
    if (!buscaNome.trim()) return
    setBuscaLoading(true); setBuscaErro(null); setBuscaResult(null)
    axios.get(`/api/ixc/buscar-cliente?nome=${encodeURIComponent(buscaNome)}&similaridade=${buscaSim}`)
      .then(r => setBuscaResult(r.data))
      .catch(e => setBuscaErro(e.response?.data?.detail || e.message))
      .finally(() => setBuscaLoading(false))
  }

  const handleCidade = (c) => { setCidade(c); carregar(c, ano, mes) }
  const handleAno    = (a) => { setAno(a);    carregar(cidade, a, mes) }
  const handleMes    = (m) => { setMes(m);    carregar(cidade, ano, m) }

  const sincronizarClientes = () => {
    setSyncingCli(true); setErroSync(null); setMsgSync(null)
    axios.post('/api/ixc/sync-clientes')
      .then(r => { setMsgSync(r.data.message); carregarStatus(); carregar() })
      .catch(e => setErroSync(e.response?.data?.detail || e.message))
      .finally(() => setSyncingCli(false))
  }

  const sincronizarOs = () => {
    setSyncingOs(true); setErroSync(null); setMsgSync(null)
    axios.post(`/api/ixc/sync-os?ano=${ano}`)
      .then(r => { setMsgSync(r.data.message); carregarStatus() })
      .catch(e => setErroSync(e.response?.data?.detail || e.message))
      .finally(() => setSyncingOs(false))
  }

  // Todos os registros do ano (para o gráfico)
  const excelDoAno = useMemo(() => {
    if (!dadosExcel) return []
    return dadosExcel.registros.filter(r => r.data?.startsWith(String(ano)))
  }, [dadosExcel, ano])

  // Registros filtrados pelo mês selecionado (para KPIs e tabelas)
  const excelFiltrado = useMemo(() => {
    if (mes === null) return excelDoAno
    return excelDoAno.filter(r => {
      if (!r.data) return false
      return new Date(r.data + 'T00:00:00').getMonth() + 1 === mes
    })
  }, [excelDoAno, mes])

  const ixcFiltrado = useMemo(() => {
    const base = dadosIxc ? (mes === null ? dadosIxc.registros : dadosIxc.registros.filter(r => {
      if (!r.data_cadastro) return false
      return new Date(r.data_cadastro + 'T00:00:00').getMonth() + 1 === mes
    })) : []
    // inclui segundo_ponto confirmados via OS (nao tem data_cadastro no periodo)
    const extras = (dadosAnalise?.segundo_ponto ?? []).filter(r => {
      if (mes === null) return true
      if (!r.data) return false
      return new Date(r.data + 'T00:00:00').getMonth() + 1 === mes
    }).map(r => ({
      data_cadastro: r.data,
      nome:          r._nome_ixc || r.nome,
      bairro:        '',
      ativo:         r.ixc_ativo,
      _segundo_ponto: true,
    }))
    return [...base, ...extras]
  }, [dadosIxc, dadosAnalise, mes])

  const excelPorMes = useMemo(() => {
    const cnt = Array(12).fill(0)
    excelDoAno.forEach(r => {
      if (!r.data) return
      const m = new Date(r.data + 'T00:00:00').getMonth()
      if (!isNaN(m)) cnt[m]++
    })
    return cnt
  }, [excelDoAno])

  const ixcPorMes = useMemo(() => {
    const base = dadosIxc ? dadosIxc.por_mes.map(m => m.total) : Array(12).fill(0)
    const extra = Array(12).fill(0)
    dadosAnalise?.segundo_ponto?.forEach(r => {
      if (!r.data) return
      const m = new Date(r.data + 'T00:00:00').getMonth()
      if (!isNaN(m)) extra[m]++
    })
    return base.map((v, i) => v + extra[i])
  }, [dadosIxc, dadosAnalise])

  const dadosGrafico = useMemo(() => (
    MESES_ABREV.map((label, i) => ({
      mes: label,
      Planilha: excelPorMes[i] || 0,
      IXC:      ixcPorMes[i]   || 0,
    }))
  ), [excelPorMes, ixcPorMes])

  const anosDisponiveis = useMemo(() => {
    const anos = new Set([ANO_ATUAL])
    dadosExcel?.registros.forEach(r => {
      const a = Number(r.data?.slice(0, 4))
      if (a > 2000) anos.add(a)
    })
    return [...anos].sort((a, b) => b - a)
  }, [dadosExcel])

  const excelTotal   = excelFiltrado.length
  const ixcTotal     = dadosAnalise?.total_novas_instalacoes_ixc ?? ixcFiltrado.length
  const difTotal     = ixcTotal - excelTotal
  const periodoLabel = mes !== null ? `${MESES_ABREV[mes - 1]}/${ano}` : String(ano)

  const soIxc       = dadosAnalise?.so_ixc        ?? []
  const segundoPonto= dadosAnalise?.segundo_ponto  ?? []
  const semIxc      = dadosAnalise?.sem_ixc        ?? []
  const semSync     = dadosAnalise?.sem_sync       ?? false

  const labelCidade = CIDADES.find(c => c.id === cidade)?.label

  return (
    <div className="page">
      <div className="page-header">
        <h1>Comparacao — Planilha vs IXC — {labelCidade}</h1>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <select
            className="select-periodo"
            value={ano}
            onChange={e => handleAno(Number(e.target.value))}
          >
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            className="select-periodo"
            value={mes ?? ''}
            onChange={e => handleMes(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Todos os meses</option>
            {MESES_ABREV.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs de cidade */}
      <div className="cidade-tabs">
        {CIDADES.map(c => (
          <button
            key={c.id}
            className={'cidade-tab' + (cidade === c.id ? ' active' : '')}
            onClick={() => handleCidade(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Painel de Sincronização IXC */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600, marginBottom: '.25rem' }}>Banco local IXC</div>
            {statusSync ? (
              <div style={{ fontSize: '.82rem', color: '#666', lineHeight: 1.6 }}>
                <span style={{ marginRight: '1rem' }}>
                  Clientes: <strong>{statusSync.clientes.total.toLocaleString('pt-BR')}</strong>
                  {statusSync.clientes.ultima_sync && (
                    <> &middot; sync {fmtDatetime(statusSync.clientes.ultima_sync)}</>
                  )}
                </span>
                <span>
                  OS: <strong>{statusSync.os.total.toLocaleString('pt-BR')}</strong>
                  {statusSync.os.ultima_sync && (
                    <> &middot; sync {fmtDatetime(statusSync.os.ultima_sync)}</>
                  )}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '.82rem', color: '#999' }}>Carregando status...</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={sincronizarClientes}
              disabled={syncingCli || syncingOs}
            >
              {syncingCli ? 'Sincronizando...' : 'Sync Clientes IXC'}
            </button>
            <button
              className="btn-secondary"
              onClick={sincronizarOs}
              disabled={syncingCli || syncingOs}
            >
              {syncingOs ? 'Sincronizando...' : `Sync OS ${ano}`}
            </button>
          </div>
        </div>
        {msgSync  && <div style={{ marginTop: '.5rem', color: '#27ae60', fontSize: '.85rem' }}>{msgSync}</div>}
        {erroSync && <div style={{ marginTop: '.5rem', color: '#e74c3c', fontSize: '.85rem' }}>Erro: {erroSync}</div>}
      </div>

      {(erroExcel || erroIxc) && (
        <div className="alert-error">
          {erroExcel && <div>Planilha: {erroExcel}</div>}
          {erroIxc   && <div>IXC: {erroIxc}</div>}
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#4a90d9' }}>
            {loadExcel ? '...' : excelTotal}
          </div>
          <div className="kpi-label">Planilha — {periodoLabel}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#e67e22' }}>
            {loadIxc ? '...' : ixcTotal}
          </div>
          <div className="kpi-label">IXC — {periodoLabel}</div>
        </div>
        <div className="kpi-card">
          <div
            className="kpi-value"
            style={{ color: difTotal >= 0 ? '#27ae60' : '#e74c3c' }}
          >
            {loadExcel || loadIxc ? '...' : `${difTotal >= 0 ? '+' : ''}${difTotal}`}
          </div>
          <div className="kpi-label">Diferenca IXC - Planilha</div>
        </div>
      </div>

      {/* Gráfico agrupado */}
      <div className="card chart-card">
        <div className="chart-card-header">
          <h2>
            Cadastros por mes — {ano}
            {mes !== null && <span style={{ fontWeight: 400, color: '#888', fontSize: '.85em' }}> ({MESES_ABREV[mes - 1]} destacado)</span>}
          </h2>
          {(loadExcel || loadIxc) && (
            <span className="comp-loading-tag">Carregando...</span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dadosGrafico} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Planilha" fill="#4a90d9" radius={[3, 3, 0, 0]}>
              {dadosGrafico.map((_, i) => (
                <Cell key={i} opacity={mes === null || i === mes - 1 ? 1 : 0.3} />
              ))}
            </Bar>
            <Bar dataKey="IXC" fill="#e67e22" radius={[3, 3, 0, 0]}>
              {dadosGrafico.map((_, i) => (
                <Cell key={i} opacity={mes === null || i === mes - 1 ? 1 : 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Busca de Cliente Individual ── */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '.6rem' }}>Buscar cliente por nome</div>
        <form onSubmit={buscarCliente} style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <input
              type="text"
              value={buscaNome}
              onChange={e => setBuscaNome(e.target.value)}
              placeholder="Ex: TrustIT, Maria Silva..."
              style={{ width: '100%', padding: '.4rem .75rem', borderRadius: 8, border: '1px solid #ccc', fontSize: '.9rem', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.83rem' }}>
            <label style={{ color: '#666', whiteSpace: 'nowrap' }}>Similaridade min:</label>
            <input
              type="number" min="0.5" max="1" step="0.05"
              value={buscaSim}
              onChange={e => setBuscaSim(Number(e.target.value))}
              style={{ width: 60, padding: '.35rem .5rem', borderRadius: 6, border: '1px solid #ccc', fontSize: '.85rem', fontFamily: 'inherit' }}
            />
            <span style={{ color: '#999' }}>{Math.round(buscaSim * 100)}%</span>
          </div>
          <button type="submit" className="btn-primary" disabled={buscaLoading}>
            {buscaLoading ? 'Buscando...' : 'Buscar'}
          </button>
          {buscaResult && (
            <button type="button" className="btn-secondary" onClick={() => { setBuscaResult(null); setBuscaNome('') }}>
              Limpar
            </button>
          )}
        </form>
        {buscaErro && <div style={{ marginTop: '.5rem', color: '#e74c3c', fontSize: '.85rem' }}>Erro: {buscaErro}</div>}

        {buscaResult && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ marginBottom: '.5rem', fontSize: '.85rem', color: '#555' }}>
              "{buscaResult.busca}" ({Math.round(buscaResult.similaridade * 100)}% min) —
              <strong> {buscaResult.total_ixc}</strong> no IXC,
              <strong> {buscaResult.total_planilha}</strong> na planilha
            </div>

            {buscaResult.clientes_ixc.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '.35rem', fontSize: '.88rem', color: '#e67e22' }}>
                  Registros IXC encontrados
                </div>
                <div className="table-wrapper" style={{ maxHeight: 220 }}>
                  <table>
                    <thead>
                      <tr><th>Sim%</th><th>ID</th><th>Nome IXC</th><th>Cadastro</th><th>Bairro</th><th>Ativo</th><th>OS</th></tr>
                    </thead>
                    <tbody>
                      {buscaResult.clientes_ixc.map((c, i) => (
                        <tr key={i} style={{ background: i === 0 ? '#fff8f0' : undefined }}>
                          <td style={{ fontWeight: 700, color: c._sim >= 0.9 ? '#27ae60' : '#e67e22' }}>{Math.round(c._sim * 100)}%</td>
                          <td style={{ color: '#999', fontSize: '.78rem' }}>{c.ixc_id}</td>
                          <td>{c.nome}</td>
                          <td>{c.data_cadastro}</td>
                          <td>{c.bairro}</td>
                          <td style={{ color: c.ativo === 'S' ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>
                            {c.ativo === 'S' ? 'Sim' : 'Nao'}
                          </td>
                          <td><OsBadges os={c.os} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {buscaResult.planilha.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: '.35rem', fontSize: '.88rem', color: '#4a90d9' }}>
                  Entradas na planilha encontradas
                </div>
                <div className="table-wrapper" style={{ maxHeight: 220 }}>
                  <table>
                    <thead>
                      <tr><th>Sim%</th><th>Data</th><th>Nome Planilha</th><th>Instalado</th><th>Vendedor</th><th>Origem</th></tr>
                    </thead>
                    <tbody>
                      {buscaResult.planilha.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: r._sim >= 0.9 ? '#27ae60' : '#4a90d9' }}>{Math.round(r._sim * 100)}%</td>
                          <td>{r.data}</td>
                          <td>{r.nome}</td>
                          <td>{r.instalacao}</td>
                          <td>{r.vendedor}</td>
                          <td style={{ color: '#999', fontSize: '.78rem' }}>{r.origem}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {buscaResult.total_ixc === 0 && buscaResult.total_planilha === 0 && (
              <div style={{ color: '#888', fontSize: '.85rem' }}>Nenhum resultado acima de {Math.round(buscaResult.similaridade * 100)}%.</div>
            )}
          </div>
        )}
      </div>

      {/* ── Análise de Divergências ── */}
      <div className="diverg-header">
        <h2>Analise de Divergencias — {periodoLabel}</h2>
        <div className="diverg-header-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.83rem', color: '#555' }}>
            Similaridade:
            <input
              type="number" min="0.5" max="1" step="0.05"
              value={similaridade}
              onChange={e => { const v = Number(e.target.value); setSimilaridade(v); carregar(cidade, ano, mes, v) }}
              style={{ width: 55, padding: '.25rem .4rem', borderRadius: 6, border: '1px solid #ccc', fontSize: '.83rem', fontFamily: 'inherit' }}
            />
            <span style={{ color: '#999' }}>{Math.round(similaridade * 100)}%</span>
          </label>
          {loadAnalise && <span className="comp-loading-tag">Carregando...</span>}
          {!loadAnalise && dadosAnalise && !semSync && (
            <span className="diverg-resumo">
              <span style={{ color: '#e67e22',  fontWeight: 600 }}>{soIxc.length}</span> so IXC
              &nbsp;·&nbsp;
              <span style={{ color: '#9b59b6',  fontWeight: 600 }}>{segundoPonto.length}</span> 2º ponto
              &nbsp;·&nbsp;
              <span style={{ color: '#e74c3c',  fontWeight: 600 }}>{semIxc.length}</span> sem IXC
            </span>
          )}
        </div>
      </div>

      {erroAnalise && (
        <div className="alert-error">Analise: {erroAnalise}</div>
      )}

      {semSync && !loadAnalise && (
        <div className="alert-error" style={{ borderColor: '#f39c12', background: '#fef9e7', color: '#7d6608' }}>
          Banco local do IXC vazio. Clique em "Sync Clientes IXC" para sincronizar os dados antes de usar a analise aprofundada.
        </div>
      )}

      {!semSync && (
        <>
          <div className="cidade-tabs" style={{ marginBottom: '1rem' }}>
            <button
              className={'cidade-tab' + (abaDiv === 'so_ixc' ? ' active' : '')}
              style={{ '--active-color': '#e67e22' }}
              onClick={() => setAbaDiv('so_ixc')}
            >
              So no IXC ({loadAnalise ? '...' : soIxc.length})
            </button>
            <button
              className={'cidade-tab' + (abaDiv === 'segundo_ponto' ? ' active' : '')}
              onClick={() => setAbaDiv('segundo_ponto')}
            >
              2º Ponto / Retorno ({loadAnalise ? '...' : segundoPonto.length})
            </button>
            <button
              className={'cidade-tab' + (abaDiv === 'sem_ixc' ? ' active' : '')}
              onClick={() => setAbaDiv('sem_ixc')}
            >
              Falta no IXC ({loadAnalise ? '...' : semIxc.length})
            </button>
          </div>

          {abaDiv === 'so_ixc' && (
            <div className="card">
              <div className="table-header">
                <h2 style={{ color: '#e67e22' }}>
                  Clientes no IXC ({periodoLabel}) sem correspondencia na Planilha — {loadAnalise ? '...' : soIxc.length}
                </h2>
                <div style={{ fontSize: '.8rem', color: '#888' }}>
                  Possivelmente falta preencher na planilha &middot; OS de instalacao confirma se o cliente e real
                </div>
              </div>
              {loadAnalise ? (
                <div className="comp-loading-tag" style={{ padding: '1rem' }}>Carregando...</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ID IXC</th><th>Cadastro</th><th>Nome</th>
                        <th>Bairro</th><th>Fone</th><th>Ativo</th>
                        <th>OS (tipo / data)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {soIxc.length === 0
                        ? <tr><td colSpan={7} className="sem-resultado">Nenhuma divergencia.</td></tr>
                        : soIxc.map((r, i) => (
                          <tr key={i}>
                            <td style={{ color: '#999', fontSize: '.8rem' }}>{r.ixc_id}</td>
                            <td>{r.data_cadastro}</td>
                            <td>{r.nome}</td>
                            <td>{r.bairro}</td>
                            <td>{r.fone}</td>
                            <td style={{ color: r.ativo === 'S' ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>
                              {r.ativo === 'S' ? 'Sim' : 'Nao'}
                            </td>
                            <td><OsBadges os={r.os} /></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {abaDiv === 'segundo_ponto' && (
            <div className="card">
              <div className="table-header">
                <h2 style={{ color: '#9b59b6' }}>
                  Possivel 2º Ponto — {loadAnalise ? '...' : segundoPonto.length}
                </h2>
                <div style={{ fontSize: '.8rem', color: '#888' }}>
                  Na planilha de {periodoLabel}, cliente ja existia no IXC e tem OS de instalacao no periodo &middot; pode ser 2º ponto ou retorno
                </div>
              </div>
              {loadAnalise ? (
                <div className="comp-loading-tag" style={{ padding: '1rem' }}>Carregando...</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Data Planilha</th><th>Nome</th><th>Vendedor</th>
                        <th>ID IXC</th><th>Cadastro IXC</th><th>Ativo IXC</th>
                        <th>OS (tipo / data)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segundoPonto.length === 0
                        ? <tr><td colSpan={7} className="sem-resultado">Nenhum caso encontrado.</td></tr>
                        : segundoPonto.map((r, i) => (
                          <tr key={i} style={{ background: '#fdf4ff' }}>
                            <td>{r.data}</td>
                            <td>{r.nome}</td>
                            <td>{r.vendedor}</td>
                            <td style={{ color: '#999', fontSize: '.8rem' }}>{r.ixc_id}</td>
                            <td>
                              <span
                                title={r.ixc_data_cadastro}
                                style={{
                                  background: r.ixc_ano_cadastro < String(ano) ? '#f3e5fb' : '#e8f8e8',
                                  color:      r.ixc_ano_cadastro < String(ano) ? '#6c3483' : '#1a5e20',
                                  padding: '2px 6px', borderRadius: 4, fontSize: '.8rem', fontWeight: 600
                                }}
                              >
                                {r.ixc_data_cadastro || r.ixc_ano_cadastro}
                              </span>
                            </td>
                            <td style={{ color: r.ixc_ativo === 'S' ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>
                              {r.ixc_ativo === 'S' ? 'Sim' : 'Nao'}
                            </td>
                            <td><OsBadges os={r.os} /></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {abaDiv === 'sem_ixc' && (
            <div className="card">
              <div className="table-header">
                <h2 style={{ color: '#e74c3c' }}>
                  Na Planilha sem confirmacao no IXC — {loadAnalise ? '...' : semIxc.length}
                </h2>
                <div style={{ fontSize: '.8rem', color: '#888' }}>
                  Sem novo cadastro IXC nem OS de instalacao no periodo &middot; "Antigo" = cliente existe no IXC de outra epoca, sem nova OS
                </div>
              </div>
              {loadAnalise ? (
                <div className="comp-loading-tag" style={{ padding: '1rem' }}>Carregando...</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Data</th><th>Nome</th><th>Instalado</th><th>Vendedor</th><th>Situacao IXC</th></tr>
                    </thead>
                    <tbody>
                      {semIxc.length === 0
                        ? <tr><td colSpan={5} className="sem-resultado">Nenhum caso encontrado.</td></tr>
                        : semIxc.map((r, i) => (
                          <tr key={i} style={{ background: '#fff5f5' }}>
                            <td>{r.data}</td>
                            <td>{r.nome}</td>
                            <td>{r.instalacao}</td>
                            <td>{r.vendedor}</td>
                            <td>
                              {r._ixc_id ? (
                                <span title={`Cad. IXC: ${r._ixc_data_cadastro}`} style={{ background: '#fff3cd', color: '#856404', padding: '2px 7px', borderRadius: 4, fontSize: '.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  Antigo · {r._ixc_data_cadastro?.slice(0, 7)}
                                  {r._ixc_ativo === 'N' ? ' · inativo' : ''}
                                </span>
                              ) : (
                                <span style={{ background: '#f8d7da', color: '#721c24', padding: '2px 7px', borderRadius: 4, fontSize: '.75rem', fontWeight: 600 }}>
                                  Nao encontrado
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Tabelas lado a lado */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '.75rem', color: '#444' }}>Todos os registros — {periodoLabel}</h2>
      </div>
      <div className="comp-tables">
        <div className="card">
          <div className="table-header">
            <h2>Planilha ({loadExcel ? '...' : excelFiltrado.length})</h2>
          </div>
          {loadExcel ? (
            <div className="comp-loading-tag" style={{ padding: '1rem' }}>Carregando...</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Data</th><th>Nome</th><th>Instalado</th><th>Vendedor</th></tr>
                </thead>
                <tbody>
                  {excelFiltrado.length === 0
                    ? <tr><td colSpan={4} className="sem-resultado">Sem registros.</td></tr>
                    : excelFiltrado.map((r, i) => (
                      <tr key={i}>
                        <td>{r.data}</td>
                        <td>{r.nome}</td>
                        <td>{r.instalacao}</td>
                        <td>{r.vendedor}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="table-header">
            <h2>IXC ({loadIxc ? '...' : ixcFiltrado.length})</h2>
          </div>
          {loadIxc ? (
            <div className="comp-loading-tag" style={{ padding: '1rem' }}>Carregando...</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Data</th><th>Nome</th><th>Bairro</th><th>Ativo</th></tr>
                </thead>
                <tbody>
                  {ixcFiltrado.length === 0
                    ? <tr><td colSpan={4} className="sem-resultado">Sem registros.</td></tr>
                    : ixcFiltrado.map((r, i) => (
                      <tr key={i} style={r._segundo_ponto ? { background: '#f0f4ff' } : undefined}>
                        <td>{r.data_cadastro}</td>
                        <td>
                          {r.nome}
                          {r._segundo_ponto && (
                            <span style={{ marginLeft: 6, background: '#d0d8ff', color: '#2c3e8c', padding: '1px 5px', borderRadius: 3, fontSize: '.7rem', fontWeight: 600 }}>OS</span>
                          )}
                        </td>
                        <td>{r.bairro}</td>
                        <td style={{ color: r.ativo === 'S' ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>
                          {r.ativo === 'S' ? 'Sim' : 'Nao'}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
