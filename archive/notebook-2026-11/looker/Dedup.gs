/**
 * ============================================================
 * Dedup.gs — Deduplicação
 * Monteiro e Monteiro — Controle Documental v3.0
 * ============================================================
 * 
 * REGRA 4: Lê tudo, processa em memória, regrava em batch.
 */

function deduplicar() {
  Logger.log('═══ Deduplicação ═══');
  var ss = getSS_();
  var sheet = getSheet_(CONFIG.ABAS.BASE_UNICA);
  if (!sheet || sheet.getLastRow() < 2) { alertaSafe_('❌', 'Base Única vazia.'); return; }

  var logSheet = ss.getSheetByName(CONFIG.ABAS.LOG_DUPLICATAS);
  if (logSheet) ss.deleteSheet(logSheet);

  var C = CONFIG.COL;

  // REGRA 4: Leitura batch
  var dados = sheet.getDataRange().getValues();
  var headers = dados[0];

  // Agrupar por chave
  var grupos = {};
  for (var r = 1; r < dados.length; r++) {
    var uf = normalizar_(dados[r][C.UF]);
    var mun = normalizar_(dados[r][C.MUNICIPIO]);
    var mat = normalizar_(dados[r][C.MATERIA]);
    var proc = normalizar_(dados[r][C.PROCESSO]);
    if (!uf || !mun || !mat) continue;

    var chave = uf + '|' + mun + '|' + mat + '|' + proc;
    if (!grupos[chave]) grupos[chave] = [];

    var camposPreen = 0;
    for (var i = 0; i < dados[r].length; i++) {
      if (dados[r][i] !== '' && dados[r][i] !== null && dados[r][i] !== undefined) camposPreen++;
    }

    grupos[chave].push({
      rowIndex: r,
      rowNumber: r + 1,
      data: dados[r],
      filial: String(dados[r][C.FILIAL]).trim(),
      uf: String(dados[r][C.UF]).trim(),
      camposPreenchidos: camposPreen,
      dataInclusao: dados[r][C.DATA_INCLUSAO]
    });
  }

  // Resolver duplicatas
  var linhasRemover = {};
  var linhasManter = {};

  for (var chave in grupos) {
    var grupo = grupos[chave];
    if (grupo.length <= 1) continue;

    grupo.sort(function(a, b) {
      var aGeo = (CONFIG.UF_FILIAL[a.uf] === a.filial) ? 1 : 0;
      var bGeo = (CONFIG.UF_FILIAL[b.uf] === b.filial) ? 1 : 0;
      if (aGeo !== bGeo) return bGeo - aGeo;
      if (a.camposPreenchidos !== b.camposPreenchidos) return b.camposPreenchidos - a.camposPreenchidos;
      var dA = a.dataInclusao instanceof Date ? a.dataInclusao.getTime() : 0;
      var dB = b.dataInclusao instanceof Date ? b.dataInclusao.getTime() : 0;
      return dB - dA;
    });

    var mantida = grupo[0];
    var filiaisRemovidas = [];

    for (var g = 1; g < grupo.length; g++) {
      var removida = grupo[g];
      linhasRemover[removida.rowIndex] = true;
      filiaisRemovidas.push(removida.filial);

      logEntry_(CONFIG.ABAS.LOG_DUPLICATAS, [
        removida.rowNumber, removida.filial,
        String(removida.data[C.UF]), String(removida.data[C.MUNICIPIO]),
        String(removida.data[C.MATERIA]), String(removida.data[C.PROCESSO]),
        'Duplicata — mantida L' + mantida.rowNumber, mantida.rowNumber
      ]);
    }

    linhasManter[mantida.rowIndex] = filiaisRemovidas;
  }

  // Concatenar filiais nas mantidas (em memória)
  for (var mIdx in linhasManter) {
    var idx = parseInt(mIdx);
    var fRemov = linhasManter[idx];
    var filAtual = String(dados[idx][C.FILIAL] || '').trim();
    var todas = [filAtual];
    for (var fi = 0; fi < fRemov.length; fi++) {
      if (todas.indexOf(fRemov[fi]) === -1) todas.push(fRemov[fi]);
    }
    dados[idx][C.FILIAL] = todas.join(', ');
  }

  // REGRA 4: Reconstruir e gravar de uma vez
  var totalRemovidas = Object.keys(linhasRemover).length;
  if (totalRemovidas > 0) {
    var dadosLimpos = [headers];
    for (var r2 = 1; r2 < dados.length; r2++) {
      if (!linhasRemover[r2]) dadosLimpos.push(dados[r2]);
    }

    sheet.clearContents();
    sheet.getRange(1, 1, dadosLimpos.length, headers.length).setValues(dadosLimpos);
    formatarHeader_(sheet, headers.length);
    aplicarBanding_(sheet);
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1, 1, 1, headers.length).createFilter();
    SpreadsheetApp.flush();
  }

  alertaSafe_('✅ Deduplicação',
    'Removidas: ' + totalRemovidas + '\nRestantes: ' + (dados.length - 1 - totalRemovidas));
}
