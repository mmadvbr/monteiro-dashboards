/**
 * ============================================================
 * Estrutura.gs — Criar Base Única + AUX_MUNICIPIOS via IBGE
 * Monteiro e Monteiro — Controle Documental v3.1
 * ============================================================
 * 
 * MUDANÇA v3.1: AUX_MUNICIPIOS é construída chamando a API IBGE
 * (mesma que já usamos para população), eliminando d_municipio.
 */

function criarEstrutura() {
  Logger.log('═══ Criar Estrutura ═══');
  var sheet = getOrCreateSheet_(CONFIG.ABAS.BASE_UNICA, false);

  sheet.getRange(1, 1, 1, CONFIG.NUM_COLUNAS).setValues([CONFIG.HEADERS]);
  formatarHeader_(sheet, CONFIG.NUM_COLUNAS);

  if (sheet.getMaxRows() < 100) sheet.insertRowsAfter(sheet.getMaxRows(), 100 - sheet.getMaxRows());
  aplicarBanding_(sheet);

  for (var col in CONFIG.LARGURAS) sheet.setColumnWidth(parseInt(col), CONFIG.LARGURAS[col]);

  // Dropdowns (BATCH)
  var MR = CONFIG.MAX_ROW_VALIDACAO;
  var C = CONFIG.COL1;

  aplicarDropdown_(sheet, 2, C.FILIAL,       MR-1, CONFIG.FILIAIS);
  aplicarDropdown_(sheet, 2, C.REGIAO,        MR-1, CONFIG.REGIOES);
  aplicarDropdown_(sheet, 2, C.UF,            MR-1, CONFIG.UFS);
  aplicarDropdown_(sheet, 2, C.MATERIA,       MR-1, carregarListaMateriasCompleta_());
  aplicarDropdown_(sheet, 2, C.CONTRATO,      MR-1, CONFIG.STATUS_DOC);
  aplicarDropdown_(sheet, 2, C.PROCURACAO,    MR-1, CONFIG.STATUS_DOC);
  aplicarDropdown_(sheet, 2, C.KIT_PREFEITO,  MR-1, CONFIG.STATUS_DOC);
  aplicarDropdown_(sheet, 2, C.TIPO_VIGENCIA, MR-1, CONFIG.TIPOS_VIGENCIA.concat(['Pendente']));

  var parceiros = carregarListaParceiros_();
  if (parceiros.length > 0) aplicarDropdown_(sheet, 2, C.PARCEIROS, MR-1, parceiros);

  // Formatos
  var colsData = [C.DATA_INCLUSAO, C.DATA_PUBLICACAO, C.ASS_CONTRATO, C.ASS_ADITIVO, C.VALIDADE];
  for (var i = 0; i < colsData.length; i++) sheet.getRange(2, colsData[i], MR, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, C.VALOR, MR, 1).setNumberFormat('R$ #,##0.00');
  sheet.getRange(2, C.POPULACAO, MR, 1).setNumberFormat('#,##0');
  sheet.getRange(2, C.DATA_MODIFICACAO, MR, 1).setNumberFormat('dd/MM/yyyy HH:mm');

  // Proteção header
  var prots = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var p = 0; p < prots.length; p++) {
    if (prots[p].getDescription() === 'Header protegido') prots[p].remove();
  }
  sheet.getRange(1, 1, 1, CONFIG.NUM_COLUNAS).protect()
    .setDescription('Header protegido').setWarningOnly(true);

  // Filtros
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, 1, CONFIG.NUM_COLUNAS).createFilter();

  Logger.log('Estrutura criada: ' + CONFIG.NUM_COLUNAS + ' colunas.');
  alertaSafe_('✅ Estrutura', CONFIG.NUM_COLUNAS + ' colunas com dropdowns e formatação.\n\nPróximo: rode "Reconstruir AUX_MUNICIPIOS" para ativar dropdown de municípios.');
}


// ═══════════════════════════════════════════════════════════
// AUX_MUNICIPIOS — Construída via API IBGE
// ═══════════════════════════════════════════════════════════

/**
 * Retorna a aba AUX_MUNICIPIOS. Se não existir ou estiver vazia,
 * constrói chamando a API IBGE (mesma de população).
 */
