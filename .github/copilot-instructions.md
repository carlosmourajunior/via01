# Controle Interno — Diretrizes do Projeto

## Visão Geral

Aplicação interna full-stack para controle de leads e vendas.

- **Backend**: FastAPI (Python) + PostgreSQL via `psycopg2`
- **Frontend**: React + Vite, sem TypeScript
- **Infraestrutura**: Docker Compose (serviços `backend`, `frontend`, `db`)
- **Comunicação**: Frontend consome `/api/*` via `axios`; proxy configurado no `vite.config.js`

## Arquitetura

```
controleinterno/
├── backend/        # FastAPI — main.py (arquivo único por enquanto)
├── frontend/
│   └── src/
│       ├── App.jsx         # Roteamento por estado (pagina), menu lateral
│       └── pages/          # Uma página = um componente default export
└── docker-compose.yml
```

## Backend (FastAPI / Python)

- Toda a lógica fica em `backend/main.py`; extrair módulos só quando o arquivo ficar difícil de navegar.
- Conexão com banco feita em `get_conn()` — abrir, usar, fechar no `finally`.
- Cache em memória com `_cache` dict + `CACHE_TTL` para respostas pesadas.
- Hash SHA-256 por linha (`_row_hash`) para deduplicação na importação incremental.<!--  -->
- Variáveis de ambiente lidas via `environ.get()` com fallback seguro; nunca hardcodar credenciais.
- Nomear endpoints: `/api/<recurso>` em snake_case.
- Retornar dicionários estruturados: `{ "total": n, "registros": [...] }` ou `{ "message": "...", "inseridos": n }`.
- Usar `HTTPException` com `status_code` e `detail` em português para erros de negócio.
- Migrations: usar `CREATE TABLE IF NOT EXISTS` em `init_db()` chamado no `startup`.

## Frontend (React / Vite)

- Sem TypeScript. Componentes `.jsx`.
- Uma página nova = novo arquivo em `src/pages/NomePagina.jsx` com `export default function NomePagina()`.
- Registrar a página no array `MENU` em `App.jsx` e adicionar o `{pagina === 'id' && <NomePagina />}` no `<main>`.
- Estado local com `useState`; dados pesados derivados com `useMemo`; evitar `useEffect` desnecessário.
- Chamadas HTTP com `axios` — `.get('/api/...')`, `.post('/api/...')`.
- Tratamento de erro: salvar em estado `erro` (string) e exibir com `<div className="alert-error">`.
- Feedback de carregamento: estado `loading` booleano, retornar `<div className="loading">...</div>` cedo.
- Rótulos de colunas via objeto `ROTULOS` ao invés de strings soltas no JSX.

## Estilos (CSS)

- CSS global em `src/index.css`; sem CSS Modules ou Tailwind.
- Classes utilitárias já definidas: `.page`, `.page-header`, `.page-actions`, `.card`, `.kpi-row`, `.kpi-card`, `.kpi-value`, `.kpi-label`, `.charts-row`, `.chart-card`, `.table-wrapper`, `.alert-error`, `.alert-success`, `.btn-sync`, `.btn-upload`, `.btn-limpar`, `.loading`.
- Novos componentes devem reutilizar essas classes antes de criar novas.

## Convenções Gerais

- Português para textos de UI, mensagens de erro e comentários no código.
- Inglês para nomes de variáveis, funções, classes e chaves de objetos JS.
- Sem `console.log` em código de produção.
- Não commitar `.env`.
