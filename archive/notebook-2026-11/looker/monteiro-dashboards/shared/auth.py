"""
Módulo de autenticação com APIs do Google.
Suporta execução local (credentials.json) e Google Colab.
"""

import os
import gspread
from google.oauth2.service_account import Credentials


SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/bigquery",
]


def get_gspread_client() -> gspread.Client:
    """
    Retorna um client gspread autenticado.

    Tenta autenticação por Service Account (credentials.json).
    Se falhar, tenta autenticação via Google Colab.
    """

    # Tentativa 1: Service Account (execução local ou Cloud)
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credentials.json")
    if os.path.exists(creds_path):
        credentials = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        client = gspread.authorize(credentials)
        print("✅ Autenticado via Service Account")
        return client

    # Tentativa 2: Google Colab
    try:
        from google.colab import auth
        from google.auth import default

        auth.authenticate_user()
        credentials, _ = default()
        client = gspread.authorize(credentials)
        print("✅ Autenticado via Google Colab")
        return client
    except ImportError:
        pass

    raise RuntimeError(
        "Não foi possível autenticar. Certifique-se de que:\n"
        "  - O arquivo credentials.json existe no caminho configurado, ou\n"
        "  - Você está executando no Google Colab."
    )
