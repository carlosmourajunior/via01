import { useState } from 'react'
import Leads from './pages/Leads'
import Vendas from './pages/Vendas'
import VendasIXC from './pages/VendasIXC'
import Comparacao from './pages/Comparacao'
import OsAnalise from './pages/OsAnalise'
import Admin from './pages/Admin'

const MENU = [
  { id: 'leads',       label: 'Leads',        icon: '🎯' },
  { id: 'vendas',      label: 'Vendas',        icon: '💰' },
  { id: 'vendas-ixc',  label: 'Contratos IXC', icon: '📋' },
  { id: 'comparacao',  label: 'Comparacao',    icon: '📊' },
  { id: 'os',          label: 'OS IXC',        icon: '🔧' },
  { id: 'admin',       label: 'Admin',         icon: '⚙️' },
]

export default function App() {
  const [pagina, setPagina] = useState('leads')

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">📊</span>
          <span className="logo-text">Controle Interno</span>
        </div>
        <nav className="sidebar-nav">
          {MENU.map(item => (
            <button
              key={item.id}
              className={'nav-item' + (pagina === item.id ? ' active' : '')}
              onClick={() => setPagina(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {pagina === 'leads'      && <Leads />}
        {pagina === 'vendas'     && <Vendas />}
        {pagina === 'vendas-ixc' && <VendasIXC />}
        {pagina === 'comparacao' && <Comparacao />}
        {pagina === 'os'         && <OsAnalise />}
        {pagina === 'admin'      && <Admin />}
      </main>
    </div>
  )
}
