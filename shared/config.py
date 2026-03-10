"""
Configurações e constantes do projeto Monteiro Dashboards.
IDs de planilhas, mapeamento de abas e headers esperados.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# Google Cloud
# ============================================================
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
BQ_DATASET = os.getenv("BQ_DATASET", "monteiro_bi")
BQ_LOCATION = os.getenv("BQ_LOCATION", "southamerica-east1")

# ============================================================
# Google Sheets — IDs das planilhas
# ============================================================
SHEET_FATO_ID = os.getenv(
    "SHEET_FATO_ID", "1ooKBidxuw8_WhcW93TpnFqMZ354d1BMaaoBq5tzpE6Q"
)

SHEET_DIMENSOES = {
    "d_materia": os.getenv(
        "SHEET_DIM_MATERIA_ID", "1qzH-4xYpT5SBEEjLMi-7WxNHWbpqvgZTAbTNWJ1yOo8"
    ),
    "d_estado": os.getenv(
        "SHEET_DIM_ESTADO_ID", "18orVoM2XgFkgA5mbe-rHl115V3g9md-0nId34dUbAM4"
    ),
    "d_filial": os.getenv(
        "SHEET_DIM_FILIAL_ID", "1mS8oxE0-4lK1fzXbtA6Wz871ucxfEi1z8n6q_EKepG0"
    ),
    "d_municipio": os.getenv(
        "SHEET_DIM_MUNICIPIO_ID", "1_78YOxB2yVWG_IQAL-SBA43MyEJh5LxOuDu2JMnD-P4"
    ),
}

# ============================================================
# Mapeamento de abas (filiais)
# ============================================================
ABAS_FILIAIS = {
    "Matriz": 1,
    "Filial BA": 2,
    "Filial PA": 3,
    "Filial DF": 4,
    "Filial CE": 5,
    "Filial MA": 6,
    "Filial SP": 7,
    "Filial SC": 8,
}

# ============================================================
# Headers esperados na planilha de acompanhamento
# ============================================================
HEADERS_ESPERADOS = [
    "Data inclusão planilha",
    "Região",
    "UF",
    "Município",
    "UF - Município",
    "Parceiros",
    "Matéria",
    "Data\nPublicação",
    "Contrato",
    "Procuração",
    "Kit\nPrefeito",
    "Agendor",
    "Assinatura\nContrato",
    "Assinatura Último \nAditivo",
    "Validade do \nContrato/Aditivo",
    "Valor",
    "Processo",
    "Observação",
]

# ============================================================
# Campos obrigatórios (filtro do ETL)
# ============================================================
CAMPOS_OBRIGATORIOS = ["Região", "UF", "Município", "Matéria"]

# ============================================================
# Colunas de data e formato esperado
# ============================================================
COLUNAS_DATA = {
    "Data inclusão planilha": "Data inclusão",
    "Data\nPublicação": "Data Publicação",
    "Assinatura\nContrato": "Assinatura Contrato",
    "Assinatura Último \nAditivo": "Último Aditivo",
    "Validade do \nContrato/Aditivo": "Validade Contrato",
}

FORMATO_DATA = "%d/%m/%Y"

# ============================================================
# Sheet name padrão das dimensões
# ============================================================
SHEET_NAME_DIMENSAO = "data"
