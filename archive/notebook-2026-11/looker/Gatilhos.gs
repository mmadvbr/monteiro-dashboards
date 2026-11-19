/**
 * ============================================================
 * Gatilhos.gs — Roteamento de Triggers (SINGLE TRIGGER)
 * Monteiro e Monteiro — Controle Documental v3.0
 * ============================================================
 * 
 * REGRA 2: UM ÚNICO onEdit, UM ÚNICO onOpen.
 * Estas funções atuam apenas como roteadores — chamam funções
 * específicas em outros módulos baseado na aba/coluna editada.
 */


// ═══════════════════════════════════════════════════════════
// MENU (onOpen)
// ═══════════════════════════════════════════════════════════

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 Monteiro Tools')
    .addItem('➕ Novo registro', 'abrirSidebar')
    .addItem('✏️ Editar registro selecionado', 'abrirSidebarEditar')
    .addSeparator()
    .addItem('🔄 Reprocessar auto-preenchimento (bulk)', 'reprocessarAutoPreench')
    .addItem('🏙️ Preencher população via IBGE (bulk)', 'preencherPopulacaoBulk')
    .addItem('🗳️ Preencher partidos via TSE (BigQuery)', 'preencherPartidosTSE')
    .addItem('📅 Preencher Tipo de Vigência (bulk)', 'preencherTipoVigenciaBulk')
    .addItem('⏰ Verificar vencimentos agora', 'verificarVencimentosV2')
    .addItem('🔍 Diagnóstico municípios sem match', 'diagnosticoSemMatch')
    .addSeparator()
    .addSubMenu(ui.createMenu('📋 Matérias')
      .addItem('🔍 Diagnóstico de matérias', 'diagnosticoMaterias')
      .addItem('✏️ Aplicar correções + atualizar dropdown', 'aplicarMateriasEAtualizarDropdown')
      .addItem('➕ Adicionar nova matéria', 'adicionarNovaMateria'))
    .addSeparator()
    .addSubMenu(ui.createMenu('📦 BigQuery')
      .addItem('🏗️ Criar dataset + tabela (1ª vez)', 'bqCriarDatasetETabela')
      .addItem('📤 Exportar agora', 'bqExportarAgora')
      .addSeparator()
      .addItem('⏰ Agendar exportação diária (06h)', 'bqAgendarExportacao')
      .addItem('🚫 Remover agendamento', 'bqRemoverAgendamento'))
      .addSeparator()
      .addItem('📊 Relatório de exclusões', 'gerarRelatorioExclusoes')
      .addSeparator()
      .addSubMenu(ui.createMenu('⚙️ Administração')
      .addItem('🚀 Aplicar TUDO (melhorias + formatação)', 'aplicarTudo')
      .addItem('🎨 Aplicar identidade visual', 'aplicarIdentidadeVisual')
      .addItem('🔒 Proteger colunas auto', 'protegerColunasAuto')
      .addItem('🎨 Formatação condicional', 'aplicarFormatacaoCondicional')
      .addSeparator()
      .addItem('Instalar automações', 'instalarAutomacoes')
      .addItem('Remover automações', 'removerAutomacoes')
      .addSeparator()
      .addItem('Script 1 — Criar Estrutura', 'criarEstrutura')
      .addItem('Script 2 — Unificar Abas', 'unificarAbas')
      .addItem('Script 3A — Saneamento', 'executarSaneamento')
      .addItem('Script 3B — Aplicar Matérias', 'aplicarMateriasEAtualizarDropdown')
      .addItem('Script 4 — Deduplicar', 'deduplicar')
      .addSeparator()
      .addItem('Limpar Municípios + Regenerar UF-Município', 'limparMunicipiosERegenF')
      .addItem('Reconstruir AUX_MUNICIPIOS', 'reconstruirAuxMunicipios')
      .addItem('Instalar trigger anual TSE', 'instalarTriggerAnualTSE')
      .addItem('Aplicar dropdown Município (bulk)', 'aplicarDropdownMunicipioBulk'))
    .addSeparator()
    .addItem('ℹ️ Sobre', 'mostrarSobre')
    .addToUi();
}


// ═══════════════════════════════════════════════════════════
// ROTEADOR onEdit (SINGLE TRIGGER)
// ═══════════════════════════════════════════════════════════

/**
 * Único handler de onEdit (trigger instalável).
 * Roteia para funções específicas com base na aba e coluna.
 */
function onEditHandler(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var nomeAba = sheet.getName();

    // Só processa edições na Base Única
    if (nomeAba !== CONFIG.ABAS.BASE_UNICA) return;

    var row = e.range.getRow();
    var col = e.range.getColumn();
    if (row < 2) return; // Ignora header

    var C = CONFIG.COL1; // Atalho para colunas 1-based

    // ── Rota 1: UF alterada (col D) ─────────────────────
    if (col === C.UF) {
      roteiroEditUF_(sheet, row);
    }

    // ── Rota 2: Município alterado (col E) ──────────────
    if (col === C.MUNICIPIO) {
      roteiroEditMunicipio_(sheet, row);
    }

    // ── Rota 3: Datas de contrato (M, N, P) → recalcular vigência
    if (col === C.ASS_CONTRATO || col === C.ASS_ADITIVO || col === C.VALIDADE) {
      roteiroEditVigencia_(sheet, row);
    }

    // ── Rota 4: Timestamp + autor (sempre, exceto W e Y)
    if (col !== C.DATA_MODIFICACAO && col !== C.MODIFICADO_POR) {
      roteiroEditTimestamp_(sheet, row);
    }

  } catch (err) {
    Logger.log('Erro no onEditHandler: ' + err.message);
  }
}


