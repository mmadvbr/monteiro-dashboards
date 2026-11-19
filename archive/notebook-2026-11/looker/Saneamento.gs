/**
 * ============================================================
 * Saneamento.gs — Limpeza e normalização de dados (v3.1)
 * Monteiro e Monteiro — Controle Documental
 * ============================================================
 * 
 * carregarMapaMunicipios_() agora está em Utils.gs e lê
 * da aba AUX_MUNICIPIOS (interna, sem planilha externa).
 */

function executarSaneamento() {
  Logger.log('═══ Saneamento ═══');
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }

  var ss = getSS_();
  var logSheet = ss.getSheetByName(CONFIG.ABAS.LOG_SANEAMENTO);
  if (logSheet) ss.deleteSheet(logSheet);

  var dados = sheet.getDataRange().getValues();
  var headers = dados[0];
  var logBuffer = [];
  var alt = { valor:0, datas:0, municipios:0, dropdowns:0 };

  var municipiosMap = carregarMapaMunicipios_(); // De Utils.gs (lê AUX_MUNICIPIOS)
  var C = CONFIG.COL;
  var MD = CONFIG.MAPA_DROPDOWN;

  for (var r = 1; r < dados.length; r++) {
    var linha = dados[r];
    var linhaNum = r + 1;

    // Dropdowns J/K/L
    for (var dd = 0; dd < CONFIG.COLUNAS_DROPDOWN_STATUS.length; dd++) {
      var colIdx = CONFIG.COLUNAS_DROPDOWN_STATUS[dd];
      var valOrig = String(linha[colIdx] || '').trim();
      if (!valOrig) continue;
      var valNorm = valOrig.toLowerCase();
      if (MD.hasOwnProperty(valNorm) && MD[valNorm] !== valOrig) {
        logBuffer.push([new Date(), linhaNum, headers[colIdx], valOrig, 'Normalizado', MD[valNorm]]);
        linha[colIdx] = MD[valNorm];
        alt.dropdowns++;
      }
    }

    // Valor (Q)
    var valOr = linha[C.VALOR];
    if (valOr !== '' && valOr !== null && typeof valOr !== 'number') {
      var strV = String(valOr).trim();
      var valLimpo = limparValor_(strV);
      if (valLimpo === null && strV !== '') {
        var obs = String(linha[C.OBSERVACAO] || '').trim();
        linha[C.OBSERVACAO] = obs ? obs + ' | [Valor: ' + strV + ']' : '[Valor: ' + strV + ']';
        linha[C.VALOR] = '';
        logBuffer.push([new Date(), linhaNum, 'Valor', strV, 'Movido para Obs', '']);
        alt.valor++;
      } else if (valLimpo !== null && valLimpo !== valOr) {
        linha[C.VALOR] = valLimpo;
        alt.valor++;
      }
    }

    // Datas
    for (var d = 0; d < CONFIG.COLUNAS_DATA.length; d++) {
      var col = CONFIG.COLUNAS_DATA[d];
      var dataOrig = linha[col.idx];
      if (dataOrig === '' || dataOrig === null) continue;
      if (dataOrig instanceof Date && !isNaN(dataOrig.getTime())) continue;

      var strD = String(dataOrig).trim();
      if (/^(ok|sim|não|nao|pendente|n\/a|-|x|\.+)$/i.test(strD)) {
        linha[col.idx] = '';
        logBuffer.push([new Date(), linhaNum, col.nome, strD, 'Limpo', '']);
        alt.datas++;
        continue;
      }
      var parsed = parsearData_(dataOrig);
      if (parsed) { linha[col.idx] = parsed; if (!(dataOrig instanceof Date)) alt.datas++; }
      else { linha[col.idx] = ''; logBuffer.push([new Date(), linhaNum, col.nome, strD, 'Limpo', '']); alt.datas++; }
    }

    // Município
    var munOrig = String(linha[C.MUNICIPIO] || '').trim();
    if (munOrig) {
      var munNorm = normalizar_(munOrig);
      var uf = String(linha[C.UF] || '').trim();
      var chave = munNorm + '|' + normalizar_(uf);
      if (municipiosMap[chave] && municipiosMap[chave] !== munOrig) {
        linha[C.MUNICIPIO] = municipiosMap[chave]; alt.municipios++;
      } else if (municipiosMap[munNorm] && municipiosMap[munNorm] !== munOrig) {
        linha[C.MUNICIPIO] = municipiosMap[munNorm]; alt.municipios++;
      }
    }
  }

  sheet.getRange(2, 1, dados.length - 1, headers.length).setValues(dados.slice(1));
  SpreadsheetApp.flush();

  if (logBuffer.length > 0) {
    logBatch_(CONFIG.ABAS.LOG_SANEAMENTO,
      ['Timestamp','Linha','Coluna','Original','Ação','Final'], logBuffer);
  }

  var msg = 'Dropdowns: ' + alt.dropdowns + '\nValores: ' + alt.valor
    + '\nDatas: ' + alt.datas + '\nMunicípios: ' + alt.municipios;
  Logger.log(msg);
  alertaSafe_('✅ Saneamento', msg);
}


// ═══════════════════════════════════════════════════════════
// MATÉRIAS
// ═══════════════════════════════════════════════════════════

