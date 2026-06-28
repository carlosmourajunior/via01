import base64
import json
import requests

IXC_TOKEN = "1:824a9b5ca411aa0bfc08cdf7dfe73b8acefac4cacbdf77a042783ac2d13eaa3e"
BASE_URL  = "https://ixc.via01.com.br/webservice/v1"


def hdrs():
    b64 = base64.b64encode(IXC_TOKEN.encode()).decode()
    return {"Authorization": f"Basic {b64}", "Content-Type": "application/json", "ixcsoft": "listar"}


print("Varrendo todas as paginas de clientes...")
cidades: dict = {}
page = 1
total_regs = 0

while True:
    r = requests.post(
        f"{BASE_URL}/cliente",
        data=json.dumps({"qtype": "id", "query": "1", "oper": ">=",
                         "page": page, "rp": 200,
                         "sortname": "id", "sortorder": "asc"}),
        headers=hdrs(), timeout=20
    )
    d = r.json()
    regs = d.get("registros", [])
    if not regs:
        break

    for reg in regs:
        cid = str(reg.get("cidade", ""))
        st  = reg.get("status_prospeccao", "")
        at  = reg.get("ativo", "")
        if cid not in cidades:
            cidades[cid] = {"total": 0, "status": {}, "ativo": {}, "ceps": set(), "bairros": set()}
        cidades[cid]["total"] += 1
        cidades[cid]["status"][st] = cidades[cid]["status"].get(st, 0) + 1
        cidades[cid]["ativo"][at]  = cidades[cid]["ativo"].get(at, 0) + 1
        cidades[cid]["ceps"].add(str(reg.get("cep", ""))[:5])
        cidades[cid]["bairros"].add(reg.get("bairro", "").strip())

    total_regs += len(regs)
    total_api   = int(d.get("total", 0))
    total_pages = (total_api + 199) // 200
    print(f"  pagina {page}/{total_pages}  acumulado={total_regs}/{total_api}")
    if page >= total_pages:
        break
    page += 1

print()
print("=" * 80)
print("  MAPA COMPLETO DE CIDADES")
print("=" * 80)
for cid, info in sorted(cidades.items(), key=lambda x: -x[1]["total"]):
    ceps    = sorted(c for c in info["ceps"] if c)[:4]
    bairros = sorted(b for b in info["bairros"] if b)[:4]
    print(f"\n  cidade_id = {cid}")
    print(f"  total     = {info['total']}")
    print(f"  status_prospeccao = {info['status']}")
    print(f"  ativo     = {info['ativo']}")
    print(f"  CEPs      = {ceps}")
    print(f"  bairros   = {bairros}")
