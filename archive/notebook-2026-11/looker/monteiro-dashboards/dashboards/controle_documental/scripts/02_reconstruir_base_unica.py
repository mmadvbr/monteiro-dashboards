"""
Script 2 — Reconstruir aba Base Única
=======================================
O que faz:
  - Lê todas as 8 abas de filial (já reestruturadas pelo Script 1)
  - Consolida em uma única tabela de 30 colunas
  - Enriquece com dados do IBGE: UF, Município, Região, Código IBGE, População
  - Escreve na aba "Base Única" com formatação e proteção
  - As colunas de partido (AA, AB, AC, AD) ficam vazias — preenchidas pelo Script 3

Pré-requisito: rodar o Script 1 antes deste.

Como usar:
  1. Defina SHEET_ID abaixo
  2. python3 02_reconstruir_base_unica.py
"""

import re
import json
import time
import urllib.request
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# ── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
CREDS_FILE = '/Users/giovanavilhena/Downloads/gestao-documental-490513-6734fdef6574.json'

SHEET_ID = '1C0T6flQ_5I8FlAxhMmcxLu713F-48EWTvc_4AIZw98U'  # cópia
# SHEET_ID = '1ooKBidxuw8_WhcW93TpnFqMZ354d1BMaaoBq5tzpE6Q'  # original

FILIAIS = ['Matriz', 'Filial PA', 'Filial CE', 'Filial MA',
           'Filial SC', 'Filial BA', 'Filial DF', 'Filial SP']

EDITORS = [
    'giovana.vilhena@monteiro.adv.br',
    'drive-831@gestao-documental-490513.iam.gserviceaccount.com'
]

# As 20 colunas das filiais (igual ao Script 1)
FILIAL_HEADERS = [
    'Data Inclusão Planilha', 'UF - Município', 'Parceiros', 'Matéria',
    'Contrato', 'Procuração', 'Kit Prefeito', 'Revogação',
    'Data Publicação', 'Data Assinatura Contrato', 'Data Assinatura Último Aditivo',
    'Validade do Contrato', 'Tipo de Vigência', 'Valor', 'Processo',
    'Observação', 'Código do Negócio', 'Código de Matéria',
    'Editado por Último', 'Última Modificação em',
]

# 10 colunas extras da Base Única (U até AD)
EXTRA_HEADERS = [
    'Filial Responsável',       # U
    'UF',                       # V
    'Município',                # W
    'Região',                   # X
    'Código IBGE',              # Y
    'População do Município',   # Z
    'Partido 2020',             # AA
    'Partido 2024',             # AB
    'Partido 2028',             # AC
    'Partido Fechamento',       # AD
]

BASE_HEADERS = FILIAL_HEADERS + EXTRA_HEADERS  # 30 colunas

HEADER_COLOR = {'red': 0.208, 'green': 0.408, 'blue': 0.329}  # #356854

# Mapa UF → Região
UF_REGIAO = {
    'AC':'Norte','AM':'Norte','AP':'Norte','PA':'Norte','RO':'Norte','RR':'Norte','TO':'Norte',
    'AL':'Nordeste','BA':'Nordeste','CE':'Nordeste','MA':'Nordeste','PB':'Nordeste',
    'PE':'Nordeste','PI':'Nordeste','RN':'Nordeste','SE':'Nordeste',
    'DF':'Centro-Oeste','GO':'Centro-Oeste','MS':'Centro-Oeste','MT':'Centro-Oeste',
    'ES':'Sudeste','MG':'Sudeste','RJ':'Sudeste','SP':'Sudeste',
    'PR':'Sul','RS':'Sul','SC':'Sul',
}

# ── FUNÇÕES ───────────────────────────────────────────────────────────────────

def norm(s):
    return re.sub(r'[\s\n\r]+', ' ', str(s).strip().lower())

def build_service():
    scopes = ['https://www.googleapis.com/auth/spreadsheets']
    creds = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
    return build('sheets', 'v4', credentials=creds)

def carregar_ibge():
    """
    Baixa lista de municípios do IBGE com população estimada e código IBGE.
    Retorna dict: (norm(nome), uf) → {'codigo': str, 'populacao': int, 'regiao': str}
    """
    print("Carregando dados do IBGE...")
    url = 'https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/last'
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        print(f"  AVISO: IBGE falhou ({e}). Continuando sem população.")
        return {}

    ibge = {}
    for item in data[1:]:  # pula header
        nome_raw = item.get('D2N', '')
        cod = item.get('D2C', '')
        pop_str = item.get('V', '').replace('.', '').replace(',', '')
        uf = cod[:2] if len(cod) >= 2 else ''

        try:
            pop = int(pop_str)
        except ValueError:
            pop = 0

        key = norm(nome_raw) + '|' + uf
        ibge[key] = {'codigo': cod, 'populacao': pop}

    print(f"  {len(ibge)} municípios carregados do IBGE")
    return ibge

def parse_uf_municipio(uf_mun):
    """
    Extrai UF e Município de campos no formato 'XX-NOME' ou 'XX - NOME'.
    Retorna (uf, municipio) ambos em maiúsculo.
    """
    s = str(uf_mun).strip()
    if '-' in s:
        parts = s.split('-', 1)
        return parts[0].strip().upper(), parts[1].strip().upper()
    return '', s.upper()

