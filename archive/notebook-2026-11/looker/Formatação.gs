/**
 * ============================================================
 * Formatacao.gs — Identidade Visual, Proteção, Relatórios, E-mail
 * Monteiro e Monteiro — Controle Documental v3.0
 * ============================================================
 * 
 * REGRA 4: Formatação aplicada em ranges grandes, não célula a célula.
 */


// ═══════════════════════════════════════════════════════════
// IDENTIDADE VISUAL
// ═══════════════════════════════════════════════════════════

function aplicarIdentidadeVisual() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet) { alertaSafe_('❌', 'Base Única não encontrada.'); return; }
  Logger.log('═══ Identidade Visual ═══');

  var V = CONFIG.VISUAL;
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var numCols = CONFIG.NUM_COLUNAS;

  // Header: limpar quebras de linha + formatar
  var headerVals = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  var mudou = false;
  for (var c = 0; c < headerVals.length; c++) {
    var limpo = String(headerVals[c]).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (limpo !== headerVals[c]) { headerVals[c] = limpo; mudou = true; }
  }
  if (mudou) sheet.getRange(1, 1, 1, numCols).setValues([headerVals]);

  formatarHeader_(sheet, numCols);

  // Dados: fonte Montserrat 12, sem negrito (BATCH)
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, numCols)
      .setFontFamily(V.DADOS_FONTE).setFontSize(V.DADOS_TAM)
      .setFontWeight('normal').setVerticalAlignment('middle');

    for (var r = 2; r <= lastRow; r++) sheet.setRowHeight(r, V.DADOS_ALTURA);

    // Centralizar colunas de status e UF (BATCH)
    for (var i = 0; i < CONFIG.COLUNAS_CENTRALIZADAS.length; i++) {
      sheet.getRange(2, CONFIG.COLUNAS_CENTRALIZADAS[i], lastRow - 1, 1).setHorizontalAlignment('center');
    }
  }

  // Banding + bordas
  aplicarBanding_(sheet);
  if (lastRow > 1) {
    sheet.getRange(1, 1, lastRow, numCols)
      .setBorder(true, true, true, true, true, true, V.BORDA, SpreadsheetApp.BorderStyle.SOLID);
  }

  // Larguras
  for (var col in CONFIG.LARGURAS) sheet.setColumnWidth(parseInt(col), CONFIG.LARGURAS[col]);

  // Filtros
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, 1, numCols).createFilter();

  SpreadsheetApp.flush();
  alertaSafe_('✅ Identidade Visual', 'Montserrat ' + V.DADOS_TAM + ' · #356854 · Cinza/branco');
}


// ═══════════════════════════════════════════════════════════
// FORMATAÇÃO CONDICIONAL
// ═══════════════════════════════════════════════════════════

function aplicarFormatacaoCondicional() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet) { alertaSafe_('❌', 'Base Única não encontrada.'); return; }

  var V = CONFIG.VISUAL;
  var C = CONFIG.COL1;
  var maxRow = Math.max(sheet.getLastRow(), CONFIG.MAX_ROW_VALIDACAO);

  // Limpar regras das colunas J/K/L/O
  var colsAlvo = [C.CONTRATO, C.PROCURACAO, C.KIT_PREFEITO, C.TIPO_VIGENCIA];
  var existentes = sheet.getConditionalFormatRules();
  var limpas = existentes.filter(function(rule) {
    var rr = rule.getRanges();
    for (var i = 0; i < rr.length; i++) {
      if (colsAlvo.indexOf(rr[i].getColumn()) !== -1) return false;
    }
    return true;
  });

  var novas = limpas.slice();

  // J, K, L: Sim/Pendente/Não
  var colsJKL = [C.CONTRATO, C.PROCURACAO, C.KIT_PREFEITO];
  for (var c = 0; c < colsJKL.length; c++) {
    var rng = sheet.getRange(2, colsJKL[c], maxRow - 1, 1);
    novas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Sim')
      .setBackground(V.SIM_BG).setFontColor(V.SIM_COR).setBold(true).setRanges([rng]).build());
    novas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Pendente')
      .setBackground(V.PENDENTE_BG).setFontColor(V.PENDENTE_COR).setBold(true).setRanges([rng]).build());
    novas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Não')
      .setBackground(V.NAO_BG).setFontColor(V.NAO_COR).setRanges([rng]).build());
  }

  // O: Vigência
  var rngO = sheet.getRange(2, C.TIPO_VIGENCIA, maxRow - 1, 1);
  novas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Renovável 12m')
    .setBackground(V.RENOVAVEL_BG).setFontColor(V.RENOVAVEL_COR).setRanges([rngO]).build());
  novas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Por escopo')
    .setBackground(V.ESCOPO_BG).setFontColor(V.ESCOPO_COR).setRanges([rngO]).build());
  novas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Pendente')
    .setBackground(V.PENDENTE_BG).setFontColor(V.PENDENTE_COR).setRanges([rngO]).build());

  sheet.setConditionalFormatRules(novas);
  alertaSafe_('✅', 'Formatação condicional em J, K, L e O.');
}


