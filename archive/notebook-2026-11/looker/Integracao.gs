/**
 * ============================================================
 * Integracao.gs — IBGE + TSE (v3.2 — AUX_DADOS unificada)
 * Monteiro e Monteiro — Controle Documental
 * ============================================================
 *
 * ARMAZENAMENTO PERMANENTE: Uma única aba oculta AUX_DADOS com:
 *   | chave (nome_norm|uf) | populacao | cod_ibge | partido_2020 | partido_2024 |
 *
 * ZERO CacheService. Nunca expira.
 *
 * FUNÇÕES PÚBLICAS:
 *   preencherPopulacaoBulk()   — API IBGE → AUX_DADOS → Base Única
 *   preencherPartidosTSE()     — BigQuery → AUX_DADOS → Base Única
 *   diagnosticoSemMatch()      — Lista municípios sem match no IBGE
 *   autoPreencherDadosMunicipio_() — onEdit: preenche Pop/Cod/Partidos
 */


// ── Helper seguro para correções IBGE ─────────────────────
var CORRECOES_ = (CONFIG && CONFIG.CORRECOES_IBGE) ? CONFIG.CORRECOES_IBGE : {};
function corrigirChaveIBGE_(chave) {
  return CORRECOES_[chave] || chave;
}


// ═══════════════════════════════════════════════════════════
// AUX_DADOS — Aba oculta unificada (permanente)
// ═══════════════════════════════════════════════════════════

/**
 * Carrega AUX_DADOS em memória.
 * Retorna: { "chave": { pop, cod, p2020, p2024 } }
 */
function carregarAuxDados_() {
  var sheet = getSheet_(CONFIG.ABAS.AUX_DADOS);
  if (!sheet || sheet.getLastRow() < 2) return {};

  var dados = sheet.getDataRange().getValues();
  var mapa = {};
  for (var r = 1; r < dados.length; r++) {
    var chave = String(dados[r][0]).trim();
    if (!chave) continue;
    mapa[chave] = {
      pop:   dados[r][1] || '',
      cod:   String(dados[r][2] || '').trim(),
      p2020: String(dados[r][3] || '').trim(),
      p2024: String(dados[r][4] || '').trim()
    };
  }
  return mapa;
}

/**
 * Salva AUX_DADOS de um mapa completo.
 * Formato: | chave | populacao | cod_ibge | partido_2020 | partido_2024 |
 */
function salvarAuxDados_(mapa) {
  var ss = getSS_();
  var grid = [['chave', 'populacao', 'cod_ibge', 'partido_2020', 'partido_2024']];

  for (var chave in mapa) {
    var d = mapa[chave];
    grid.push([chave, d.pop || '', d.cod || '', d.p2020 || '', d.p2024 || '']);
  }

  var auxSheet = ss.getSheetByName(CONFIG.ABAS.AUX_DADOS);
  if (auxSheet) auxSheet.clear();
  else auxSheet = ss.insertSheet(CONFIG.ABAS.AUX_DADOS);

  auxSheet.getRange(1, 1, grid.length, 5).setValues(grid);
  auxSheet.hideSheet();
  Logger.log('AUX_DADOS salva: ' + (grid.length - 1) + ' registros.');
}


// ═══════════════════════════════════════════════════════════
// IBGE — BULK
// ═══════════════════════════════════════════════════════════

