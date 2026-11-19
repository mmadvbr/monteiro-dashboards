"""
Script 1 — Reestruturar abas Filiais
=====================================
O que faz:
  - Lê cada uma das 8 abas de filial (Matriz, Filial PA, Filial CE, Filial MA,
    Filial SC, Filial BA, Filial DF, Filial SP)
  - Reordena / renomeia / remove colunas para o novo padrão de 20 colunas
  - Escreve fórmulas: Tipo de Vigência (col M), Código do Negócio (col Q),
    Código de Matéria (col R)
  - Aplica formatação: header verde, banding cinza, filtro, larguras fixas,
    proteção nas colunas de fórmula (Q, R, S, T)

Como usar:
  1. Defina SHEET_ID abaixo: use a cópia para testar, a original para produção
  2. No terminal:  python3 01_reestruturar_filiais.py
  3. Aguarde — leva ~3-5 min por planilha inteira
"""

import re
import json
import time
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# ── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
CREDS_FILE = '/Users/giovanavilhena/Downloads/gestao-documental-490513-6734fdef6574.json'

# CÓPIA (para testes):
SHEET_ID = '1C0T6flQ_5I8FlAxhMmcxLu713F-48EWTvc_4AIZw98U'

# ORIGINAL (só mexer quando tiver certeza):
# SHEET_ID = '1ooKBidxuw8_WhcW93TpnFqMZ354d1BMaaoBq5tzpE6Q'

FILIAIS = ['Matriz', 'Filial PA', 'Filial CE', 'Filial MA',
           'Filial SC', 'Filial BA', 'Filial DF', 'Filial SP']

# Quem pode editar as colunas protegidas (fórmulas automáticas)
EDITORS = [
    'giovana.vilhena@monteiro.adv.br',
    'drive-831@gestao-documental-490513.iam.gserviceaccount.com'
]

# Novo padrão de 20 colunas (A até T)
NEW_HEADERS = [
    'Data Inclusão Planilha',       # A
    'UF - Município',               # B
    'Parceiros',                    # C
    'Matéria',                      # D
    'Contrato',                     # E
    'Procuração',                   # F
    'Kit Prefeito',                 # G
    'Revogação',                    # H  ← nova
    'Data Publicação',              # I
    'Data Assinatura Contrato',     # J  ← renomeada
    'Data Assinatura Último Aditivo', # K ← renomeada
    'Validade do Contrato',         # L
    'Tipo de Vigência',             # M  ← fórmula automática
    'Valor',                        # N
    'Processo',                     # O
    'Observação',                   # P
    'Código do Negócio',            # Q  ← fórmula automática
    'Código de Matéria',            # R  ← fórmula automática
    'Editado por Último',           # S  ← preenchido pelo onEdit
    'Última Modificação em',        # T  ← preenchido pelo onEdit
]

# Larguras de cada coluna (em pixels)
COL_WIDTHS = [130, 160, 150, 220, 100, 110, 110, 110,
              140, 175, 210, 155, 130, 100, 220, 200,
              220, 250, 170, 170]

# Cor do cabeçalho
HEADER_COLOR = {'red': 0.208, 'green': 0.408, 'blue': 0.329}  # #356854

# ── FUNÇÕES AUXILIARES ────────────────────────────────────────────────────────

def norm(s):
    """Normaliza texto para comparação: minúsculo, sem espaços duplos."""
    return re.sub(r'[\s\n\r]+', ' ', str(s).strip().lower())

def find_col(hdrs, *aliases):
    """
    Encontra o índice de uma coluna no header por múltiplos apelidos.
    Passa 1: match exato. Passa 2: apelido dentro do header (só aliases >= 6 chars).
    Retorna None se não encontrar.
    """
    normalized = [norm(h) for h in hdrs]
    for na in [norm(a) for a in aliases]:
        for i, nh in enumerate(normalized):
            if nh == na:
                return i
    for na in [norm(a) for a in aliases]:
        if len(na) >= 6:
            for i, nh in enumerate(normalized):
                if na in nh:
                    return i
    return None

def get_header_row_index(rows):
    """
    Detecta em qual linha está o cabeçalho (Matriz tem linha 1 em branco).
    Conta quantas palavras-chave conhecidas aparecem em cada linha.
    """
    keywords = {'matéria', 'município', 'contrato', 'processo', 'parceiros',
                'uf', 'valor', 'validade', 'procuração', 'observação'}
    best_row, best_score = 0, 0
    for i, row in enumerate(rows[:5]):
        score = sum(1 for c in row if any(k in norm(c) for k in keywords))
        if score > best_score:
            best_score, best_row = score, i
    return best_row