// ═══════════════════════════════════════════════════════════
// PROTEÇÃO DE COLUNAS AUTO
// ═══════════════════════════════════════════════════════════

function protegerColunasAuto() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet) { alertaSafe_('❌', 'Base Única não encontrada.'); return; }

  var prots = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var p = 0; p < prots.length; p++) {
    if ((prots[p].getDescription() || '').indexOf('[AUTO]') !== -1) prots[p].remove();
  }

  var maxRow = Math.max(sheet.getLastRow(), CONFIG.MAX_ROW_VALIDACAO);
  var nomes = [];
  for (var col in CONFIG.COLUNAS_AUTO) {
    var prot = sheet.getRange(2, parseInt(col), maxRow - 1, 1)
      .protect().setDescription('[AUTO] ' + CONFIG.COLUNAS_AUTO[col]);
    prot.setWarningOnly(true);
    nomes.push(CONFIG.COLUNAS_AUTO[col]);
  }
  alertaSafe_('✅', 'Protegidas:\n' + nomes.join('\n'));
}


// ═══════════════════════════════════════════════════════════
// TIPO DE VIGÊNCIA — BULK
// ═══════════════════════════════════════════════════════════

function preencherTipoVigenciaBulk() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }

  Logger.log('═══ Tipo de Vigência (bulk) ═══');
  var C = CONFIG.COL;

  // REGRA 4: Leitura batch
  var dados = sheet.getDataRange().getValues();
  var att = 0, pend = 0, ren = 0, esc = 0;

  // REGRA 4: Processar em memória
  for (var r = 1; r < dados.length; r++) {
    var tipo = calcularTipoVigencia_(dados[r][C.VALIDADE], dados[r][C.ASS_CONTRATO], dados[r][C.ASS_ADITIVO]);
    if (String(dados[r][C.TIPO_VIGENCIA] || '').trim() !== tipo) { dados[r][C.TIPO_VIGENCIA] = tipo; att++; }
    if (tipo === 'Pendente') pend++;
    else if (tipo === 'Renovável 12m') ren++;
    else esc++;
  }

  // REGRA 4: Gravação batch (só coluna O)
  sheet.getRange(2, CONFIG.COL1.TIPO_VIGENCIA, dados.length - 1, 1)
    .setValues(dados.slice(1).map(function(row) { return [row[C.TIPO_VIGENCIA]]; }));
  SpreadsheetApp.flush();

  alertaSafe_('✅ Vigência', 'Atualizadas: ' + att + '\nRenovável: ' + ren + ' | Escopo: ' + esc + ' | Pendente: ' + pend);
}


// ═══════════════════════════════════════════════════════════
// NORMALIZAR FILIAIS + REGIÕES
// ═══════════════════════════════════════════════════════════