function diagnosticoMaterias() {
  Logger.log('═══ Diagnóstico Matérias ═══');
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }

  var materiasValidas = carregarListaMaterias_();
  var materiasNorm = materiasValidas.map(function(m) { return normalizar_(m); });

  var dados = sheet.getRange(2, CONFIG.COL1.MATERIA, sheet.getLastRow() - 1, 1).getValues();
  var semMatch = {};

  for (var r = 0; r < dados.length; r++) {
    var mat = String(dados[r][0] || '').trim();
    if (!mat) continue;
    var matNorm = normalizar_(mat);
    if (materiasNorm.indexOf(matNorm) === -1) {
      if (!semMatch[mat]) semMatch[mat] = { qtd:0, sugestao: buscarSugestaoMateria_(matNorm, materiasValidas, materiasNorm) };
      semMatch[mat].qtd++;
    }
  }

  var diagSheet = getOrCreateSheet_(CONFIG.ABAS.DIAG_MATERIAS, false);
  var diagH = ['Matéria na Planilha','Ocorrências','Sugestão Automática','Matéria Correta (PREENCHER)','Observação'];
  diagSheet.getRange(1, 1, 1, diagH.length).setValues([diagH]);
  formatarHeader_(diagSheet, diagH.length);

  var lista = Object.keys(semMatch).sort(function(a,b) { return semMatch[b].qtd - semMatch[a].qtd; });
  if (lista.length > 0) {
    var diagData = lista.map(function(m) { return [m, semMatch[m].qtd, semMatch[m].sugestao, '', '']; });
    diagSheet.getRange(2, 1, diagData.length, diagH.length).setValues(diagData);
    aplicarDropdown_(diagSheet, 2, 4, diagData.length, materiasValidas);
    diagSheet.getRange(2, 4, diagData.length, 1).setBackground('#FFF9C4');
    aplicarBanding_(diagSheet);
  }

  alertaSafe_('✅ Diagnóstico', lista.length + ' matérias sem match.');
}

function aplicarMateriasEAtualizarDropdown() {
  Logger.log('═══ Aplicar Matérias + Dropdown ═══');
  var ss = getSS_();
  var diagSheet = ss.getSheetByName(CONFIG.ABAS.DIAG_MATERIAS);
  if (!diagSheet || diagSheet.getLastRow() < 2) { alertaSafe_('❌', 'DIAG_MATERIAS vazia.'); return; }

  var diagData = diagSheet.getRange(2, 1, diagSheet.getLastRow() - 1, 4).getValues();
  var mapa = {}, naoP = 0;
  for (var i = 0; i < diagData.length; i++) {
    var orig = String(diagData[i][0]).trim();
    var corr = String(diagData[i][3]).trim();
    if (corr) mapa[normalizar_(orig)] = corr; else naoP++;
  }

  if (Object.keys(mapa).length === 0) { alertaSafe_('⚠️', 'Coluna D vazia.'); return; }
  if (naoP > 0 && !confirmarSafe_('⚠️', naoP + ' sem mapeamento. Continuar?')) return;

  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) return;

  var materias = sheet.getRange(2, CONFIG.COL1.MATERIA, sheet.getLastRow() - 1, 1).getValues();
  var corrigidas = 0;
  for (var r = 0; r < materias.length; r++) {
    var matOrig = String(materias[r][0]).trim();
    if (mapa[normalizar_(matOrig)] && matOrig !== mapa[normalizar_(matOrig)]) {
      materias[r][0] = mapa[normalizar_(matOrig)]; corrigidas++;
    }
  }
  if (corrigidas > 0) sheet.getRange(2, CONFIG.COL1.MATERIA, materias.length, 1).setValues(materias);

  var listaFinal = carregarListaMateriasCompleta_();
  aplicarDropdown_(sheet, 2, CONFIG.COL1.MATERIA, CONFIG.MAX_ROW_VALIDACAO - 1, listaFinal);
  SpreadsheetApp.flush();

  alertaSafe_('✅', 'Corrigidas: ' + corrigidas + ' | Dropdown: ' + listaFinal.length);
}

function adicionarNovaMateria() {
  try {
    var ui = SpreadsheetApp.getUi();
    var resp = ui.prompt('📋 Nova Matéria', 'Nome exato:', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    var nova = resp.getResponseText().trim();
    if (!nova) return;

    var atuais = carregarListaMaterias_();
    if (atuais.some(function(m) { return normalizar_(m) === normalizar_(nova); })) {
      ui.alert('ℹ️', 'Já existe.', ui.ButtonSet.OK); return;
    }

    // Adicionar na aba interna MATÉRIAS
    var matSheet = getSheet_(CONFIG.ABAS.MATERIAS);
    if (matSheet) {
      matSheet.getRange(matSheet.getLastRow() + 1, 1).setValue(nova);
    }

    var lista = carregarListaMateriasCompleta_();
    var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
    if (sheet) aplicarDropdown_(sheet, 2, CONFIG.COL1.MATERIA, CONFIG.MAX_ROW_VALIDACAO - 1, lista);

    ui.alert('✅', '"' + nova + '" adicionada. Total: ' + lista.length, ui.ButtonSet.OK);
  } catch (e) { Logger.log('adicionarNovaMateria requer UI: ' + e.message); }
}

function buscarSugestaoMateria_(materiaNorm, validas, normalizadas) {
  for (var i = 0; i < normalizadas.length; i++) {
    if (materiaNorm.indexOf(normalizadas[i]) !== -1 || normalizadas[i].indexOf(materiaNorm) !== -1) return validas[i];
  }
  var melhor = 0, match = '';
  for (var j = 0; j < normalizadas.length; j++) {
    var s = calcularSimilaridade_(materiaNorm, normalizadas[j]);
    if (s > melhor) { melhor = s; match = validas[j]; }
  }
  return melhor > 0.5 ? match : '';
}
