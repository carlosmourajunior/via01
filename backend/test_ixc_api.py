"""
Script de diagnóstico para a API do IXC Provedor.
Execução: python test_ixc_api.py

Padrão correto da API IXC:
  - Método:  POST
  - Header:  ixcsoft: listar  (para listagem; sem ele o POST cria registro)
  - Body:    JSON com qtype/query/oper/page/rp/sortname/sortorder
  - Auth:    Basic base64(token)   onde token = "id:hash"
"""
import base64
import json
import requests

IXC_HOST  = "https://ixc.via01.com.br"
IXC_TOKEN = "1:824a9b5ca411aa0bfc08cdf7dfe73b8acefac4cacbdf77a042783ac2d13eaa3e"
BASE_URL  = f"{IXC_HOST}/webservice/v1"


def ixc_headers(listar: bool = True) -> dict:
    b64 = base64.b64encode(IXC_TOKEN.encode()).decode()
    h = {"Authorization": f"Basic {b64}", "Content-Type": "application/json"}
    if listar:
        h["ixcsoft"] = "listar"
    return h


def ixc_listar(recurso: str, filtros: dict) -> tuple[int, any]:
    url = f"{BASE_URL}/{recurso}"
    try:
        resp = requests.post(url, data=json.dumps(filtros),
                             headers=ixc_headers(listar=True), timeout=15, verify=True)
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, resp.text
    except Exception as e:
        return 0, str(e)


def dump(label: str, status: int, body: any):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"  HTTP {status}")
    texto = json.dumps(body, ensure_ascii=False)[:800] if isinstance(body, (dict, list)) else str(body)[:800]
    print(f"  {texto}")


# ─────────────────────────────────────────────
#  1. Mapa de cidades (id → CEP/bairros)
# ─────────────────────────────────────────────
print("=" * 60)
print("  BLOCO 1 — Mapa de cidades (id -> CEP/bairros para identificar)")

status, body = ixc_listar("cliente", {
    "qtype": "id", "query": "1", "oper": ">=",
    "page": 1, "rp": 500,
    "sortname": "id", "sortorder": "asc"
})
cidades: dict[str, dict] = {}
for r in body.get("registros", []):
    cid = str(r.get("cidade", ""))
    if cid not in cidades:
        cidades[cid] = {"bairros": set(), "ceps": set()}
    cidades[cid]["bairros"].add(r.get("bairro", "").strip())
    cidades[cid]["ceps"].add(str(r.get("cep", "")).strip()[:5])

print(f"\n  Total na base: {body.get('total')}  |  Cidades distintas: {len(cidades)}\n")
for cid, info in sorted(cidades.items()):
    ceps    = sorted(c for c in info["ceps"] if c)[:5]
    bairros = sorted(b for b in info["bairros"] if b)[:4]
    print(f"  cidade_id={cid:6s}  CEPs={ceps}  bairros={bairros}")


# ─────────────────────────────────────────────
#  2. Contagem por cidade
# ─────────────────────────────────────────────
print("\n\n" + "=" * 60)
print("  BLOCO 2 — Total de clientes por cidade_id")

for cid in sorted(cidades.keys()):
    _, b = ixc_listar("cliente", {
        "qtype": "cidade", "query": cid, "oper": "=",
        "page": 1, "rp": 1, "sortname": "id", "sortorder": "asc"
    })
    print(f"  cidade_id={cid:6s}  total={b.get('total', '?')}")


# ─────────────────────────────────────────────
#  3. Distribuição de status_prospeccao
# ─────────────────────────────────────────────
print("\n\n" + "=" * 60)
print("  BLOCO 3 — Distribuicao de status_prospeccao (200 mais recentes)")

_, body = ixc_listar("cliente", {
    "qtype": "id", "query": "1", "oper": ">=",
    "page": 1, "rp": 200,
    "sortname": "data_cadastro", "sortorder": "desc"
})
status_count: dict[str, int] = {}
for r in body.get("registros", []):
    s = r.get("status_prospeccao", "")
    status_count[s] = status_count.get(s, 0) + 1

for s, cnt in sorted(status_count.items(), key=lambda x: -x[1]):
    print(f"  '{s}' = {cnt} registros")

print("\nDiagnostico concluido.")


# ─────────────────────────────────────────────
#  5. Explorar endpoint de logins (cliente_login)
# ─────────────────────────────────────────────
print("\n\n" + "=" * 60)
print("  BLOCO 5 — Logins criados em 2026-04 (primeiros 10)")

status, body = ixc_listar("cliente_login", {
    "qtype":    "data_criacao",
    "query":    "2026-04-01",
    "oper":     ">=",
    "page":     1,
    "rp":       10,
    "sortname": "data_criacao",
    "sortorder": "asc",
})
print(f"  HTTP {status}  |  total={body.get('total', '?')}")
regs = body.get("registros", [])
if regs:
    print(f"  Campos disponíveis: {list(regs[0].keys())}")
    for r in regs[:5]:
        print(f"  id={r.get('id')}  id_cliente={r.get('id_cliente')}  "
              f"id_contrato={r.get('id_contrato')}  login={r.get('login')!r}  "
              f"data_criacao={r.get('data_criacao')!r}  id_cidade={r.get('id_cidade')!r}  "
              f"ativo={r.get('ativo')!r}")
else:
    print(f"  Sem registros ou endpoint diferente. Body: {str(body)[:300]}")


# ─────────────────────────────────────────────
#  4. Busca direta por ID de cliente (debug nome)
# ─────────────────────────────────────────────
IDS_INVESTIGAR = [3478]  # adicione outros IDs aqui se precisar

# ─────────────────────────────────────────────
#  4b. Nome da cidade pelo ID
# ─────────────────────────────────────────────
CIDADES_INVESTIGAR = ["3102", "2331", "2780", "2590"]

print("\n\n" + "=" * 60)
print("  BLOCO 4b — Nome das cidades por ID")
_, body_cid = ixc_listar("cidade", {
    "qtype": "id", "query": "1", "oper": ">=",
    "page": 1, "rp": 500, "sortname": "id", "sortorder": "asc"
})
for r in body_cid.get("registros", []):
    if str(r.get("id")) in CIDADES_INVESTIGAR:
        print(f"  id={r.get('id')}  nome={r.get('nome')!r}  uf={r.get('uf')!r}")

print("\n\n" + "=" * 60)
print("  BLOCO 4 — Campos de nome para IDs especificos")

for cid in IDS_INVESTIGAR:
    _, body = ixc_listar("cliente", {
        "qtype": "id", "query": str(cid), "oper": "=",
        "page": 1, "rp": 1, "sortname": "id", "sortorder": "asc"
    })
    regs = body.get("registros", [])
    if not regs:
        print(f"\n  ID {cid}: NAO ENCONTRADO na API")
        continue
    r = regs[0]
    print(f"\n  ID {cid}:")
    print(f"    razao    = {r.get('razao')!r}")
    print(f"    fantasia = {r.get('fantasia')!r}")
    print(f"    nome     = {r.get('nome')!r}")
    print(f"    cidade   = {r.get('cidade')!r}")
    print(f"    bairro   = {r.get('bairro')!r}")
    print(f"    ativo    = {r.get('ativo')!r}")
    print(f"    data_cadastro = {r.get('data_cadastro')!r}")