function normalizarFiliaisERegioes() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) return;

  Logger.log('═══ Normalizar Filiais + Regiões ═══');

  // REGRA 4: Leitura batch
  var dados = sheet.getDataRange().getValues();
  var C = CONFIG.COL;
  var mapaFN = {};
  for (var old in CONFIG.MAPA_FILIAIS) mapaFN[normalizar_(old)] = CONFIG.MAPA_FILIAIS[old];

  // REGRA 4: Processar em memória
  for (var r = 1; r < dados.length; r++) {
    // Filial
    var filOrig = String(dados[r][C.FILIAL] || '').trim();
    if (filOrig) {
      var partes = filOrig.split(',').map(function(p) { return p.trim(); });
      var novas = partes.map(function(p) {
        var pn = normalizar_(p);
        return mapaFN[pn] || converterFilial_(p);
      });
      var unicos = [];
      for (var u = 0; u < novas.length; u++) { if (unicos.indexOf(novas[u]) === -1) unicos.push(novas[u]); }
      dados[r][C.FILIAL] = unicos.join(', ');
    }

    // Região
    var uf = String(dados[r][C.UF] || '').trim();
    if (uf && CONFIG.UF_REGIAO[uf]) dados[r][C.REGIAO] = CONFIG.UF_REGIAO[uf];

    // UF-Município (regenerar)
    var mun = String(dados[r][C.MUNICIPIO] || '').trim();
    dados[r][C.UF_MUNICIPIO] = (uf && mun) ? uf + ' - ' + mun : (uf || mun || '');
  }

  // REGRA 4: Gravação batch (colunas A, C, F)
  var colA = dados.slice(1).map(function(row) { return [row[C.FILIAL]]; });
  var colC = dados.slice(1).map(function(row) { return [row[C.REGIAO]]; });
  var colF = dados.slice(1).map(function(row) { return [row[C.UF_MUNICIPIO]]; });
  sheet.getRange(2, 1, colA.length, 1).setValues(colA);
  sheet.getRange(2, 3, colC.length, 1).setValues(colC);
  sheet.getRange(2, 6, colF.length, 1).setValues(colF);

  // Atualizar dropdowns
  aplicarDropdown_(sheet, 2, CONFIG.COL1.FILIAL, CONFIG.MAX_ROW_VALIDACAO - 1, CONFIG.FILIAIS);
  aplicarDropdown_(sheet, 2, CONFIG.COL1.REGIAO, CONFIG.MAX_ROW_VALIDACAO - 1, CONFIG.REGIOES);

  SpreadsheetApp.flush();
  alertaSafe_('✅', 'Filiais e regiões normalizadas.');
}

/** Limpar Municípios + Regenerar F. */
function limparMunicipiosERegenF() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }

  var dados = sheet.getDataRange().getValues();
  var C = CONFIG.COL;
  var corrigidos = 0;

  for (var r = 1; r < dados.length; r++) {
    var uf = String(dados[r][C.UF] || '').trim();
    var mun = String(dados[r][C.MUNICIPIO] || '').trim();
    if (mun) {
      var munLimpo = normalizarNomeMunicipio_(stripUFPrefix_(mun));
      if (munLimpo !== mun) { dados[r][C.MUNICIPIO] = munLimpo; corrigidos++; }
    }
    var munAt = String(dados[r][C.MUNICIPIO] || '').trim();
    dados[r][C.UF_MUNICIPIO] = (uf && munAt) ? uf + ' - ' + munAt : (uf || munAt || '');
  }

  if (corrigidos > 0) {
    var colE = dados.slice(1).map(function(row) { return [row[C.MUNICIPIO]]; });
    var colF = dados.slice(1).map(function(row) { return [row[C.UF_MUNICIPIO]]; });
    sheet.getRange(2, CONFIG.COL1.MUNICIPIO, colE.length, 1).setValues(colE);
    sheet.getRange(2, CONFIG.COL1.UF_MUNICIPIO, colF.length, 1).setValues(colF);
    SpreadsheetApp.flush();
  }
  alertaSafe_('✅', corrigidos + ' municípios normalizados.');
}


// ═══════════════════════════════════════════════════════════
// REPROCESSAMENTO BULK
// ═══════════════════════════════════════════════════════════

function reprocessarAutoPreench() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }
  if (!confirmarSafe_('⚠️', 'Atualizar Região e População para ' + (sheet.getLastRow()-1) + ' linhas?')) return;

  var dados = sheet.getDataRange().getValues();
  var C = CONFIG.COL;
  var att = 0;

  for (var r = 1; r < dados.length; r++) {
    var uf = String(dados[r][C.UF] || '').trim();
    if (uf && CONFIG.UF_REGIAO[uf] && dados[r][C.REGIAO] !== CONFIG.UF_REGIAO[uf]) {
      dados[r][C.REGIAO] = CONFIG.UF_REGIAO[uf]; att++;
    }
  }

  if (att > 0) {
    sheet.getRange(1, 1, dados.length, dados[0].length).setValues(dados);
    SpreadsheetApp.flush();
  }
  alertaSafe_('✅', att + ' linhas atualizadas.');
}