function preencherPopulacaoBulk() {
  Logger.log('═══ IBGE — População + Código ═══');
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }
  if (!confirmarSafe_('🏙️ IBGE', 'Chamar API IBGE e atualizar população + código?')) return;

  // 1. Chamar API
  var resultado = chamarApiIBGE_();
  var totalAPI = Object.keys(resultado.popMap).length;
  if (totalAPI === 0) { alertaSafe_('❌', 'API IBGE falhou.'); return; }

  // 2. Carregar AUX_DADOS existente (preservar partidos)
  var mapaAtual = carregarAuxDados_();

  // 3. Mesclar: IBGE atualiza pop+cod, preserva partidos existentes
  for (var chave in resultado.popMap) {
    if (!mapaAtual[chave]) mapaAtual[chave] = { pop:'', cod:'', p2020:'', p2024:'' };
    mapaAtual[chave].pop = resultado.popMap[chave];
    mapaAtual[chave].cod = resultado.codMap[chave] || mapaAtual[chave].cod;
  }

  // 4. Salvar AUX_DADOS
  salvarAuxDados_(mapaAtual);

  // 5. Preencher Base Única
  var C = CONFIG.COL;
  var dados = sheet.getDataRange().getValues();
  var preenchidos = 0, naoEncontrados = [];

  for (var r = 1; r < dados.length; r++) {
    var mun = String(dados[r][C.MUNICIPIO] || '').trim();
    var uf = String(dados[r][C.UF] || '').trim();
    if (!mun || !uf) continue;

    var chaveBase = normalizar_(stripUFPrefix_(mun)) + '|' + uf.toLowerCase();
    var chaveCorr = corrigirChaveIBGE_(chaveBase);
    var registro = mapaAtual[chaveCorr];

    if (registro && registro.pop) {
      dados[r][C.POPULACAO] = registro.pop;
      if (registro.cod) dados[r][C.COD_IBGE] = registro.cod;
      preenchidos++;
    } else {
      var nome = uf + ' - ' + mun;
      if (naoEncontrados.indexOf(nome) === -1) naoEncontrados.push(nome);
    }
  }

  sheet.getRange(1, 1, dados.length, dados[0].length).setValues(dados);
  SpreadsheetApp.flush();

  var msg = 'API IBGE: ' + totalAPI + ' municípios\n'
    + 'Preenchidos: ' + preenchidos + '\n'
    + 'Sem match: ' + naoEncontrados.length;
  if (naoEncontrados.length > 0) {
    msg += '\n\nRode "Diagnóstico sem match" para ver a lista completa.';
    Logger.log('Sem match:\n' + naoEncontrados.join('\n'));
  }
  alertaSafe_('✅ IBGE', msg);
}

function chamarApiIBGE_() {
  try {
    var resp = UrlFetchApp.fetch(CONFIG.IBGE_URL, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return { popMap:{}, codMap:{} };
    var data = JSON.parse(resp.getContentText());
    var popMap = {}, codMap = {};

    for (var i = 1; i < data.length; i++) {
      var item = data[i];
      var cod = String(item['D1C'] || item['D2C'] || '').trim();
      var nome = String(item['D1N'] || item['D2N'] || '').trim().replace(/\s*-\s*[A-Z]{2}$/, '');
      var pop = parseInt(String(item['V'] || '').replace(/\./g, '').replace(/,/g, ''));
      if (!cod || cod.length < 6 || !nome || isNaN(pop) || pop <= 0) continue;
      var sigla = CONFIG.IBGE_UF[cod.substring(0, 2)];
      if (sigla) {
        var chave = normalizar_(nome) + '|' + sigla.toLowerCase();
        popMap[chave] = pop;
        codMap[chave] = cod;
      }
    }
    Logger.log('API IBGE: ' + Object.keys(popMap).length + ' municípios.');
    return { popMap: popMap, codMap: codMap };
  } catch (e) {
    Logger.log('Erro API IBGE: ' + e.message);
    return { popMap:{}, codMap:{} };
  }
}


// ═══════════════════════════════════════════════════════════
// TSE — Partidos via BigQuery
// ═══════════════════════════════════════════════════════════

function preencherPartidosTSE() {
  Logger.log('═══ TSE — Partidos ═══');
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }

  try { BigQuery.Jobs; } catch (e) {
    alertaSafe_('❌', 'BigQuery não habilitado.\nServiços (+) → BigQuery API → Adicionar');
    return;
  }

  var projectId = getVariavel_('GCP_PROJECT_ID');
  if (!projectId) { alertaSafe_('❌', 'GCP_PROJECT_ID não configurado.'); return; }
  if (!confirmarSafe_('🗳️ TSE', 'Consultar BigQuery (projeto: ' + projectId + ')?')) return;

  var mapaTSE = executarQueryTSE_(projectId);
  if (Object.keys(mapaTSE).length === 0) { alertaSafe_('⚠️', 'Sem resultados.'); return; }

  // Carregar AUX_DADOS existente (preservar pop+cod)
  var mapaAtual = carregarAuxDados_();

  // Precisamos vincular cod_ibge do TSE às chaves nome|uf da AUX_DADOS
  // Construir mapa reverso: cod → chave
  var codParaChave = {};
  for (var chave in mapaAtual) {
    if (mapaAtual[chave].cod) codParaChave[mapaAtual[chave].cod] = chave;
  }

  // Mesclar partidos no mapa
  var vinculados = 0;
  for (var codTSE in mapaTSE) {
    var chaveExistente = codParaChave[codTSE];
    // Tentar match com 6 dígitos se 7 não bater
    if (!chaveExistente && codTSE.length === 7) chaveExistente = codParaChave[codTSE.substring(0, 6)];
    if (!chaveExistente && codTSE.length === 6) {
      for (var d = 0; d <= 9; d++) {
        chaveExistente = codParaChave[codTSE + d];
        if (chaveExistente) break;
      }
    }

    if (chaveExistente) {
      if (mapaTSE[codTSE]['2020']) mapaAtual[chaveExistente].p2020 = mapaTSE[codTSE]['2020'];
      if (mapaTSE[codTSE]['2024']) mapaAtual[chaveExistente].p2024 = mapaTSE[codTSE]['2024'];
      vinculados++;
    }
  }

  // Salvar AUX_DADOS atualizada
  salvarAuxDados_(mapaAtual);

  // Aplicar na Base Única
  var res = aplicarDadosNaBase_(sheet, mapaAtual);

  alertaSafe_('✅ TSE',
    'BigQuery: ' + Object.keys(mapaTSE).length + ' municípios\n'
    + 'Vinculados à AUX_DADOS: ' + vinculados + '\n'
    + 'Partido 2020: ' + res.p2020 + ' linhas\n'
    + 'Partido 2024: ' + res.p2024 + ' linhas');
}

