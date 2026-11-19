# Monteiro Dashboards

Repositório de dashboards analíticos do escritório **Monteiro e Monteiro — Advogados Associados**.

Centraliza os pipelines de dados (diagnóstico, saneamento, ETL) e a documentação dos dashboards utilizados pela operação.

---

## Stack

| Camada           | Tecnologia                               |
| ---------------- | ---------------------------------------- |
| Origem dos dados | Google Sheets (input manual)             |
| Linguagem        | Python 3.10+                             |
| Data Warehouse   | Google BigQuery                          |
| Visualização     | Looker Studio                            |
| Orquestração     | Google Cloud Functions / Cloud Scheduler |
| Versionamento    | Git / GitHub                             |

---

## Estrutura do Repositório

```
monteiro-dashboards/
│
├── dashboards/
│   └── controle_documental/       # Dashboard de Controle Documental (Filiais)
│       ├── 01_diagnostico/        # Scripts de análise de qualidade da base
│       ├── 02_saneamento/         # Scripts de correção e limpeza dos dados
│       ├── 03_etl/                # Pipeline de extração, transformação e carga
│       ├── 04_looker/             # Configurações e docs do Looker Studio
│       └── docs/                  # Documentação do dashboard
│
├── shared/                        # Módulos compartilhados entre dashboards
│   ├── config.py                  # Constantes e IDs de planilhas
│   ├── auth.py                    # Autenticação com APIs Google
│   └── utils.py                   # Funções utilitárias
│
├── .gitignore
├── .env.example
├── requirements.txt
└── README.md
```

---

## Dashboards

### 1. Controle Documental (Filiais)

Acompanhamento da situação documental dos negócios por filial — contratos, procurações, kits e publicações.

| Item       | Detalhe                                       |
| ---------- | --------------------------------------------- |
| Status     | Em desenvolvimento                            |
| Fonte      | Google Sheets (8 abas de filiais + dimensões) |
| Destino    | BigQuery → Looker Studio                      |
| Fase atual | Diagnóstico e saneamento da base              |

Veja a documentação completa em `dashboards/controle_documental/README.md`

---

## Setup Local

### Pré-requisitos

- Python 3.10+
- Conta Google com acesso às planilhas do projeto
- Arquivo `credentials.json` do Google Cloud (Service Account)

### Instalação

```bash
git clone https://github.com/mmadvbr/monteiro-dashboards.git
cd monteiro-dashboards

python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

pip install -r requirements.txt

cp .env.example .env
# Editar .env com os valores reais
```

### Configuração do Google Cloud

1. Criar (ou acessar) um projeto no Google Cloud Console
2. Ativar as APIs: Google Sheets, Google Drive, BigQuery
3. Criar uma Service Account e baixar o `credentials.json`
4. Compartilhar as planilhas do projeto com o e-mail da Service Account

---

## Padrão de Commits

```
tipo: descrição curta

Tipos:
  feat     — nova funcionalidade ou script
  fix      — correção de bug ou dado
  docs     — documentação
  refactor — refatoração sem mudança de comportamento
  data     — alteração em dados ou dimensões
  chore    — tarefas administrativas
```

---

## Responsáveis

| Papel                   | Contato                                          |
| ----------------------- | ------------------------------------------------ |
| Infraestrutura de dados | Tecnologia Monteiro (tecnologia@monteiro.adv.br) |