function getOrBuildAuxMunicipios_() {
  var ss = getSS_();
  var auxSheet = ss.getSheetByName(CONFIG.ABAS.AUX_MUNICIPIOS);

  // Se já existe e tem dados, retornar
  if (auxSheet && auxSheet.getLastRow() > 1 && auxSheet.getLastColumn() >= 20) return auxSheet;

  Logger.log('Construindo AUX_MUNICIPIOS via API IBGE...');

  // Chamar API IBGE
  var response;
  try {
    response = UrlFetchApp.fetch(CONFIG.IBGE_URL, { muteHttpExceptions: true });
  } catch (e) {
    Logger.log('Erro de rede IBGE: ' + e.message);
    return null;
  }

  if (response.getResponseCode() !== 200) {
    Logger.log('API IBGE retornou HTTP ' + response.getResponseCode());
    return null;
  }

  var data = JSON.parse(response.getContentText());
  if (data.length < 2) return null;

  // Extrair nomes e agrupar por UF
  var porUF = {};
  for (var i = 1; i < data.length; i++) {
    var item = data[i];
    var codIBGE = String(item['D1C'] || item['D2C'] || '').trim();
    var nomeRaw = String(item['D1N'] || item['D2N'] || '').trim();

    if (!codIBGE || codIBGE.length < 6 || !nomeRaw) continue;

    var nomeMun = nomeRaw.replace(/\s*-\s*[A-Z]{2}$/, '');
    // Normalizar para MAIÚSCULO (consistente com a Base Única)
    nomeMun = normalizarNomeMunicipio_(nomeMun);
    var codUF = codIBGE.substring(0, 2);
    var siglaUF = CONFIG.IBGE_UF[codUF];
    if (!siglaUF) continue;

    if (!porUF[siglaUF]) porUF[siglaUF] = [];
    // Evitar duplicatas
    if (porUF[siglaUF].indexOf(nomeMun) === -1) porUF[siglaUF].push(nomeMun);
  }

  var ufs = Object.keys(porUF).sort();
  for (var u = 0; u < ufs.length; u++) porUF[ufs[u]].sort();

  // Encontrar máximo de municípios (MG ~853)
  var maxRows = 0;
  for (var u2 = 0; u2 < ufs.length; u2++) maxRows = Math.max(maxRows, porUF[ufs[u2]].length);

  // Montar grid
  var grid = [ufs]; // Header: AC, AL, AM, ...
  for (var row = 0; row < maxRows; row++) {
    var linha = [];
    for (var col = 0; col < ufs.length; col++) {
      linha.push(row < porUF[ufs[col]].length ? porUF[ufs[col]][row] : '');
    }
    grid.push(linha);
  }

  // Criar aba
  if (auxSheet) auxSheet.clear();
  else auxSheet = ss.insertSheet(CONFIG.ABAS.AUX_MUNICIPIOS);

  // Gravação batch
  auxSheet.getRange(1, 1, grid.length, ufs.length).setValues(grid);
  auxSheet.hideSheet();

  Logger.log('AUX_MUNICIPIOS: ' + ufs.length + ' UFs, ' + maxRows + ' linhas, ' +
    Object.keys(porUF).reduce(function(s, uf) { return s + porUF[uf].length; }, 0) + ' municípios.');
  return auxSheet;
}

/**
 * Reconstrói AUX_MUNICIPIOS do zero (via menu).
 */
function reconstruirAuxMunicipios() {
  var ss = getSS_();
  var auxSheet = ss.getSheetByName(CONFIG.ABAS.AUX_MUNICIPIOS);
  if (auxSheet) ss.deleteSheet(auxSheet);

  var nova = getOrBuildAuxMunicipios_();
  if (nova) {
    alertaSafe_('✅', 'AUX_MUNICIPIOS reconstruída via API IBGE.\n\nMunicípios carregados de todos os 27 estados.');
  } else {
    alertaSafe_('❌', 'Falha ao construir AUX_MUNICIPIOS.\nVerifique a conexão com a internet.');
  }
}


// ═══════════════════════════════════════════════════════════
// DROPDOWN MUNICÍPIO — Por linha (onEdit) e Bulk
// ═══════════════════════════════════════════════════════════

function atualizarDropdownMunicipio_(sheet, row) {
  var C = CONFIG.COL1;
  var munCell = sheet.getRange(row, C.MUNICIPIO);
  var uf = String(sheet.getRange(row, C.UF).getValue()).trim().toUpperCase();

  // Sempre limpar validação antiga primeiro
  munCell.clearDataValidations();

  if (!uf || uf.length !== 2) {
    munCell.clearContent();
    return;
  }

  var auxSheet = getOrBuildAuxMunicipios_();
  if (!auxSheet) {
    Logger.log('AUX_MUNICIPIOS não disponível.');
    return;
  }

  var headers = auxSheet.getRange(1, 1, 1, auxSheet.getLastColumn()).getValues()[0];
  var colIdx = -1;
  for (var c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim().toUpperCase() === uf) {
      colIdx = c + 1;
      break;
    }
  }

  if (colIdx === -1) {
    Logger.log('UF "' + uf + '" não encontrada na AUX_MUNICIPIOS. Headers: ' + headers.join(','));
    return;
  }

  // Encontrar última linha com dado nessa coluna
  var colData = auxSheet.getRange(2, colIdx, auxSheet.getLastRow() - 1, 1).getValues();
  var lastRow = 0;
  for (var r = 0; r < colData.length; r++) {
    if (String(colData[r][0]).trim()) lastRow = r + 2;
  }

  if (lastRow < 2) {
    Logger.log('Nenhum município encontrado para UF "' + uf + '" na coluna ' + colIdx);
    return;
  }

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(auxSheet.getRange(2, colIdx, lastRow - 1, 1), true)
    .setAllowInvalid(true)
    .build();
  munCell.setDataValidation(rule);

  // Se município atual não pertence à nova UF, limpar
  var munAtual = String(munCell.getValue()).trim();
  if (munAtual) {
    var validos = colData.map(function(r) { return String(r[0]).trim().toUpperCase(); });
    if (validos.indexOf(munAtual.toUpperCase()) === -1) {
      munCell.clearContent();
    }
  }
}