// ═══════════════════════════════════════════════════════════
// E-MAIL DE VENCIMENTO (com Tipo de Vigência)
// ═══════════════════════════════════════════════════════════

function verificarVencimentosV2() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) return;

  var dest = getVariavel_('EMAIL_ALERTA_VENCIMENTO');
  if (!dest) { Logger.log('Sem destinatários.'); return; }

  var hoje = new Date(), limite = new Date();
  limite.setDate(limite.getDate() + 14);

  var dados = sheet.getDataRange().getValues();
  var C = CONFIG.COL;
  var vencendo = {};

  for (var r = 1; r < dados.length; r++) {
    var val = dados[r][C.VALIDADE];
    if (!(val instanceof Date)) continue;
    if (val >= hoje && val <= limite) {
      var fil = String(dados[r][C.FILIAL] || 'Sem Filial').trim();
      if (!vencendo[fil]) vencendo[fil] = [];
      vencendo[fil].push({
        municipio: String(dados[r][C.MUNICIPIO] || '').trim(),
        uf: String(dados[r][3] || '').trim(), // <--- PUXANDO A COLUNA D (Índice 3)
        materia: String(dados[r][C.MATERIA] || '').trim(),
        tipoVigencia: String(dados[r][C.TIPO_VIGENCIA] || '').trim(),
        vencimento: Utilities.formatDate(val, 'America/Sao_Paulo', 'dd/MM/yyyy'),
        diasRestantes: Math.ceil((val.getTime() - hoje.getTime()) / 86400000)
      });
    }
  }

  var filiais = Object.keys(vencendo);
  if (filiais.length === 0) { Logger.log('Nenhum vencendo.'); return; }

  for (var f = 0; f < filiais.length; f++) {
    try {
      MailApp.sendEmail({
        to: dest,
        subject: '[Monteiro] Vencendo — ' + filiais[f] + ' (' + vencendo[filiais[f]].length + ')',
        htmlBody: montarEmailVencimento_(filiais[f], vencendo[filiais[f]])
      });
    } catch (e) { Logger.log('Erro e-mail: ' + e.message); }
  }
}

function montarEmailVencimento_(filial, contratos) {
  var V = CONFIG.VISUAL;
  var html = '<div style="font-family:Montserrat,Arial,sans-serif;max-width:700px;">'
    + '<div style="background:' + V.HEADER_BG + ';color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">'
    + '<h2 style="margin:0;font-size:18px;">⏰ Contratos Vencendo — ' + filial + '</h2></div>'
    + '<div style="padding:16px 20px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">'
    + '<p>Contratos vencendo nos próximos <strong>14 dias</strong>:</p>'
    + '<table style="width:100%;border-collapse:collapse;margin:12px 0;">'
    + '<tr style="background:' + V.HEADER_BG + ';color:#fff;">'
    + '<th style="padding:8px;text-align:left;">Município</th>'
    + '<th style="padding:8px;text-align:center;">UF</th>' // <--- NOVO CABEÇALHO AQUI
    + '<th style="padding:8px;text-align:left;">Matéria</th>'
    + '<th style="padding:8px;text-align:center;">Vigência</th>'
    + '<th style="padding:8px;text-align:center;">Vencimento</th>'
    + '<th style="padding:8px;text-align:center;">Dias</th></tr>';

  for (var i = 0; i < contratos.length; i++) {
    var c = contratos[i];
    var bg = i % 2 === 0 ? V.BANDING_2 : V.BANDING_1;
    var corD = c.diasRestantes <= 3 ? '#D32F2F' : (c.diasRestantes <= 7 ? '#F57C00' : '#388E3C');
    var corV = '#666', bgV = 'transparent';
    if (c.tipoVigencia === 'Renovável 12m') { corV = V.RENOVAVEL_COR; bgV = V.RENOVAVEL_BG; }
    else if (c.tipoVigencia === 'Por escopo') { corV = V.ESCOPO_COR; bgV = V.ESCOPO_BG; }
    else if (c.tipoVigencia === 'Pendente') { corV = V.PENDENTE_COR; bgV = V.PENDENTE_BG; }

    html += '<tr style="background:' + bg + ';"><td style="padding:8px;">' + c.municipio + '</td>'
      + '<td style="padding:8px;text-align:center;"><strong>' + c.uf + '</strong></td>' // <--- NOVA COLUNA DE DADOS AQUI
      + '<td style="padding:8px;">' + c.materia + '</td>'
      + '<td style="padding:8px;text-align:center;"><span style="background:' + bgV + ';color:' + corV
      + ';padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">' + (c.tipoVigencia || '—') + '</span></td>'
      + '<td style="padding:8px;text-align:center;">' + c.vencimento + '</td>'
      + '<td style="padding:8px;text-align:center;color:' + corD + ';font-weight:bold;">' + c.diasRestantes + 'd</td></tr>';
  }
  html += '</table><p style="color:#999;font-size:10px;">Controle Documental — Monteiro e Monteiro</p></div></div>';
  return html;
}


