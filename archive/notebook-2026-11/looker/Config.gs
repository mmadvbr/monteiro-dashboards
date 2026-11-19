/**
 * ============================================================
 * Config.gs — Configuração Centralizada
 * Monteiro e Monteiro — Controle Documental v3.0
 * Responsável: Giovana Vilhena
 * ============================================================
 * 
 * REGRA 3: Toda configuração aqui. Zero hardcoding nos demais.
 * Cole este arquivo PRIMEIRO no Apps Script Editor.
 */

var CONFIG = {

  // ─── Planilha principal ─────────────────────────────────
  SPREADSHEET_ID: '1P_dt08v018H3-DQuvUb1YP0e3Os6QObjisOCWMv78PI',

  // ─── Dimensões (planilhas externas) ─────────────────────
  DIM_MATERIA_ID:   '1qzH-4xYpT5SBEEjLMi-7WxNHWbpqvgZTAbTNWJ1yOo8',
  DIM_ESTADO_ID:    '18orVoM2XgFkgA5mbe-rHl115V3g9md-0nId34dUbAM4',
  DIM_FILIAL_ID:    '1mS8oxE0-4lK1fzXbtA6Wz871ucxfEi1z8n6q_EKepG0',
  DIM_MUNICIPIO_ID: '1_78YOxB2yVWG_IQAL-SBA43MyEJh5LxOuDu2JMnD-P4',

  // ─── Nomes de abas ─────────────────────────────────────
  ABAS: {
    BASE_UNICA:      'Base Única',
    LOG_UNIFICACAO:  'LOG_UNIFICACAO',
    LOG_SANEAMENTO:  'LOG_SANEAMENTO',
    LOG_DUPLICATAS:  'LOG_DUPLICATAS',
    DIAG_MATERIAS:   'DIAG_MATERIAS',
    AUX_MUNICIPIOS:  'AUX_MUNICIPIOS',
    AUX_DADOS:       'AUX_DADOS',
    VARIAVEIS:       'VARIÁVEIS',
    PARCEIROS:       'PARCEIROS',
    RELATORIO_EXCL:  'RELATORIO_EXCLUSOES'
  },

  // ─── Abas-fonte → Filial (formato novo) ────────────────
  ABAS_FONTE: {
    'Matriz':     'MATRIZ',
    'Filial BA':  'FILIAL-BA',
    'Filial PA':  'FILIAL-PA',
    'Filial DF':  'FILIAL-DF',
    'Filial CE':  'FILIAL-CE',
    'Filial MA':  'FILIAL-MA',
    'Filial SP':  'FILIAL-SP',
    'Filial SC':  'FILIAL-SC'
  },

  // ─── Mapa de normalização: nome antigo → novo ──────────
  MAPA_FILIAIS: {
    'Matriz (Recife)':       'MATRIZ',
    'Filial BA (Salvador)':  'FILIAL-BA',
    'Filial PA (Belém)':     'FILIAL-PA',
    'Filial DF (Brasília)':  'FILIAL-DF',
    'Filial CE (Fortaleza)': 'FILIAL-CE',
    'Filial MA (São Luís)':  'FILIAL-MA',
    'Filial SP (São Paulo)': 'FILIAL-SP',
    'Filial SC':             'FILIAL-SC'
  },

  // ─── Listas para dropdowns ─────────────────────────────
  FILIAIS: ['MATRIZ','FILIAL-BA','FILIAL-CE','FILIAL-DF','FILIAL-MA','FILIAL-PA','FILIAL-SC','FILIAL-SP'],
  REGIOES: ['NORTE','NORDESTE','CENTRO-OESTE','SUDESTE','SUL'],
  STATUS_DOC: ['Sim','Não','Pendente'],
  TIPOS_VIGENCIA: ['Renovável 12m','Por escopo'],

  // ─── Índices de coluna (0-based para arrays) ───────────
  COL: {
    FILIAL:           0,   // A
    DATA_INCLUSAO:    1,   // B
    REGIAO:           2,   // C
    UF:               3,   // D
    MUNICIPIO:        4,   // E
    UF_MUNICIPIO:     5,   // F (auto)
    PARCEIROS:        6,   // G
    MATERIA:          7,   // H
    DATA_PUBLICACAO:  8,   // I
    CONTRATO:         9,   // J
    PROCURACAO:       10,  // K
    KIT_PREFEITO:     11,  // L
    ASS_CONTRATO:     12,  // M
    ASS_ADITIVO:      13,  // N
    TIPO_VIGENCIA:    14,  // O (auto)
    VALIDADE:         15,  // P
    VALOR:            16,  // Q
    PROCESSO:         17,  // R
    OBSERVACAO:       18,  // S
    POPULACAO:        19,  // T (auto)
    PARTIDO_2020:     20,  // U (auto)
    PARTIDO_2024:     21,  // V (auto)
    DATA_MODIFICACAO: 22,  // W (auto)
    COD_IBGE:         23,  // X (auto)
    MODIFICADO_POR:   24   // Y (auto)
  },

  // Colunas 1-based (para API do Sheets: getRange(row, col))
  COL1: {
    FILIAL:1, DATA_INCLUSAO:2, REGIAO:3, UF:4, MUNICIPIO:5,
    UF_MUNICIPIO:6, PARCEIROS:7, MATERIA:8, DATA_PUBLICACAO:9,
    CONTRATO:10, PROCURACAO:11, KIT_PREFEITO:12,
    ASS_CONTRATO:13, ASS_ADITIVO:14, TIPO_VIGENCIA:15,
    VALIDADE:16, VALOR:17, PROCESSO:18, OBSERVACAO:19,
    POPULACAO:20, PARTIDO_2020:21, PARTIDO_2024:22,
    DATA_MODIFICACAO:23, COD_IBGE:24, MODIFICADO_POR:25
  },

  // Colunas auto-preenchidas (1-based, para proteção)
  COLUNAS_AUTO: {
    3:  'Região',
    6:  'UF - Município',
    15: 'Tipo de Vigência',
    20: 'População do Município',
    21: 'Partido [2020-2024]',
    22: 'Partido [2024-2028]',
    23: 'Data Última Modificação',
    24: 'Código IBGE',
    25: 'Última Modificação Por'
  },

  // Total de colunas
  NUM_COLUNAS: 25,
  MAX_ROW_VALIDACAO: 6000,

  // ─── Headers da Base Única (A-Y) ───────────────────────
  HEADERS: [
    'Filial Responsável',          // A
    'Data Inclusão Planilha',      // B
    'Região',                      // C
    'UF',                          // D
    'Município',                   // E
    'UF - Município',              // F
    'Parceiros',                   // G
    'Matéria',                     // H
    'Data Publicação',             // I
    'Contrato',                    // J
    'Procuração',                  // K
    'Kit Prefeito',                // L
    'Assinatura Contrato',         // M
    'Assinatura Último Aditivo',   // N
    'Tipo de Vigência',            // O
    'Validade do Contrato/Aditivo',// P
    'Valor',                       // Q
    'Processo',                    // R
    'Observação',                  // S
    'População do Município',      // T
    'Partido [2020-2024]',         // U
    'Partido [2024-2028]',         // V
    'Data Última Modificação',     // W
    'Código IBGE',                 // X
    'Última Modificação Por'       // Y
  ],

  // Headers alternativos (para mapeamento na unificação)
  HEADERS_ALT: {
    'DATA':                           'Data Inclusão Planilha',
    'Data inclusão planilha':         'Data Inclusão Planilha',
    'Data inclusão Planilha':         'Data Inclusão Planilha',
    'data inclusão planilha':         'Data Inclusão Planilha',
    'Data publicação':                'Data Publicação',
    'data publicação':                'Data Publicação',
    'Assinatura contrato':            'Assinatura Contrato',
    'Validade do contrato/aditivo':   'Validade do Contrato/Aditivo',
    'Populaçao do Municipio':         'População do Município',
    'População do Municipio':         'População do Município'
  },

  // Colunas a ignorar das abas-fonte
  COLUNAS_IGNORAR: ['UF - Município', 'Agendor'],

  // ─── Mapa UF → Região ─────────────────────────────────
  UF_REGIAO: {
    'AC':'NORTE','AP':'NORTE','AM':'NORTE','PA':'NORTE','RO':'NORTE','RR':'NORTE','TO':'NORTE',
    'AL':'NORDESTE','BA':'NORDESTE','CE':'NORDESTE','MA':'NORDESTE','PB':'NORDESTE',
    'PE':'NORDESTE','PI':'NORDESTE','RN':'NORDESTE','SE':'NORDESTE',
    'DF':'CENTRO-OESTE','GO':'CENTRO-OESTE','MT':'CENTRO-OESTE','MS':'CENTRO-OESTE',
    'ES':'SUDESTE','MG':'SUDESTE','RJ':'SUDESTE','SP':'SUDESTE',
    'PR':'SUL','RS':'SUL','SC':'SUL'
  },

  // ─── Mapa UF → Filial (para prioridade geográfica) ────
  UF_FILIAL: {
    'PE':'MATRIZ','BA':'FILIAL-BA','PA':'FILIAL-PA','DF':'FILIAL-DF',
    'CE':'FILIAL-CE','MA':'FILIAL-MA','SP':'FILIAL-SP','SC':'FILIAL-SC'
  },

  // ─── Código UF IBGE → Sigla ───────────────────────────
  IBGE_UF: {
    '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
    '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
    '31':'MG','32':'ES','33':'RJ','35':'SP',
    '41':'PR','42':'SC','43':'RS',
    '50':'MS','51':'MT','52':'GO','53':'DF'
  },

  // ─── Identidade Visual ─────────────────────────────────
  VISUAL: {
    HEADER_BG:     '#356854',
    HEADER_COR:    '#FFFFFF',
    HEADER_FONTE:  'Montserrat',
    HEADER_TAM:    12,
    HEADER_ALTURA: 40,
    DADOS_FONTE:   'Montserrat',
    DADOS_TAM:     12,
    DADOS_ALTURA:  32,
    BANDING_1:     '#FFFFFF',
    BANDING_2:     '#F2F2F2',
    BORDA:         '#D9D9D9',
    SIM_BG:        '#C8E6C9',
    SIM_COR:       '#1B5E20',
    PENDENTE_BG:   '#FFCDD2',
    PENDENTE_COR:  '#B71C1C',
    NAO_BG:        '#FFF9C4',
    NAO_COR:       '#F57F17',
    RENOVAVEL_BG:  '#C8E6C9',
    RENOVAVEL_COR: '#1B5E20',
    ESCOPO_BG:     '#BBDEFB',
    ESCOPO_COR:    '#0D47A1'
  },

  // Larguras de coluna
  LARGURAS: {
    1:180, 2:130, 3:100, 4:45, 5:200, 6:180, 7:150, 8:200,
    9:120, 10:95, 11:95, 12:95, 13:140, 14:150, 15:130,
    16:150, 17:120, 18:240, 19:200, 20:120, 21:120, 22:120,
    23:150, 24:100, 25:180
  },

  // Colunas centralizadas (1-based)
  COLUNAS_CENTRALIZADAS: [4, 10, 11, 12, 15],

  // ─── API IBGE ──────────────────────────────────────────
  IBGE_URL: 'https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/last',
  // Sem CacheService — v3.2 usa aba permanente AUX_DADOS

  // ─── Dropdown normalização ─────────────────────────────
  MAPA_DROPDOWN: {
    'ok':'Sim', 'sim':'Sim', 'yes':'Sim', 's':'Sim',
    'não':'Não', 'nao':'Não', 'no':'Não', 'n':'Não',
    'pendente':'Pendente', 'pend':'Pendente', 'pend.':'Pendente',
    '-':'', 'n/a':''
  },

  // Colunas com dropdown Sim/Não/Pendente (0-based)
  COLUNAS_DROPDOWN_STATUS: [9, 10, 11],

  // ─── Colunas de data (0-based) ─────────────────────────
  COLUNAS_DATA: [
    { idx: 1,  nome: 'Data Inclusão Planilha' },
    { idx: 8,  nome: 'Data Publicação' },
    { idx: 12, nome: 'Assinatura Contrato' },
    { idx: 13, nome: 'Assinatura Último Aditivo' },
    { idx: 15, nome: 'Validade do Contrato/Aditivo' }
  ],

  // ─── Correções IBGE (nome planilha → nome IBGE) ────────
  CORRECOES_IBGE: {
    'camprestre|al':'campestre|al','major isiodoro|al':'major isidoro|al',
    'parintis|am':'parintins|am','piquetcarneiro|ce':'piquet carneiro|ce',
    'macgadinho|rs':'machadinho|rs','belneario pinhal|rs':'balneario pinhal|rs',
    'assu|rn':'acu|rn','iguaraci|pe':'iguaracy|pe','calcados|pe':'calcado|pe',
    'capoeira|pe':'capoeiras|pe','dona eusebia|mg':'dona euzebia|mg',
    'jaboatao|pe':'jaboatao dos guararapes|pe',
    'belem de sao francisco|pe':'belem do sao francisco|pe',
    'lagoa de ouro|pe':'lagoa do ouro|pe',
    'rio preto do eva|am':'rio preto da eva|am',
    'sao jose do brejo da cruz|pb':'sao jose do brejo do cruz|pb',
    'eldorado dos carajas|pa':'eldorado do carajas|pa',
    'alvorada do gurgeia|pi':'alvorada do gurgueia|pi',
    'lagoa do sao francisco|pi':'lagoa de sao francisco|pi',
    'morro d chapeu do piaui|pi':'morro do chapeu do piaui|pi',
    'passagem franca|pi':'passagem franca do piaui|pi',
    'bonfinopolis|mg':'bonfinopolis de minas|mg',
    'aparecida d oeste|sp':'aparecida doeste|sp',
    'lagoa nova|al':'lagoa nova|rn','alpercata|ma':'alpercata|mg',
    'sao tomas do aquino|mg':'sao tomas de aquino|mg',
    'barracao|rd':'barracao|rs','boa saude|rn':'januario cicco|rn'
  },

  // ─── Metadados ─────────────────────────────────────────
  VERSAO: '3.2',
  RESPONSAVEL: 'Giovana Vilhena',
  DATA_VERSAO: 'Março/2026'
};