function aplicarDropdownMunicipioBulk() {
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) return;

  Logger.log('Dropdown Município bulk...');
  var auxSheet = getOrBuildAuxMunicipios_();
  if (!auxSheet) { alertaSafe_('❌', 'AUX_MUNICIPIOS não disponível. Rode "Reconstruir AUX_MUNICIPIOS".'); return; }

  var auxHeaders = auxSheet.getRange(1, 1, 1, auxSheet.getLastColumn()).getValues()[0];
  var ufToCol = {};
  for (var c = 0; c < auxHeaders.length; c++) {
    var uf = String(auxHeaders[c]).trim().toUpperCase();
    if (uf && uf.length === 2) ufToCol[uf] = c + 1;
  }

  var lastRow = sheet.getLastRow();
  var ufs = sheet.getRange(2, CONFIG.COL1.UF, lastRow - 1, 1).getValues();

  // Última linha com dados por UF no AUX
  var ufLastRow = {};
  for (var ufKey in ufToCol) {
    var colData = auxSheet.getRange(2, ufToCol[ufKey], auxSheet.getLastRow() - 1, 1).getValues();
    var lr = 1;
    for (var r = 0; r < colData.length; r++) { if (colData[r][0]) lr = r + 2; }
    ufLastRow[ufKey] = lr;
  }

  // Agrupar linhas por UF
  var linhasPorUF = {};
  for (var r2 = 0; r2 < ufs.length; r2++) {
    var ufVal = String(ufs[r2][0]).trim().toUpperCase();
    if (!ufVal) continue;
    if (!linhasPorUF[ufVal]) linhasPorUF[ufVal] = [];
    linhasPorUF[ufVal].push(r2 + 2);
  }

  // Aplicar em blocos contíguos (BATCH)
  var total = 0;
  for (var uf in linhasPorUF) {
    var colIdx = ufToCol[uf];
    if (!colIdx || ufLastRow[uf] < 2) continue;

    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(auxSheet.getRange(2, colIdx, ufLastRow[uf] - 1, 1), true)
      .setAllowInvalid(true).build();

    var blocos = agruparContiguos_(linhasPorUF[uf]);
    for (var b = 0; b < blocos.length; b++) {
      sheet.getRange(blocos[b][0], CONFIG.COL1.MUNICIPIO, blocos[b][1] - blocos[b][0] + 1, 1).setDataValidation(rule);
      total += blocos[b][1] - blocos[b][0] + 1;
    }
  }

  SpreadsheetApp.flush();
  Logger.log('Dropdown Município: ' + total + ' linhas.');
  alertaSafe_('✅', 'Dropdown Município aplicado em ' + total + ' linhas.');
}


/**
 * Diagnóstico: mostra as UFs da AUX_MUNICIPIOS e quantos municípios cada uma tem.
 * Use para verificar se a aba está correta.
 */
function diagnosticoAuxMunicipios() {
  var auxSheet = getSheet_(CONFIG.ABAS.AUX_MUNICIPIOS);
  if (!auxSheet || auxSheet.getLastRow() < 2) {
    alertaSafe_('❌', 'AUX_MUNICIPIOS não encontrada ou vazia.\nRode "Reconstruir AUX_MUNICIPIOS".');
    return;
  }

  var headers = auxSheet.getRange(1, 1, 1, auxSheet.getLastColumn()).getValues()[0];
  var info = [];
  var totalMun = 0;

  for (var c = 0; c < headers.length; c++) {
    var uf = String(headers[c]).trim();
    if (!uf || uf.length !== 2) continue;

    var colData = auxSheet.getRange(2, c + 1, auxSheet.getLastRow() - 1, 1).getValues();
    var count = 0;
    var primeiro = '';
    var ultimo = '';
    for (var r = 0; r < colData.length; r++) {
      if (String(colData[r][0]).trim()) {
        count++;
        if (!primeiro) primeiro = String(colData[r][0]).trim();
        ultimo = String(colData[r][0]).trim();
      }
    }
    totalMun += count;
    info.push(uf + ': ' + count + ' mun. (col ' + (c + 1) + ') [' + primeiro + ' ... ' + ultimo + ']');
  }

  var msg = 'AUX_MUNICIPIOS — Diagnóstico\n\n'
    + 'Colunas: ' + headers.length + '\n'
    + 'Total municípios: ' + totalMun + '\n\n'
    + info.join('\n');

  Logger.log(msg);
  alertaSafe_('🔍 AUX_MUNICIPIOS', msg);
}