// ═══════════════════════════════════════════════════════════
// RELATÓRIO DE EXCLUSÕES
// ═══════════════════════════════════════════════════════════

function gerarRelatorioExclusoes() {
  Logger.log('═══ RELATORIO_EXCLUSOES ═══');
  var ss = getSS_();
  var relSheet = getOrCreateSheet_(CONFIG.ABAS.RELATORIO_EXCL, false);
  var headers = ['Origem','Timestamp','Aba/Linha','Motivo','Filial','UF','Município','Matéria','Processo','Detalhes'];
  relSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatarHeader_(relSheet, headers.length);

  var linhas = [];

  var logU = ss.getSheetByName(CONFIG.ABAS.LOG_UNIFICACAO);
  if (logU && logU.getLastRow() > 1) {
    var dU = logU.getRange(2, 1, logU.getLastRow() - 1, logU.getLastColumn()).getValues();
    for (var r = 0; r < dU.length; r++) {
      linhas.push(['Unificação', dU[r][0]||'', String(dU[r][1]||'')+' L'+(dU[r][2]||''),
        String(dU[r][3]||''), '','','','','', String(dU[r][4]||'').substring(0,200)]);
    }
  }

  var logD = ss.getSheetByName(CONFIG.ABAS.LOG_DUPLICATAS);
  if (logD && logD.getLastRow() > 1) {
    var dD = logD.getRange(2, 1, logD.getLastRow() - 1, logD.getLastColumn()).getValues();
    for (var r2 = 0; r2 < dD.length; r2++) {
      linhas.push(['Deduplicação', dD[r2][0]||'', 'Base Única L'+(dD[r2][1]||''),
        String(dD[r2][7]||''), String(dD[r2][2]||''), String(dD[r2][3]||''),
        String(dD[r2][4]||''), String(dD[r2][5]||''), String(dD[r2][6]||''),
        'Mantida: L'+(dD[r2][8]||'')]);
    }
  }

  if (linhas.length > 0) {
    relSheet.getRange(2, 1, linhas.length, headers.length).setValues(linhas);
    aplicarBanding_(relSheet);
    if (relSheet.getFilter()) relSheet.getFilter().remove();
    relSheet.getRange(1, 1, 1, headers.length).createFilter();
  }

  alertaSafe_('✅ Relatório', 'Total: ' + linhas.length + ' linhas excluídas.');
}


// ═══════════════════════════════════════════════════════════
// APLICAR TUDO
// ═══════════════════════════════════════════════════════════

function aplicarTudo() {
  if (!confirmarSafe_('🚀 Aplicar Tudo',
    '1. Matérias + dropdown\n2. Vigência\n3. Normalizar filiais/regiões\n'
    + '4. Proteção\n5. Formatação condicional\n6. Identidade visual\n'
    + '7. Dropdown Município bulk\n8. Relatório exclusões\n\nContinuar?')) return;

  Logger.log('═══ APLICAR TUDO ═══');
  aplicarMateriasEAtualizarDropdown();
  preencherTipoVigenciaBulk();
  normalizarFiliaisERegioes();
  protegerColunasAuto();
  aplicarFormatacaoCondicional();
  aplicarIdentidadeVisual();
  aplicarDropdownMunicipioBulk();
  gerarRelatorioExclusoes();
  Logger.log('═══ TUDO APLICADO ═══');

  alertaSafe_('🎉 Concluído!',
    '✅ Matérias\n✅ Vigência\n✅ Filiais/Regiões\n✅ Proteção\n'
    + '✅ Formatação condicional\n✅ Identidade visual\n✅ Dropdowns\n✅ Relatório\n\n'
    + '📌 Rode "Instalar automações" para ativar triggers.');
}
