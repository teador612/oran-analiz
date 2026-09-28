/* ---------- analiz ---------- */
  function analyzeEach(r, cfg) {
    var rows = [], M = marketsMap(), odds = r.odds || {};
    var seenKeys = {}; // Tekrarlayan verileri tespit etmek için kontrol objesi

    Object.keys(odds).forEach(function (k) {
      if (!(k in M)) return;
      var n = num(odds[k]);
      if (!(n >= cfg.minOdd)) return;
      var hist = CUR.idxPlayed[k + '|' + n];
      if (!hist || !hist.length) return;
      
      var list = statsOf(hist, null, cfg.thr, cfg.min);
      var top = list[0];

      // ORAN + SONUÇ YÜZDELERİ TEKRAR KONTROLÜ
      // Eğer market etiketi, oran değeri ve en yüksek yüzdeler birebir aynıysa 2. kez ekleme!
      var sig = M[k] + '|' + odds[k] + '|' + hist.length + '|' + (top ? top.d.l + '_' + top.p : '');
      if (seenKeys[sig]) return;
      seenKeys[sig] = true;

      rows.push({
        k: k,
        label: M[k],
        odd: odds[k],
        n: n,
        hist: hist,
        list: list,
        ideal: list.filter(function (x) { return x.ideal; }),
        top: top
      });
    });

    rows.sort(function (a, b) {
      return ((b.ideal.length > 0) - (a.ideal.length > 0)) || (b.top.p - a.top.p) || (b.top.t - a.top.t);
    });

    var best = null;
    rows.forEach(function (rw) {
      if (!rw.ideal.length) return;
      var t = rw.ideal[0];
      if (!best || t.p > best.p || (t.p === best.p && t.t > best.t)) best = t;
    });

    var idealRows = rows.filter(function (x) { return x.ideal.length; });
    return { mode: 'each', rows: rows, idealRows: idealRows, best: best, hasIdeal: idealRows.length > 0 };
  }
