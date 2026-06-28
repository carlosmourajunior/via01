import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL   = new Date().getFullYear()

const CIDADES = [
  { id: 'borda_mata',    label: 'Borda da Mata' },
  { id: 'ouro_fino',     label: 'Ouro Fino' },
  { id: 'inconfidentes', label: 'Inconfidentes' },
]

function BadgeAtivo({ ativo }) {
  const ok = ativo === 'S'
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 10, fontSize: '.75rem', fontWeight: 600,
      background: ok ? '#e8f8e8' : '#fde8e8',
      color:      ok ? '#1a5e20' : '#7d1010',
    }}>
      {ok ? 'Ativo' : 'Inativo'}
    </span>
  )
}

function toDate(s) {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d) ? null : d
}

function useIXCData(url, cidade) {
  const [dados,   setDados]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState(null)

  const carregar = (orig = cidade) => {
    setLoading(true)
    setErro(null)
    axios.get(`${url}?origem=${orig}`)
      .then(r => { setDados(r.data); setLoading(false) })
      .catch(e => { setErro(e.response?.data?.detail || e.message); setLoading(false) })
  }

  return { dados, loading, erro, carregar, setErro }
}

// Calcula KPIs de ano/mês/7dias a partir de uma lista de registros e um campo de data
function useKpis(registros, campoDt, mesFiltro, anoFiltro, anoGrafico) {
  return useMemo(() => {
    const hoje = new Date()
    const limite7 = new Date()
    limite7.setDate(hoje.getDate() - 7)
    limite7.setHours(0, 0, 0, 0)

    const doMes = []
    const ultimos7 = []
    let totalAno = 0
    const contagem = Array(12).fill(0)

    for (const r of registros) {
      const d = toDate(r[campoDt])
      if (!d) continue
      if (d.getFullYear() === anoFiltro && d.getMonth() === mesFiltro) doMes.push(r)
      if (d >= limite7) ultimos7.push(r)
      if (d.getFullYear() === anoFiltro) totalAno++
      if (d.getFullYear() === anoGrafico) contagem[d.getMonth()]++
    }

    const porMes = MESES_ABREV.map((nome, i) => ({ nome, total: contagem[i] }))
    return { doMes, ultimos7, totalAno, porMes }
  }, [registros, campoDt, mesFiltro, anoFiltro, anoGrafico])
}

