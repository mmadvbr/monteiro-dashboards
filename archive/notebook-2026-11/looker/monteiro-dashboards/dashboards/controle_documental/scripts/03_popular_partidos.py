"""
Script 3 — Popular colunas de Partido na Base Única
=====================================================
O que faz:
  - Lê a Base Única (já criada pelo Script 2)
  - Para cada município, consulta o BigQuery (basedosdados.br_tse_eleicoes)
    para buscar o partido do prefeito eleito em 2020 e 2024
  - Escreve Partido 2020 (col AA), Partido 2024 (col AB) na Base Única
  - Partido 2028 (col AC) fica vazio por enquanto (eleição futura)
  - Partido Fechamento (col AD): se Data Assinatura Contrato < 01/01/2025
    → usa Partido 2020, senão → usa Partido 2024

Pré-requisito:
  - BigQuery API habilitada no projeto gestao-documental-490513
  - Service account com papel BigQuery Data Viewer

Como usar:
  python3 03_popular_partidos.py
"""

import re
import time
from datetime import datetime
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Tenta importar BigQuery (pode precisar: pip install google-cloud-bigquery)
try:
    from google.cloud import bigquery
    BQ_OK = True
except ImportError:
    BQ_OK = False
    print("AVISO: google-cloud-bigquery não instalado.")
    print("  Instale com: pip3 install google-cloud-bigquery")

# ── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
CREDS_FILE = '/Users/giovanavilhena/Downloads/gestao-documental-490513-6734fdef6574.json'
GCP_PROJECT = 'gestao-documental-490513'

SHEET_ID = '1C0T6flQ_5I8FlAxhMmcxLu713F-48EWTvc_4AIZw98U'  # cópia
# SHEET_ID = '1ooKBidxuw8_WhcW93TpnFqMZ354d1BMaaoBq5tzpE6Q'  # original

# ── SQL ───────────────────────────────────────────────────────────────────────
# Busca prefeitos eleitos em 2020 e 2024 no Brasil inteiro
# Fonte pública: basedosdados.br_tse_eleicoes.resultados_candidato
SQL_PARTIDOS = """
SELECT
  sigla_uf,
  nome_municipio,
  ano_eleicao,
  sigla_partido
FROM `basedosdados.br_tse_eleicoes.resultados_candidato`
WHERE
  descricao_cargo = 'PREFEITO'
  AND descricao_situacao_candidatura IN ('ELEITO', 'ELEITO POR QP', 'ELEITO POR MEDIA')
  AND ano_eleicao IN (2020, 2024)
  AND turno = 1
"""

# ── FUNÇÕES ───────────────────────────────────────────────────────────────────

def norm(s):
    return re.sub(r'[\s\n\r]+', ' ', str(s).strip().lower())

def build_sheets_service():
    scopes = ['https://www.googleapis.com/auth/spreadsheets']
    creds = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
    return build('sheets', 'v4', credentials=creds)

def build_bq_client():
    from google.oauth2.service_account import Credentials as SACredentials
    from google.cloud import bigquery

    creds = SACredentials.from_service_account_file(
        CREDS_FILE,
        scopes=['https://www.googleapis.com/auth/bigquery']
    )
    return bigquery.Client(project=GCP_PROJECT, credentials=creds)

def carregar_partidos_bq():
    """
    Baixa dados do TSE via BigQuery.
    Retorna dict: (uf, norm(municipio), ano) → sigla_partido
    """
    if not BQ_OK:
        return {}

    print("Consultando BigQuery (TSE)...")
    try:
        bq = build_bq_client()
        df = bq.query(SQL_PARTIDOS).to_dataframe()
        print(f"  {len(df)} registros retornados")

        partidos = {}
        for _, row in df.iterrows():
            key = (str(row['sigla_uf']).upper(),
                   norm(str(row['nome_municipio'])),
                   int(row['ano_eleicao']))
            partidos[key] = str(row['sigla_partido']).upper()

        print(f"  {len(partidos)} entradas únicas indexadas")
        return partidos

    except Exception as e:
        print(f"  ERRO BigQuery: {e}")
        print("  Verifique se a BigQuery API está habilitada e a SA tem acesso.")
        return {}

def parse_data(s):
    """Tenta parsear data em formatos comuns. Retorna datetime ou None."""
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(str(s).strip(), fmt)
        except ValueError:
            continue
    return None

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    svc = build_sheets_service()
    sh = svc.spreadsheets()

    # 1. Baixa partidos do BQ
    partidos = carregar_partidos_bq()
    if not partidos:
        print("Sem dados de partidos. Encerrando.")
        return

    # 2. Lê Base Única
    print("\nLendo Base Única...")
    raw = sh.values().get(
        spreadsheetId=SHEET_ID,
        range='Base Única!A1:AD7000',
        valueRenderOption='FORMATTED_VALUE'
    ).execute().get('values', [])

    header = raw[0]
    rows = raw[1:]
    print(f"  {len(rows)} linhas de dados")

    # Mapeia índices (0-based, coluna A = índice 0)
    # UF = col V = índice 21
    # Município = col W = índice 22
    # Data Assinatura Contrato = col J = índice 9
    # Partido 2020 = col AA = índice 26
    # Partido 2024 = col AB = índice 27
    # Partido 2028 = col AC = índice 28
    # Partido Fechamento = col AD = índice 29

    corte_2025 = datetime(2025, 1, 1)
    updates = []

    for i, row in enumerate(rows):
        padded = (row + [''] * 30)[:30]

        uf = str(padded[21]).strip().upper()[:2]
        mun = norm(padded[22])

        p2020 = partidos.get((uf, mun, 2020), '')
        p2024 = partidos.get((uf, mun, 2024), '')

        data_ass_str = padded[9]  # Data Assinatura Contrato
        data_ass = parse_data(data_ass_str) if data_ass_str else None

        if data_ass and data_ass < corte_2025:
            fechamento = p2020
        else:
            fechamento = p2024

        # Só atualiza linhas onde mudou algo
        if any([p2020, p2024, fechamento]):
            updates.append({
                'row_idx': i + 2,  # +2 porque header é row 1, dados começam no 2
                'p2020': p2020,
                'p2024': p2024,
                'fechamento': fechamento,
            })

    print(f"  {len(updates)} linhas com dados de partido\n")

    # 3. Escreve em lote
    print("Escrevendo partidos...")
    data_updates = []
    for u in updates:
        r = u['row_idx']
        # AA=26, AB=27, AC=28, AD=29 → colunas AA:AD
        data_updates.append({
            'range': f'Base Única!AA{r}:AD{r}',
            'values': [[u['p2020'], u['p2024'], '', u['fechamento']]]
        })

    # batchUpdate em grupos de 500
    BATCH = 500
    for start in range(0, len(data_updates), BATCH):
        chunk = data_updates[start:start+BATCH]
        sh.values().batchUpdate(
            spreadsheetId=SHEET_ID,
            body={
                'valueInputOption': 'RAW',
                'data': chunk
            }
        ).execute()
        print(f"  Escritas {min(start+BATCH, len(data_updates))}/{len(data_updates)}")
        time.sleep(0.5)

    print(f"\n✓ Partidos preenchidos: {len(updates)} linhas")

if __name__ == '__main__':
    main()