# Mapeamento: índice no novo padrão → apelidos possíveis no sheet original
SRC = {
    0:  ['data inclusão planilha', 'data', 'bo', 'data inclusao'],
    1:  ['uf - município', 'uf - municipio', 'uf-município'],
    2:  ['parceiros', 'parceiro'],
    3:  ['matéria', 'materia'],
    4:  ['contrato'],
    5:  ['procuração', 'procuracao'],
    6:  ['kit prefeito', 'kit'],
    # 7 = Revogação → nova coluna, vazia
    8:  ['data publicação', 'data publicacao', 'publicação'],
    9:  ['assinatura contrato', 'assinatura\ncontrato', 'data assinatura contrato'],
    10: ['assinatura último aditivo', 'assinatura ultimo aditivo',
         'assinatura\núltimo aditivo', 'último aditivo'],
    11: ['validade do contrato', 'validade', 'validade do \ncontrato/aditivo'],
    # 12 = Tipo de Vigência → fórmula
    13: ['valor'],
    14: ['processo'],
    15: ['observação', 'observacao'],
    # 16 = Código do Negócio → fórmula
    # 17 = Código de Matéria → fórmula
    18: ['editado por último', 'editado por ultimo', 'editado por'],
    19: ['última modificação em', 'ultima modificacao em', 'última modificação'],
}

# ── LÓGICA PRINCIPAL ──────────────────────────────────────────────────────────

def build_service():
    scopes = ['https://www.googleapis.com/auth/spreadsheets']
    creds = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
    return build('sheets', 'v4', credentials=creds)

