"""
Script 4 — Corrigir fórmulas Código do Negócio e Código de Matéria
====================================================================
Problema: as fórmulas nas colunas Q e R estavam usando separador de argumento
inglês (vírgula ",") mas a planilha está em PT-BR (usa ponto-e-vírgula ";").
Resultado: #ERROR! em todas as células.

Este script reescreve as fórmulas com a sintaxe PT-BR correta.

Como usar:
  python3 04_corrigir_codigos.py
"""

import time
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

CREDS_FILE = '/Users/giovanavilhena/Downloads/gestao-documental-490513-6734fdef6574.json'
SHEET_ID = '1C0T6flQ_5I8FlAxhMmcxLu713F-48EWTvc_4AIZw98U'  # cópia
# SHEET_ID = '1ooKBidxuw8_WhcW93TpnFqMZ354d1BMaaoBq5tzpE6Q'  # original

FILIAIS = ['Matriz', 'Filial PA', 'Filial CE', 'Filial MA',
           'Filial SC', 'Filial BA', 'Filial DF', 'Filial SP']

EDITORS = [
    'giovana.vilhena@monteiro.adv.br',
    'drive-831@gestao-documental-490513.iam.gserviceaccount.com'
]

def build_service():
    scopes = ['https://www.googleapis.com/auth/spreadsheets']
    creds = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
    return build('sheets', 'v4', credentials=creds)

def corrigir_aba(svc, sheet_id, aba):
    sh = svc.spreadsheets()

    # Descobre quantas linhas de dados tem a aba
    raw = sh.values().get(
        spreadsheetId=sheet_id,
        range=f'{aba}!B:B',
        valueRenderOption='FORMATTED_VALUE'
    ).execute().get('values', [])

    n_rows = len(raw)  # inclui header
    if n_rows < 2:
        print(f"  {aba}: sem dados, pulando")
        return

    print(f"  {aba}: corrigindo linhas 2 a {n_rows}...")

    # Monta lote de fórmulas para Q e R
    q_values = []
    r_values = []
    m_values = []

    # Header na linha 1 da Matriz é linha 1 (Script 1 já corrigiu isso)
    # Dados começam na linha 2
    for r in range(2, n_rows + 1):
        # Col Q: Código do Negócio
        q_values.append([f'=SE(B{r}<>"";MAIÚSCULA(B{r})&"-"&MAIÚSCULA(D{r});"")'])
        # Col R: Código de Matéria
        r_values.append([f'=SE(B{r}<>"";MAIÚSCULA(B{r})&"-"&MAIÚSCULA(D{r})&"-"&O{r};"")'])
        # Col M: Tipo de Vigência
        m_values.append([
            f'=SE(E(L{r}<>"";J{r}<>"");'
            f'SE(DATADIF(J{r};L{r};"D")<=365;"Renovável";"Por Escopo");"")'
        ])

    updates = [
        {'range': f'{aba}!Q2:Q{n_rows}', 'values': q_values},
        {'range': f'{aba}!R2:R{n_rows}', 'values': r_values},
        {'range': f'{aba}!M2:M{n_rows}', 'values': m_values},
    ]

    sh.values().batchUpdate(
        spreadsheetId=sheet_id,
        body={'valueInputOption': 'USER_ENTERED', 'data': updates}
    ).execute()

    print(f"  {aba}: ✓")
    time.sleep(1)

def main():
    svc = build_service()
    print(f"Corrigindo fórmulas PT-BR em todas as filiais...")
    print(f"Planilha: {SHEET_ID}\n")

    for aba in FILIAIS:
        try:
            corrigir_aba(svc, SHEET_ID, aba)
        except Exception as e:
            print(f"  ERRO em {aba}: {e}")

    print("\n✓ Fórmulas corrigidas!")
    print("  Abra a planilha e confira se Q e R mostram os códigos (ex: AC-BRASILÉIA-FPM)")

if __name__ == '__main__':
    main()