function executarQueryTSE_(projectId) {
  var query = 'SELECT id_municipio, sigla_partido, ano '
    + 'FROM `basedosdados.br_tse_eleicoes.resultados_candidato` '
    + 'WHERE resultado = "eleito" AND ano IN (2020, 2024) AND cargo = "prefeito"';

  var response = BigQuery.Jobs.query({ query: query, useLegacySql: false, maxResults: 15000 }, projectId);
  var rows = response.rows || [];
  var pageToken = response.pageToken;
  while (pageToken) {
    var next = BigQuery.Jobs.getQueryResults(projectId, response.jobReference.jobId,
      { pageToken: pageToken, maxResults: 15000 });
    rows = rows.concat(next.rows || []);
    pageToken = next.pageToken;
  }

  var mapa = {};
  for (var i = 0; i < rows.length; i++) {
    var f = rows[i].f;
    var id = String(f[0].v || '').trim();
    var partido = String(f[1].v || '').trim();
    var ano = String(f[2].v || '').trim();
    if (!id || !partido) continue;
    if (!mapa[id]) mapa[id] = {};
    mapa[id][ano] = partido;
  }
  return mapa;
}


// ═══════════════════════════════════════════════════════════
// APLICAR AUX_DADOS NA BASE ÚNICA (usado por IBGE e TSE)
// ═══════════════════════════════════════════════════════════

function aplicarDadosNaBase_(sheet, mapa) {
  var C = CONFIG.COL;
  var dados = sheet.getDataRange().getValues();
  var p2020 = 0, p2024 = 0;

  for (var r = 1; r < dados.length; r++) {
    var mun = String(dados[r][C.MUNICIPIO] || '').trim();
    var uf = String(dados[r][C.UF] || '').trim();
    if (!mun || !uf) continue;

    var chave = corrigirChaveIBGE_(normalizar_(stripUFPrefix_(mun)) + '|' + uf.toLowerCase());
    var reg = mapa[chave];
    if (!reg) continue;

    if (reg.pop && dados[r][C.POPULACAO] !== reg.pop) dados[r][C.POPULACAO] = reg.pop;
    if (reg.cod && String(dados[r][C.COD_IBGE]) !== reg.cod) dados[r][C.COD_IBGE] = reg.cod;
    if (reg.p2020 && String(dados[r][C.PARTIDO_2020]) !== reg.p2020) { dados[r][C.PARTIDO_2020] = reg.p2020; p2020++; }
    if (reg.p2024 && String(dados[r][C.PARTIDO_2024]) !== reg.p2024) { dados[r][C.PARTIDO_2024] = reg.p2024; p2024++; }
  }

  sheet.getRange(1, 1, dados.length, dados[0].length).setValues(dados);
  SpreadsheetApp.flush();
  return { p2020: p2020, p2024: p2024 };
}


// ═══════════════════════════════════════════════════════════
// LOOKUP — onEdit e Sidebar
// ═══════════════════════════════════════════════════════════

/** Busca população na AUX_DADOS. */
function getPopulacaoIBGE_(municipio, uf) {
  if (!municipio || !uf) return null;
  var chave = corrigirChaveIBGE_(normalizar_(stripUFPrefix_(municipio)) + '|' + uf.toLowerCase());
  var mapa = carregarAuxDados_();
  var reg = mapa[chave];
  return reg ? reg.pop : null;
}