export default function VendasIXC() {
  const hoje = new Date()

  const [cidade,      setCidade]      = useState('borda_mata')
  const [mesFiltro,   setMesFiltro]   = useState(hoje.getMonth())
  const [anoFiltro,   setAnoFiltro]   = useState(ANO_ATUAL)
  const [anoGrafVendas, setAnoGrafVendas] = useState(ANO_ATUAL)
  const [anoGrafCanc,   setAnoGrafCanc]   = useState(ANO_ATUAL)

  const [syncing,  setSyncing]  = useState(false)
  const [syncInfo, setSyncInfo] = useState(null)
  const [erroGlobal, setErroGlobal] = useState(null)

  const [buscaVendas, setBuscaVendas] = useState('')
  const [buscaCanc,   setBuscaCanc]   = useState('')

  // ── dados de contratos ──────────────────────────────────────────────────
  const { dados: dadosV, loading: loadV, erro: erroV, carregar: carregarV } =
    useIXCData('/api/ixc/vendas', cidade)

  // ── dados de cancelamentos ──────────────────────────────────────────────
  const { dados: dadosC, loading: loadC, erro: erroC, carregar: carregarC } =
    useIXCData('/api/ixc/cancelamentos-ixc', cidade)

  useEffect(() => { carregarV(); carregarC() }, [])

  const handleCidadeChange = (nova) => {
    setCidade(nova)
    setSyncInfo(null)
    carregarV(nova)
    carregarC(nova)
  }

  const handleSync = async () => {
    setSyncing(true)
    setErroGlobal(null)
    try {
      await axios.post('/api/ixc/sync-clientes')
      await axios.post('/api/ixc/sync-contratos')
      await Promise.all([
        axios.post(`/api/ixc/sync-os?ano=${ANO_ATUAL}`),
        axios.post(`/api/ixc/sync-os?ano=${ANO_ATUAL - 1}`),
      ])
      const [resV, resC] = await Promise.all([
        axios.get(`/api/ixc/vendas?origem=${cidade}`),
        axios.get(`/api/ixc/cancelamentos-ixc?origem=${cidade}`),
      ])
      setSyncInfo({ contratos: resV.data.total, cancelamentos: resC.data.total })
      carregarV()
      carregarC()
    } catch (err) {
      setErroGlobal('Erro na sincronização: ' + (err.response?.data?.detail || err.message))
    }
    setSyncing(false)
  }

  // Anos disponíveis (union de contratos e cancelamentos)
  const anosDisponiveis = useMemo(() => {
    const anos = new Set()
    ;(dadosV?.registros ?? []).forEach(r => {
      const d = toDate(r.data_ativacao)
      if (d) anos.add(d.getFullYear())
    })
    ;(dadosC?.registros ?? []).forEach(r => {
      const d = toDate(r.data_abertura)
      if (d) anos.add(d.getFullYear())
    })
    const lista = [...anos].sort((a, b) => b - a)
    return lista.length ? lista : [ANO_ATUAL]
  }, [dadosV, dadosC])

  // KPIs contratos
  const kpV = useKpis(
    dadosV?.registros ?? [], 'data_ativacao', mesFiltro, anoFiltro, anoGrafVendas
  )

  // KPIs cancelamentos
  const kpC = useKpis(
    dadosC?.registros ?? [], 'data_abertura', mesFiltro, anoFiltro, anoGrafCanc
  )

  // Busca nas tabelas
  const vendsMesFilt = useMemo(() => {
    const q = buscaVendas.trim().toLowerCase()
    if (!q) return kpV.doMes
    return kpV.doMes.filter(r =>
      (r.nome   || '').toLowerCase().includes(q) ||
      (r.bairro || '').toLowerCase().includes(q) ||
      (r.fone   || '').toLowerCase().includes(q)
    )
  }, [kpV.doMes, buscaVendas])

  const cancMesFilt = useMemo(() => {
    const q = buscaCanc.trim().toLowerCase()
    if (!q) return kpC.doMes
    return kpC.doMes.filter(r =>
      (r.nome    || '').toLowerCase().includes(q) ||
      (r.assunto || '').toLowerCase().includes(q) ||
      (r.fone    || '').toLowerCase().includes(q)
    )
  }, [kpC.doMes, buscaCanc])

  const lastSyncV = dadosV?.last_sync ? new Date(dadosV.last_sync).toLocaleString('pt-BR') : null
  const lastSyncC = dadosC?.last_sync ? new Date(dadosC.last_sync).toLocaleString('pt-BR') : null
  const lastSyncLabel = lastSyncV || lastSyncC

  const loading = loadV || loadC

  return (
    <div className="page">
      <div className="page-header">
        <h1>Contratos IXC — {CIDADES.find(c => c.id === cidade)?.label}</h1>
        <div className="page-actions">
          {lastSyncLabel && (
            <span style={{ fontSize: '.8rem', color: '#888', marginRight: '0.75rem' }}>
              Sync: {lastSyncLabel}
            </span>
          )}
          <button className="btn-sync" onClick={handleSync} disabled={syncing}>
            {syncing ? '⟳ Sincronizando...' : '⟳ Sincronizar IXC'}
          </button>
        </div>
      </div>

      {(erroGlobal || erroV || erroC) && (
        <div className="alert-error">{erroGlobal || erroV || erroC}</div>
      )}
      {syncInfo && (
        <div className="alert-success">
          Sincronizado: <strong>{syncInfo.contratos} contratos</strong> e{' '}
          <strong>{syncInfo.cancelamentos} cancelamentos</strong> encontrados.
        </div>
      )}

      {/* Tabs de cidade */}
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

      {/* Seletor de mês/ano — compartilhado */}
      <div className="card mes-selector-card">
        <span className="mes-selector-label">Analisar mês:</span>
        <select className="select-periodo" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="select-periodo" value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))}>
          {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading && <div className="loading" style={{ padding: '1rem' }}>Carregando...</div>}

      {/* ══════════════════════════════════════════
          SEÇÃO CONTRATOS
      ══════════════════════════════════════════ */}
      <div style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#27ae60' }}>Novos Contratos</h2>
        <span style={{ height: 2, flex: 1, background: '#e0f5eb', borderRadius: 2 }} />
      </div>

      {dadosV?.sem_sync ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
          Nenhum dado. Clique em <strong>Sincronizar IXC</strong>.
        </div>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-value">{kpV.totalAno}</div>
              <div className="kpi-label">Ativados — {anoFiltro}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#27ae60' }}>{kpV.doMes.length}</div>
              <div className="kpi-label">Ativados — {MESES_ABREV[mesFiltro]}/{anoFiltro}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#3498db' }}>{kpV.ultimos7.length}</div>
              <div className="kpi-label">Últimos 7 dias</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#8e44ad' }}>{dadosV?.total ?? 0}</div>
              <div className="kpi-label">Total na base</div>
            </div>
          </div>

          <div className="card chart-card">
            <div className="chart-card-header">
              <h2>Novos contratos por mês</h2>
              <select className="select-periodo select-periodo--sm" value={anoGrafVendas} onChange={e => setAnoGrafVendas(Number(e.target.value))}>
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kpV.porMes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" name="Contratos" fill="#27ae60" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {kpV.ultimos7.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: '0.75rem' }}>Contratos — últimos 7 dias ({kpV.ultimos7.length})</h2>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Data Ativação</th><th>Nome</th><th>Bairro</th><th>Fone</th><th>Cliente</th></tr></thead>
                  <tbody>
                    {kpV.ultimos7.map((r, i) => (
                      <tr key={i}>
                        <td>{r.data_ativacao}</td>
                        <td>{r.nome || '—'}</td>
                        <td>{r.bairro || '—'}</td>
                        <td>{r.fone || '—'}</td>
                        <td><BadgeAtivo ativo={r.cliente_ativo} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="table-header">
              <h2>
                Contratos — {MESES[mesFiltro]}/{anoFiltro}
                <span style={{ fontWeight: 400, fontSize: '.9rem', color: '#666', marginLeft: '0.5rem' }}>
                  ({vendsMesFilt.length}{buscaVendas ? ` de ${kpV.doMes.length}` : ''})
                </span>
              </h2>
              <input className="filtro-input" type="text" placeholder="Buscar nome, bairro, fone..."
                value={buscaVendas} onChange={e => setBuscaVendas(e.target.value)} style={{ minWidth: 220 }} />
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Data Ativação</th><th>Nome</th><th>Bairro</th><th>Fone</th><th>Cliente</th></tr></thead>
                <tbody>
                  {vendsMesFilt.length === 0
                    ? <tr><td colSpan={5} className="sem-resultado">Nenhum contrato ativado neste mês.</td></tr>
                    : vendsMesFilt.map((r, i) => (
                      <tr key={i}>
                        <td>{r.data_ativacao}</td>
                        <td>{r.nome || '—'}</td>
                        <td>{r.bairro || '—'}</td>
                        <td>{r.fone || '—'}</td>
                        <td><BadgeAtivo ativo={r.cliente_ativo} /></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          SEÇÃO CANCELAMENTOS
      ══════════════════════════════════════════ */}
      <div style={{ margin: '2rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#e74c3c' }}>Cancelamentos</h2>
        <span style={{ height: 2, flex: 1, background: '#fde8e8', borderRadius: 2 }} />
      </div>

      {dadosC?.sem_sync ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
          Nenhum dado de OS. Clique em <strong>Sincronizar IXC</strong>.
        </div>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#e74c3c' }}>{kpC.totalAno}</div>
              <div className="kpi-label">Cancelamentos — {anoFiltro}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#c0392b' }}>{kpC.doMes.length}</div>
              <div className="kpi-label">Cancelamentos — {MESES_ABREV[mesFiltro]}/{anoFiltro}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#e67e22' }}>{kpC.ultimos7.length}</div>
              <div className="kpi-label">Últimos 7 dias</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#888' }}>{dadosC?.total ?? 0}</div>
              <div className="kpi-label">Total na base</div>
            </div>
          </div>

          {/* Gráfico + Breakdown lado a lado */}
          <div className="charts-row">
            <div className="card chart-card">
              <div className="chart-card-header">
                <h2>Cancelamentos por mês</h2>
                <select className="select-periodo select-periodo--sm" value={anoGrafCanc} onChange={e => setAnoGrafCanc(Number(e.target.value))}>
                  {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kpC.porMes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Cancelamentos" fill="#e74c3c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {(dadosC?.breakdown?.length ?? 0) > 0 && (
              <div className="card chart-card">
                <h2>Motivos de cancelamento</h2>
                <div className="table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Motivo (assunto OS)</th><th style={{ textAlign: 'right' }}>Qtd</th></tr></thead>
                    <tbody>
                      {dadosC.breakdown.map((b, i) => (
                        <tr key={i}>
                          <td>{b.assunto}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#e74c3c' }}>{b.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {kpC.ultimos7.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: '0.75rem' }}>Cancelamentos — últimos 7 dias ({kpC.ultimos7.length})</h2>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Data</th><th>Nome</th><th>Motivo</th><th>Fone</th><th>Status OS</th></tr></thead>
                  <tbody>
                    {kpC.ultimos7.map((r, i) => (
                      <tr key={i}>
                        <td>{r.data_abertura}</td>
                        <td>{r.nome || '—'}</td>
                        <td>{r.assunto || '—'}</td>
                        <td>{r.fone || '—'}</td>
                        <td><span style={{ fontSize: '.78rem', color: '#888' }}>{r.status || '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="table-header">
              <h2>
                Cancelamentos — {MESES[mesFiltro]}/{anoFiltro}
                <span style={{ fontWeight: 400, fontSize: '.9rem', color: '#666', marginLeft: '0.5rem' }}>
                  ({cancMesFilt.length}{buscaCanc ? ` de ${kpC.doMes.length}` : ''})
                </span>
              </h2>
              <input className="filtro-input" type="text" placeholder="Buscar nome, motivo, fone..."
                value={buscaCanc} onChange={e => setBuscaCanc(e.target.value)} style={{ minWidth: 220 }} />
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Data</th><th>Nome</th><th>Motivo</th><th>Fone</th><th>Status OS</th></tr></thead>
                <tbody>
                  {cancMesFilt.length === 0
                    ? <tr><td colSpan={5} className="sem-resultado">Nenhum cancelamento neste mês.</td></tr>
                    : cancMesFilt.map((r, i) => (
                      <tr key={i}>
                        <td>{r.data_abertura}</td>
                        <td>{r.nome || '—'}</td>
                        <td>{r.assunto || '—'}</td>
                        <td>{r.fone || '—'}</td>
                        <td><span style={{ fontSize: '.78rem', color: '#888' }}>{r.status || '—'}</span></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
