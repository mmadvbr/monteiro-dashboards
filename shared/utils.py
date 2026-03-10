"""
Funções utilitárias compartilhadas entre os dashboards.
"""

import pandas as pd
import gspread
from typing import Optional


def carregar_aba(
    client: gspread.Client,
    file_id: str,
    sheet_name: str,
    expected_headers: Optional[list] = None,
) -> tuple:
    """
    Carrega uma aba do Google Sheets e retorna como DataFrame.

    Se expected_headers for fornecido, tenta usar. Em caso de falha,
    faz fallback para leitura sem headers esperados.

    Returns:
        Tupla (DataFrame, status) onde status é 'ok', 'fallback' ou 'error'.
    """
    try:
        sh = client.open_by_key(file_id)
        ws = sh.worksheet(sheet_name)

        if expected_headers:
            try:
                data = ws.get_all_records(expected_headers=expected_headers)
                return pd.DataFrame(data), "ok"
            except Exception:
                data = ws.get_all_records()
                return pd.DataFrame(data), "fallback"
        else:
            data = ws.get_all_records()
            return pd.DataFrame(data), "ok"

    except Exception as e:
        print(f"  ❌ Erro ao carregar '{sheet_name}': {str(e)[:120]}")
        return pd.DataFrame(), "error"


def carregar_aba_raw(
    client: gspread.Client,
    file_id: str,
    sheet_name: str,
    header_row: int = 0,
) -> pd.DataFrame:
    """
    Carrega uma aba usando get_all_values (bruto) e permite
    especificar qual linha é o header. Útil para abas com
    linhas em branco antes do header real (ex: aba Matriz).

    Args:
        header_row: Índice da linha que contém o header (0-based).
    """
    sh = client.open_by_key(file_id)
    ws = sh.worksheet(sheet_name)
    raw = ws.get_all_values()

    if not raw or header_row >= len(raw):
        return pd.DataFrame()

    header = raw[header_row]
    dados = raw[header_row + 1 :]

    df = pd.DataFrame(dados, columns=header)

    # Remover colunas com nome vazio
    df = df.loc[:, df.columns.str.strip() != ""]

    # Remover linhas totalmente vazias
    df = df[~df.astype(str).apply(lambda x: x.str.strip()).eq("").all(axis=1)]

    return df


def contar_vazios(df: pd.DataFrame, coluna: str) -> int:
    """Conta valores vazios (NaN, None, string vazia) em uma coluna."""
    if coluna not in df.columns:
        return -1
    return (df[coluna].isna() | (df[coluna].astype(str).str.strip() == "")).sum()


def encontrar_coluna(df: pd.DataFrame, nome: str) -> Optional[str]:
    """
    Encontra uma coluna no DataFrame por nome aproximado (case-insensitive).
    Retorna o nome exato da coluna ou None.
    """
    if nome in df.columns:
        return nome

    for col in df.columns:
        if col.strip().lower() == nome.strip().lower():
            return col

    for col in df.columns:
        if nome.lower() in col.lower():
            return col

    return None


def print_section(titulo: str, char: str = "=", width: int = 60):
    """Imprime um separador de seção formatado."""
    print(f"\n{char * width}")
    print(f"  {titulo}")
    print(f"{char * width}")