/** Busca código IBGE na AUX_DADOS. */
function getCodIBGE_(municipio, uf) {
  if (!municipio || !uf) return null;
  var chave = corrigirChaveIBGE_(normalizar_(stripUFPrefix_(municipio)) + '|' + uf.toLowerCase());
  var mapa = carregarAuxDados_();
  var reg = mapa[chave];
  return reg ? reg.cod : null;
}

// Alias para compatibilidade
function getCodIBGEFromCache_(municipio, uf) { return getCodIBGE_(municipio, uf); }

/** Busca partido por código IBGE na AUX_DADOS. */
function getPartidoPorCodIBGE_(codIBGE) {
  if (!codIBGE) return null;
  var cod = String(codIBGE).trim();
  var mapa = carregarAuxDados_();

  // Buscar pelo código (pode ter 6 ou 7 dígitos)
  for (var chave in mapa) {
    var regCod = mapa[chave].cod;
    if (regCod === cod || regCod === cod.substring(0, 6) || cod === regCod.substring(0, 6)) {
      return { p2020: mapa[chave].p2020, p2024: mapa[chave].p2024 };
    }
  }
  return null;
}

/** Busca TUDO de um município na AUX_DADOS: pop + cod + partidos. */
function getDadosMunicipio_(municipio, uf) {
  if (!municipio || !uf) return null;
  var chave = corrigirChaveIBGE_(normalizar_(stripUFPrefix_(municipio)) + '|' + uf.toLowerCase());
  var mapa = carregarAuxDados_();
  return mapa[chave] || null;
}


// ═══════════════════════════════════════════════════════════
// AUTO-PREENCHIMENTO (onEdit Município)
// ═══════════════════════════════════════════════════════════

function autoPreencherDadosMunicipio_(sheet, row) {
  var C = CONFIG.COL1;
  var mun = String(sheet.getRange(row, C.MUNICIPIO).getValue()).trim();
  var uf = String(sheet.getRange(row, C.UF).getValue()).trim();
  if (!mun) return;

  // Região
  if (uf && CONFIG.UF_REGIAO[uf]) sheet.getRange(row, C.REGIAO).setValue(CONFIG.UF_REGIAO[uf]);

  // Buscar na AUX_DADOS (unificada, permanente)
  var dados = getDadosMunicipio_(mun, uf);

  // Fallback: buscar em linhas existentes da Base Única
  if (!dados || (!dados.pop && !dados.cod)) {
    var existente = buscarDadosExistentes_(uf, mun);
    if (existente) {
      dados = {
        pop:   existente.populacao || '',
        cod:   existente.codIBGE || '',
        p2020: existente.partido2020 || '',
        p2024: existente.partido2024 || ''
      };
    }
  }

  if (!dados) return;

  if (dados.pop) sheet.getRange(row, C.POPULACAO).setValue(dados.pop);
  if (dados.cod) sheet.getRange(row, C.COD_IBGE).setValue(dados.cod);
  if (dados.p2020) sheet.getRange(row, C.PARTIDO_2020).setValue(dados.p2020);
  if (dados.p2024) sheet.getRange(row, C.PARTIDO_2024).setValue(dados.p2024);
}

function autoPreencherPartido_(sheet, row) {
  var C = CONFIG.COL1;
  var cod = String(sheet.getRange(row, C.COD_IBGE).getValue()).trim();
  if (!cod) return;
  var partido = getPartidoPorCodIBGE_(cod);
  if (partido) {
    if (partido.p2020) sheet.getRange(row, C.PARTIDO_2020).setValue(partido.p2020);
    if (partido.p2024) sheet.getRange(row, C.PARTIDO_2024).setValue(partido.p2024);
  }
}


// ═══════════════════════════════════════════════════════════
// DIAGNÓSTICO — Municípios sem match no IBGE
// ═══════════════════════════════════════════════════════════

/**
 * Lista todos os municípios da Base Única que não foram encontrados
 * na API do IBGE. Mostra UF, Município, chave tentada e chave corrigida.
 */