// ── Sub-rotinas do onEdit (delegam para módulos) ──────────

function roteiroEditUF_(sheet, row) {
  atualizarDropdownMunicipio_(sheet, row);
  // Região (MAIÚSCULO)
  var uf = String(sheet.getRange(row, CONFIG.COL1.UF).getValue()).trim();
  if (uf && CONFIG.UF_REGIAO[uf]) {
    sheet.getRange(row, CONFIG.COL1.REGIAO).setValue(CONFIG.UF_REGIAO[uf]);
  }
  atualizarUFMunicipio_(sheet, row);
}

function roteiroEditMunicipio_(sheet, row) {
  autoPreencherDadosMunicipio_(sheet, row);
  atualizarUFMunicipio_(sheet, row);
  autoPreencherPartido_(sheet, row);
  // Região MAIÚSCULO (reforço)
  var uf = String(sheet.getRange(row, CONFIG.COL1.UF).getValue()).trim();
  if (uf && CONFIG.UF_REGIAO[uf]) {
    sheet.getRange(row, CONFIG.COL1.REGIAO).setValue(CONFIG.UF_REGIAO[uf]);
  }
}

function roteiroEditVigencia_(sheet, row) {
  var C = CONFIG.COL1;
  var assC = sheet.getRange(row, C.ASS_CONTRATO).getValue();
  var assA = sheet.getRange(row, C.ASS_ADITIVO).getValue();
  var val  = sheet.getRange(row, C.VALIDADE).getValue();
  sheet.getRange(row, C.TIPO_VIGENCIA).setValue(calcularTipoVigencia_(val, assC, assA));
}

function roteiroEditTimestamp_(sheet, row) {
  var C = CONFIG.COL1;
  sheet.getRange(row, C.DATA_MODIFICACAO).setValue(new Date());
  try {
    var email = Session.getActiveUser().getEmail();
    if (email) sheet.getRange(row, C.MODIFICADO_POR).setValue(email);
  } catch (e) {}
}

/** Gera "UF - Município" na coluna F. */
function atualizarUFMunicipio_(sheet, row) {
  var C = CONFIG.COL1;
  var uf = String(sheet.getRange(row, C.UF).getValue()).trim();
  var mun = String(sheet.getRange(row, C.MUNICIPIO).getValue()).trim();
  sheet.getRange(row, C.UF_MUNICIPIO).setValue(
    (uf && mun) ? uf + ' - ' + mun : (uf || mun || '')
  );
}


// ═══════════════════════════════════════════════════════════
// INSTALAÇÃO / REMOÇÃO DE TRIGGERS
// ═══════════════════════════════════════════════════════════

function instalarAutomacoes() {
  removerTriggersProjeto_();

  ScriptApp.newTrigger('onEditHandler')
    .forSpreadsheet(getSS_())
    .onEdit()
    .create();

  ScriptApp.newTrigger('verificarVencimentosV2')
    .timeBased()
    .atHour(11) // UTC = 08:00 BRT
    .everyDays(1)
    .create();

  Logger.log('Automações instaladas: onEdit + alerta diário 08:00 BRT');
  alertaSafe_('✅ Automações instaladas',
    'Triggers configurados:\n\n'
    + '1. onEdit — dropdown, auto-preenchimento, vigência, timestamp+e-mail\n'
    + '2. Diário 08:00 — alerta de vencimento');
}

function removerAutomacoes() {
  removerTriggersProjeto_();
  alertaSafe_('✅ Automações removidas', 'Todos os triggers desinstalados.');
}

function removerTriggersProjeto_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);
  Logger.log('Removidos ' + triggers.length + ' triggers.');
}


// ═══════════════════════════════════════════════════════════
// SOBRE
// ═══════════════════════════════════════════════════════════

function mostrarSobre() {
  alertaSafe_('ℹ️ Monteiro Tools',
    'Controle Documental — Monteiro e Monteiro\n'
    + 'Versão: ' + CONFIG.VERSAO + ' · ' + CONFIG.DATA_VERSAO + '\n'
    + 'Responsável: ' + CONFIG.RESPONSAVEL + '\n\n'
    + 'Arquitetura:\n'
    + '  Config.gs — Configuração centralizada\n'
    + '  Gatilhos.gs — Roteamento de triggers\n'
    + '  Utils.gs — Funções utilitárias\n'
    + '  Estrutura.gs — Criar Base Única\n'
    + '  Unificacao.gs — Consolidar abas\n'
    + '  Saneamento.gs — Limpeza de dados\n'
    + '  Dedup.gs — Deduplicação\n'
    + '  Integracao.gs — IBGE + TSE\n'
    + '  Formatacao.gs — Visual + proteção\n'
    + '  Sidebar.gs — Formulário lateral');
}
