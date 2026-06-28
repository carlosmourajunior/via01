import base64
import json
import requests

IXC_TOKEN = "1:824a9b5ca411aa0bfc08cdf7dfe73b8acefac4cacbdf77a042783ac2d13eaa3e"
IXC_BASE  = "https://ixc.via01.com.br/webservice/v1"
ANO = 2026

NOMES_CIDADE = {"2331": "Borda da Mata", "2780": "Ouro Fino", "2590": "Inconfidentes"}


def hdrs():
    b64 = base64.b64encode(IXC_TOKEN.encode()).decode()
    return {"Authorization": f"Basic {b64}", "Content-Type": "application/json", "ixcsoft": "listar"}


print(f"Buscando clientes com data_cadastro >= {ANO}-01-01 ...")
todos = []
page = 1
while True:
    r = requests.post(
        f"{IXC_BASE}/cliente",
        data=json.dumps({"qtype": "data_cadastro", "query": f"{ANO}-01-01",
                         "oper": ">=", "page": page, "rp": 200,
                         "sortname": "data_cadastro", "sortorder": "asc"}),
        headers=hdrs(), timeout=30
    )
    d = r.json()
    regs = d.get("registros", [])
    if not regs:
        break
    for rec in regs:
        dc = rec.get("data_cadastro", "")
        if dc.startswith(str(ANO)):
            todos.append(rec)
    total_api = int(d.get("total", 0))
    print(f"  pagina {page}, total_api={total_api}, acumulado_ano={len(todos)}")
    if len(todos) >= total_api or not regs:
        break
    page += 1

# Agrupa por cidade
cidades: dict = {}
por_mes: dict = {}
for c in todos:
    cid = str(c.get("cidade", ""))
    dc  = c.get("data_cadastro", "")
    cidades[cid] = cidades.get(cid, 0) + 1
    try:
        mes = int(dc[5:7])
        por_mes[mes] = por_mes.get(mes, 0) + 1
    except (ValueError, IndexError):
        pass

print()
print("=== Resultado ===")
print(f"Total {ANO}: {len(todos)}")
print()
print("Por cidade:")
for cid, cnt in sorted(cidades.items(), key=lambda x: -x[1]):
    label = NOMES_CIDADE.get(cid, "?")
    print(f"  {cid:6s} ({label:15s}) = {cnt}")

print()
print("Por mes (todas as cidades):")
MESES_A = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
for m in range(1, 13):
    cnt = por_mes.get(m, 0)
    bar = "#" * cnt
    print(f"  {MESES_A[m-1]:3s} ({m:02d}): {cnt:4d}  {bar}")

# Mostra 3 exemplos por cidade
print()
print("Exemplos por cidade:")
for cid, label in NOMES_CIDADE.items():
    exemplos = [c for c in todos if str(c.get("cidade","")) == cid][:3]
    if exemplos:
        print(f"\n  {label} (id={cid}):")
        for e in exemplos:
            print(f"    {e.get('data_cadastro')} | {e.get('razao','')[:30]} | bairro={e.get('bairro','')}")