function diagnosticoSemMatch() {
  Logger.log('═══ Diagnóstico: Municípios sem match IBGE ═══');
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }

  var mapa = carregarAuxDados_();
  if (Object.keys(mapa).length === 0) {
    alertaSafe_('⚠️', 'AUX_DADOS vazia. Rode "Preencher população via IBGE" primeiro.');
    return;
  }

  var C = CONFIG.COL;
  var dados = sheet.getDataRange().getValues();
  var semMatch = {}; // { "UF - Município": { chave, corrigida, linha, populacao } }

  for (var r = 1; r < dados.length; r++) {
    var mun = String(dados[r][C.MUNICIPIO] || '').trim();
    var uf = String(dados[r][C.UF] || '').trim();
    if (!mun || !uf) continue;

    var chaveBase = normalizar_(stripUFPrefix_(mun)) + '|' + uf.toLowerCase();
    var chaveCorr = corrigirChaveIBGE_(chaveBase);

    if (!mapa[chaveCorr]) {
      var id = uf + ' - ' + mun;
      if (!semMatch[id]) {
        semMatch[id] = {
          uf: uf,
          municipio: mun,
          chave: chaveBase,
          corrigida: chaveBase !== chaveCorr ? chaveCorr : '(sem correção)',
          linhas: [],
          popAtual: dados[r][C.POPULACAO] || ''
        };
      }
      semMatch[id].linhas.push(r + 1);
    }
  }

  var lista = Object.keys(semMatch).sort();
  if (lista.length === 0) {
    alertaSafe_('✅', 'Todos os municípios da Base Única foram encontrados no IBGE!');
    return;
  }

  // Gerar relatório na aba DIAG_MATERIAS (reaproveitando)
  var diagSheet = getOrCreateSheet_('DIAG_SEM_MATCH', false);
  var headers = ['UF', 'Município na Base', 'Chave normalizada', 'Correção tentada', 'Linhas', 'Qtd', 'Pop atual', 'Ação sugerida'];
  diagSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatarHeader_(diagSheet, headers.length);

  var diagData = lista.map(function(id) {
    var d = semMatch[id];
    var acao = '';
    // Sugerir ação
    if (d.popAtual) acao = 'Pop já preenchida — pode ser typo no nome';
    else acao = 'Verificar nome no IBGE (pode ser nome antigo ou typo)';

    return [d.uf, d.municipio, d.chave, d.corrigida, d.linhas.join(', '), d.linhas.length, d.popAtual, acao];
  });

  diagSheet.getRange(2, 1, diagData.length, headers.length).setValues(diagData);
  aplicarBanding_(diagSheet);

  // Larguras
  var larg = [40, 200, 200, 200, 100, 50, 80, 300];
  for (var l = 0; l < larg.length; l++) diagSheet.setColumnWidth(l + 1, larg[l]);

  if (diagSheet.getFilter()) diagSheet.getFilter().remove();
  diagSheet.getRange(1, 1, 1, headers.length).createFilter();

  var msg = 'Municípios sem match: ' + lista.length + '\n'
    + 'Linhas afetadas: ' + lista.reduce(function(s, id) { return s + semMatch[id].linhas.length; }, 0)
    + '\n\nAba "DIAG_SEM_MATCH" criada com detalhes.\n\n'
    + 'Para corrigir:\n'
    + '1. Verifique o nome no site do IBGE\n'
    + '2. Adicione a correção em CONFIG.CORRECOES_IBGE\n'
    + '3. Rode "Preencher IBGE" novamente';

  Logger.log(msg);
  alertaSafe_('🔍 Sem match IBGE', msg);
}


// ═══════════════════════════════════════════════════════════
// TRIGGERS TSE
// ═══════════════════════════════════════════════════════════

function instalarTriggerAnualTSE() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'atualizarPartidoAnual') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('atualizarPartidoAnual').timeBased().onMonthDay(15).atHour(13).create();
  alertaSafe_('✅', 'Trigger TSE mensal instalado (dia 15).');
}

function atualizarPartidoAnual() {
  var projectId = getVariavel_('GCP_PROJECT_ID');
  if (!projectId) return;
  try {
    var mapaTSE = executarQueryTSE_(projectId);
    if (Object.keys(mapaTSE).length > 0) {
      var mapaAtual = carregarAuxDados_();
      var codParaChave = {};
      for (var chave in mapaAtual) {
        if (mapaAtual[chave].cod) codParaChave[mapaAtual[chave].cod] = chave;
      }
      for (var cod in mapaTSE) {
        var ch = codParaChave[cod];
        if (!ch && cod.length === 7) ch = codParaChave[cod.substring(0, 6)];
        if (ch) {
          if (mapaTSE[cod]['2020']) mapaAtual[ch].p2020 = mapaTSE[cod]['2020'];
          if (mapaTSE[cod]['2024']) mapaAtual[ch].p2024 = mapaTSE[cod]['2024'];
        }
      }
      salvarAuxDados_(mapaAtual);
      var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.ABAS.BASE_UNICA);
      if (sheet) aplicarDadosNaBase_(sheet, mapaAtual);
    }
  } catch (e) { Logger.log('Erro TSE anual: ' + e.message); }
}