def ler_filial(svc, sheet_id, aba):
    """Lê dados da filial (já no formato de 20 colunas do Script 1)."""
    raw = svc.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=f'{aba}!A1:T6500',
        valueRenderOption='FORMATTED_VALUE'
    ).execute().get('values', [])

    if not raw or len(raw) < 2:
        return []

    # Header deve estar na linha 0 (Script 1 já limpou a linha em branco da Matriz)
    header = raw[0]
    data = raw[1:]

    rows = []
    for row in data:
        if not any(str(c).strip() for c in row):
            continue
        # Garante 20 colunas
        padded = (row + [''] * 20)[:20]
        rows.append(padded)

    return rows

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    svc = build_service()
    sh = svc.spreadsheets()
    print(f"Planilha: {SHEET_ID}\n")

    # 1. Consolida filiais
    print("1. Consolidando Filiais → Base Única")
    all_rows = [BASE_HEADERS]

    for aba in FILIAIS:
        rows = ler_filial(svc, SHEET_ID, aba)
        print(f"  {aba}: {len(rows)} linhas")
        for r in rows:
            extra = [aba, '', '', '', '', '', '', '', '', '']  # 10 extras vazios
            all_rows.append(r + extra)

    n_total = len(all_rows) - 1
    print(f"  Total: {n_total} linhas\n")

    # 2. Enriquece com IBGE
    ibge = carregar_ibge()

    print("2. Enriquecendo com IBGE...")
    hit = 0
    for row in all_rows[1:]:
        uf_mun = row[1]  # col B = UF - Município
        if not uf_mun:
            continue

        uf, mun = parse_uf_municipio(uf_mun)
        uf_code = uf[:2] if uf else ''

        row[21] = uf         # col V = UF
        row[22] = mun        # col W = Município
        row[23] = UF_REGIAO.get(uf_code, '')  # col X = Região

        key = norm(mun) + '|' + uf_code.lower()
        if key in ibge:
            row[24] = ibge[key]['codigo']     # col Y = Código IBGE
            row[25] = ibge[key]['populacao']  # col Z = População
            hit += 1

    print(f"  IBGE enriquecido: {hit}/{n_total} linhas\n")

    # 3. Escreve na aba Base Única
    print("3. Escrevendo Base Única...")
    sh.values().clear(spreadsheetId=SHEET_ID, range='Base Única!A:AD').execute()
    time.sleep(0.5)

    # Escreve em lotes de 1000 para evitar timeout
    BATCH = 1000
    for start in range(0, len(all_rows), BATCH):
        end = min(start + BATCH, len(all_rows))
        rng = f'Base Única!A{start+1}'
        sh.values().update(
            spreadsheetId=SHEET_ID,
            range=rng,
            valueInputOption='RAW',
            body={'values': all_rows[start:end]}
        ).execute()
        time.sleep(0.3)

    print(f"  {n_total} linhas escritas ✓\n")

    # 4. Formatação
    print("4. Aplicando formatação...")
    meta = sh.get(spreadsheetId=SHEET_ID,
                  fields='sheets(properties(sheetId,title),bandedRanges)').execute()

    bu_sid = None
    existing_banding = []
    for s in meta['sheets']:
        if s['properties']['title'] == 'Base Única':
            bu_sid = s['properties']['sheetId']
            existing_banding = [br['bandedRangeId'] for br in s.get('bandedRanges', [])]

    if bu_sid is None:
        print("  ERRO: aba 'Base Única' não encontrada!")
        return

    requests = []

    # Remove banding existente
    for bid in existing_banding:
        requests.append({"deleteBanding": {"bandedRangeId": bid}})

    # Header
    requests.append({"repeatCell": {
        "range": {"sheetId": bu_sid, "startRowIndex": 0, "endRowIndex": 1,
                  "startColumnIndex": 0, "endColumnIndex": 30},
        "cell": {"userEnteredFormat": {
            "backgroundColor": HEADER_COLOR,
            "textFormat": {"bold": True,
                           "foregroundColor": {"red":1,"green":1,"blue":1},
                           "fontFamily": "Montserrat", "fontSize": 10},
            "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE"
        }},
        "fields": "userEnteredFormat"
    }})

    # Banding
    requests.append({"addBanding": {"bandedRange": {
        "range": {"sheetId": bu_sid, "startRowIndex": 1,
                  "startColumnIndex": 0, "endColumnIndex": 30},
        "rowProperties": {
            "headerColor": HEADER_COLOR,
            "firstBandColor": {"red":1,"green":1,"blue":1},
            "secondBandColor": {"red":0.95,"green":0.97,"blue":0.96}
        }
    }}})

    # Filtro
    requests.append({"setBasicFilter": {"filter": {
        "range": {"sheetId": bu_sid, "startRowIndex": 0, "endRowIndex": 1,
                  "startColumnIndex": 0, "endColumnIndex": 30}
    }}})

    # Congelar cabeçalho
    requests.append({"updateSheetProperties": {
        "properties": {"sheetId": bu_sid, "gridProperties": {"frozenRowCount": 1}},
        "fields": "gridProperties.frozenRowCount"
    }})

    # Proteção total (só Giovana + SA)
    requests.append({"addProtectedRange": {"protectedRange": {
        "range": {"sheetId": bu_sid, "startRowIndex": 1,
                  "startColumnIndex": 0, "endColumnIndex": 30},
        "description": "Base Única — somente leitura para usuários gerais",
        "warningOnly": False,
        "editors": {"users": EDITORS}
    }}})

    sh.batchUpdate(spreadsheetId=SHEET_ID, body={"requests": requests}).execute()
    print("  Formatação e proteção aplicadas ✓\n")

    print(f"✓ Base Única: {n_total} linhas, 30 colunas")
    print(f"  Colunas AA-AD (partidos) ainda vazias — rodar Script 3 para preencher")

if __name__ == '__main__':
    main()