def reestruturar_aba(svc, sheet_id, aba):
    sh = svc.spreadsheets()
    print(f"\n{'='*55}")
    print(f"  {aba}")
    print(f"{'='*55}")

    # ── 1. Lê dados atuais ──
    raw = sh.values().get(
        spreadsheetId=sheet_id,
        range=f'{aba}!A1:Z6500',
        valueRenderOption='FORMATTED_VALUE'
    ).execute().get('values', [])

    if not raw:
        print(f"  AVISO: aba vazia, pulando")
        return

    hi = get_header_row_index(raw)
    hdrs = raw[hi]
    data_rows = raw[hi + 1:]
    print(f"  Header na linha {hi+1}, {len(data_rows)} linhas de dados")

    # ── 2. Mapeia colunas antigas → novo layout ──
    out = [NEW_HEADERS.copy()]  # linha 1 = cabeçalho

    for row in data_rows:
        # Ignora linhas completamente vazias
        if not any(str(c).strip() for c in row):
            continue

        new_row = [''] * 20

        for new_idx, aliases in SRC.items():
            old_idx = find_col(hdrs, *aliases)
            if old_idx is not None and old_idx < len(row):
                new_row[new_idx] = row[old_idx]

        out.append(new_row)

    n_data = len(out) - 1  # sem contar o header
    print(f"  {n_data} linhas mapeadas")

    # ── 3. Adiciona fórmulas ──
    # Nota: fórmulas usam ";" como separador porque a planilha está em PT-BR.
    # Se a planilha estiver em EN, trocar ";" por "," e "SE" por "IF" etc.
    for r_idx in range(1, len(out)):  # r_idx = índice em `out` (1 = primeira linha de dados)
        r = r_idx + 1  # número da linha no Sheets (1-based, +1 porque header está em row 1)

        # Col M: Tipo de Vigência — se Validade - Data Assinatura ≤ 365 dias → Renovável
        out[r_idx][12] = (
            f'=SE(E(L{r}<>"";J{r}<>"");'
            f'SE(DATADIF(J{r};L{r};"D")<=365;"Renovável";"Por Escopo");"")'
        )

        # Col Q: Código do Negócio = UF-Município + "-" + Matéria
        out[r_idx][16] = f'=SE(B{r}<>"";MAIÚSCULA(B{r})&"-"&MAIÚSCULA(D{r});"")'

        # Col R: Código de Matéria = UF-Município + "-" + Matéria + "-" + Processo
        out[r_idx][17] = f'=SE(B{r}<>"";MAIÚSCULA(B{r})&"-"&MAIÚSCULA(D{r})&"-"&O{r};"")'

    # ── 4. Escreve na aba ──
    # Limpa tudo primeiro
    sh.values().clear(spreadsheetId=sheet_id, range=f'{aba}!A:Z').execute()
    time.sleep(0.5)

    sh.values().update(
        spreadsheetId=sheet_id,
        range=f'{aba}!A1',
        valueInputOption='USER_ENTERED',
        body={'values': out}
    ).execute()
    print(f"  Dados escritos ✓")
    time.sleep(1)

    # ── 5. Busca sheetId numérico ──
    meta = sh.get(spreadsheetId=sheet_id,
                  fields='sheets(properties(sheetId,title))').execute()
    sid = next(s['properties']['sheetId']
               for s in meta['sheets']
               if s['properties']['title'] == aba)

    # ── 6. Formatação ──
    n_rows = len(out) + 100  # margem para novas linhas
    requests = []

    # a) Cor e negrito do cabeçalho
    requests.append({"repeatCell": {
        "range": {"sheetId": sid, "startRowIndex": 0, "endRowIndex": 1,
                  "startColumnIndex": 0, "endColumnIndex": 20},
        "cell": {"userEnteredFormat": {
            "backgroundColor": HEADER_COLOR,
            "textFormat": {"bold": True, "foregroundColor": {"red":1,"green":1,"blue":1},
                           "fontFamily": "Montserrat", "fontSize": 10},
            "horizontalAlignment": "CENTER",
            "verticalAlignment": "MIDDLE"
        }},
        "fields": "userEnteredFormat"
    }})

    # b) Banding (listras alternadas) — remove existente antes de adicionar
    meta2 = sh.get(spreadsheetId=sheet_id,
                   fields='sheets(properties(sheetId),bandedRanges)').execute()
    for s in meta2['sheets']:
        if s['properties']['sheetId'] == sid:
            for br in s.get('bandedRanges', []):
                requests.append({"deleteBanding": {"bandedRangeId": br['bandedRangeId']}})

    requests.append({"addBanding": {"bandedRange": {
        "range": {"sheetId": sid, "startRowIndex": 1,
                  "startColumnIndex": 0, "endColumnIndex": 20},
        "rowProperties": {
            "headerColor": HEADER_COLOR,
            "firstBandColor": {"red":1,"green":1,"blue":1},
            "secondBandColor": {"red":0.95,"green":0.97,"blue":0.96}
        }
    }}})

    # c) Filtro automático
    requests.append({"setBasicFilter": {"filter": {
        "range": {"sheetId": sid, "startRowIndex": 0, "endRowIndex": 1,
                  "startColumnIndex": 0, "endColumnIndex": 20}
    }}})

    # d) Congelar linha de cabeçalho
    requests.append({"updateSheetProperties": {
        "properties": {"sheetId": sid, "gridProperties": {"frozenRowCount": 1}},
        "fields": "gridProperties.frozenRowCount"
    }})

    # e) Larguras de colunas
    for ci, w in enumerate(COL_WIDTHS):
        requests.append({"updateDimensionProperties": {
            "range": {"sheetId": sid, "dimension": "COLUMNS",
                      "startIndex": ci, "endIndex": ci+1},
            "properties": {"pixelSize": w},
            "fields": "pixelSize"
        }})

    # f) Proteção nas colunas de fórmula: M, Q, R (índices 12, 16, 17)
    # e nas de onEdit: S, T (índices 18, 19)
    protected_cols = [
        (12, 13, "Tipo de Vigência — fórmula automática"),
        (16, 18, "Códigos — fórmulas automáticas"),
        (18, 20, "Auditoria — preenchido pelo onEdit"),
    ]
    for start_ci, end_ci, desc in protected_cols:
        requests.append({"addProtectedRange": {"protectedRange": {
            "range": {"sheetId": sid, "startRowIndex": 1,
                      "startColumnIndex": start_ci, "endColumnIndex": end_ci},
            "description": desc,
            "warningOnly": False,
            "editors": {"users": EDITORS}
        }}})

    sh.batchUpdate(spreadsheetId=sheet_id, body={"requests": requests}).execute()
    print(f"  Formatação e proteção aplicadas ✓")
    time.sleep(1)


def main():
    svc = build_service()
    print("Credenciais OK ✓")
    print(f"Planilha: {SHEET_ID}\n")

    for aba in FILIAIS:
        try:
            reestruturar_aba(svc, SHEET_ID, aba)
        except Exception as e:
            print(f"  ERRO em {aba}: {e}")

    print("\n\nConcluído!")

if __name__ == '__main__':
    main()
