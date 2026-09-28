```js
/* =========================================================
   BUGÜNÜN MAÇLARI MENÜSÜ
   DATA ve MARKETS değişkenlerini kullanır.
========================================================= */
(function () {
  'use strict';

  var START = '2026-09-01';

  /* ---------- yardımcılar ---------- */
  function $(id) {
    return document.getElementById(id);
  }

  function E(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function isEmpty(v) {
    return v == null || String(v).trim() === '';
  }

  function num(v) {
    return isEmpty(v)
      ? NaN
      : Number(String(v).trim().replace(',', '.'));
  }

  function sc(v) {
    var m = String(v || '').match(/(\d+)\s*[-:]\s*(\d+)/);
    return m ? [+m[1], +m[2]] : null;
  }

  function iso(d) {
    return new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);
  }

  function fmtDate(s) {
    var p = String(s).split('-');
    return p.length === 3
      ? p[2] + '.' + p[1] + '.' + p[0]
      : s;
  }

  function fmtRate(p) {
    return String(+p.toFixed(1));
  }

  function hue(p) {
    return Math.round(p * 1.2);
  }

  function marketsMap() {
    return (typeof MARKETS !== 'undefined' && MARKETS)
      ? MARKETS
      : {};
  }

  /* =========================================================
     SONUÇ TÜRLERİ

     f = MS skoru
     h = İY skoru
  ========================================================= */
  var RES = [

    /* MS */
    {
      l: 'MS1',
      odd: 'ms1',
      t: function (f) {
        return f ? f[0] > f[1] : null;
      }
    },

    {
      l: 'MS0',
      odd: 'ms0',
      t: function (f) {
        return f ? f[0] === f[1] : null;
      }
    },

    {
      l: 'MS2',
      odd: 'ms2',
      t: function (f) {
        return f ? f[0] < f[1] : null;
      }
    },

    /* KG */
    {
      l: 'KG Var',
      odd: 'kgVar',
      t: function (f) {
        return f
          ? (f[0] > 0 && f[1] > 0)
          : null;
      }
    },

    /* MS 2,5 Üst */
    {
      l: '2,5 Üst',
      odd: 'over25',
      t: function (f) {
        return f
          ? (f[0] + f[1]) > 2.5
          : null;
      }
    },

    /* =====================================================
       İLK YARI SONUÇLARI
    ===================================================== */

    {
      l: 'İY1',
      odd: 'iy1',
      t: function (f, h) {
        return h ? h[0] > h[1] : null;
      }
    },

    {
      l: 'İY0',
      odd: 'iy0',
      t: function (f, h) {
        return h ? h[0] === h[1] : null;
      }
    },

    {
      l: 'İY2',
      odd: 'iy2',
      t: function (f, h) {
        return h ? h[0] < h[1] : null;
      }
    },

    {
      l: 'İY 0,5 Üst',
      odd: 'iyOver05',
      t: function (f, h) {
        return h
          ? (h[0] + h[1]) > 0.5
          : null;
      }
    },

    {
      l: 'İY 1,5 Üst',
      odd: 'iyOver15',
      t: function (f, h) {
        return h
          ? (h[0] + h[1]) > 1.5
          : null;
      }
    }
  ];


  /* =========================================================
     EŞLEŞTİRME MENÜSÜ
  ========================================================= */
  var BASIS = [

    {
      v: 'ms1',
      l: 'MS1 oranı aynı olanlar'
    },

    {
      v: 'ms0',
      l: 'MS0 oranı aynı olanlar'
    },

    {
      v: 'ms2',
      l: 'MS2 oranı aynı olanlar'
    },

    {
      v: 'ms1,ms2',
      l: 'MS1 + MS2 oranı aynı olanlar'
    },

    {
      v: 'ms1,ms0,ms2',
      l: 'MS1 + MS0 + MS2 aynı olanlar'
    },

    {
      v: 'ms1,ms2,over25',
      l: 'MS1 + MS2 + 2,5 Üst aynı olanlar'
    },

    /* ---------- İY ---------- */

    {
      v: 'iy1',
      l: 'İY1 oranı aynı olanlar'
    },

    {
      v: 'iy2',
      l: 'İY2 oranı aynı olanlar'
    },

    {
      v: 'iy1,iy2',
      l: 'İY1 + İY2 oranı aynı olanlar'
    },

    {
      v: 'iyOver15',
      l: 'İY 1,5 Üst oranı aynı olanlar'
    },

    {
      v: 'iy1,iy2,iyOver15',
      l: 'İY1 + İY2 + İY 1,5 Üst aynı olanlar'
    }
  ];


  /* =========================================================
     STİL
  ========================================================= */
  var css = '' +

    '.td-panel{' +
      'background:#0d1422;' +
      'border:1px solid #1d2a3d;' +
      'border-radius:8px;' +
      'padding:16px;' +
      'margin:14px 0' +
    '}' +

    '.td-panel h2{' +
      'margin:0 0 10px;' +
      'text-transform:uppercase;' +
      'letter-spacing:.06em;' +
      'font-size:14px;' +
      'color:#e4ebf7' +
    '}' +

    '.td-ctl{' +
      'display:grid;' +
      'grid-template-columns:repeat(4,1fr);' +
      'gap:10px;' +
      'margin-top:12px' +
    '}' +

    '.td-ctl .field{' +
      'display:flex;' +
      'flex-direction:column;' +
      'gap:6px' +
    '}' +

    '.td-ctl label{' +
      'font-size:12px;' +
      'color:#9ba6bf' +
    '}' +

    '.td-checks{' +
      'display:flex;' +
      'flex-wrap:wrap;' +
      'gap:14px;' +
      'margin-top:12px;' +
      'font-size:13px;' +
      'color:#c9d1e5' +
    '}' +

    '.td-checks label{' +
      'display:flex;' +
      'align-items:center;' +
      'gap:6px;' +
      'cursor:pointer' +
    '}' +

    '.td-stats{' +
      'display:grid;' +
      'grid-template-columns:repeat(3,1fr);' +
      'gap:8px;' +
      'margin:14px 0' +
    '}' +

    '.td-stat{' +
      'background:#111b2d;' +
      'border:1px solid #1d2a3d;' +
      'border-radius:6px;' +
      'padding:10px' +
    '}' +

    '.td-stat span{' +
      'display:block;' +
      'font-size:11px;' +
      'color:#8290a7' +
    '}' +

    '.td-stat b{' +
      'display:block;' +
      'margin-top:3px;' +
      'font-size:17px;' +
      'color:#e8eef8' +
    '}' +

    '.td-card{' +
      'background:#0d1422;' +
      'border:1px solid #1d2a3d;' +
      'border-radius:10px;' +
      'margin-bottom:8px;' +
      'overflow:hidden' +
    '}' +

    '.td-head{' +
      'display:flex;' +
      'align-items:center;' +
      'gap:10px;' +
      'padding:10px' +
    '}' +

    '.td-plus{' +
      'flex:0 0 32px;' +
      'width:32px;' +
      'height:32px;' +
      'border-radius:8px;' +
      'border:1px solid #2b4058;' +
      'background:#111d30;' +
      'color:#9fb6d1;' +
      'font-size:20px;' +
      'line-height:1;' +
      'cursor:pointer' +
    '}' +

    '.td-card.open .td-plus{' +
      'background:#1d6ef2;' +
      'border-color:#1d6ef2;' +
      'color:#fff' +
    '}' +

    '.td-info{' +
      'flex:1;' +
      'min-width:0' +
    '}' +

    '.td-meta{' +
      'font-size:11px;' +
      'color:#8290a7;' +
      'white-space:nowrap;' +
      'overflow:hidden;' +
      'text-overflow:ellipsis' +
    '}' +

    '.td-teams{' +
      'margin-top:3px;' +
      'font-size:14px;' +
      'font-weight:700;' +
      'color:#f0f4fb;' +
      'white-space:nowrap;' +
      'overflow:hidden;' +
      'text-overflow:ellipsis' +
    '}' +

    '.td-chip{' +
      'flex:0 0 auto;' +
      'font-size:11px;' +
      'font-weight:800;' +
      'padding:5px 8px;' +
      'border-radius:6px;' +
      'white-space:nowrap;' +
      'color:hsl(var(--h),85%,66%);' +
      'background:hsl(var(--h),60%,13%);' +
      'border:1px solid hsl(var(--h),55%,30%)' +
    '}' +

    '.td-chip.none{' +
      'color:#7d8aa3;' +
      'background:#111b2d;' +
      'border-color:#1d2a3d;' +
      'font-weight:600' +
    '}' +

    '.td-body{' +
      'display:none;' +
      'border-top:1px solid #1b2738;' +
      'background:#0a111d;' +
      'padding:10px' +
    '}' +

    '.td-card.open .td-body{' +
      'display:block' +
    '}' +

    '.td-sub{' +
      'font-size:11px;' +
      'color:#8290a7;' +
      'margin-bottom:8px;' +
      'line-height:1.5' +
    '}' +

    '.td-grid{' +
      'display:grid;' +
      'grid-template-columns:repeat(3,minmax(0,1fr));' +
      'gap:6px' +
    '}' +

    '.td-box{' +
      'min-width:0;' +
      'text-align:center;' +
      'padding:8px 4px;' +
      'border-radius:8px;' +
      'background:hsl(var(--h),60%,12%);' +
      'border:1px solid hsl(var(--h),50%,26%)' +
    '}' +

    '.td-box.ideal{' +
      'border-color:hsl(var(--h),70%,46%);' +
      'box-shadow:0 0 0 1px hsl(var(--h),70%,40%) inset' +
    '}' +

    '.td-box.dim{' +
      'opacity:.5' +
    '}' +

    '.td-l{' +
      'display:block;' +
      'font-size:11px;' +
      'font-weight:700;' +
      'color:#dbe5f3;' +
      'white-space:nowrap;' +
      'overflow:hidden;' +
      'text-overflow:ellipsis' +
    '}' +

    '.td-box b{' +
      'display:block;' +
      'margin-top:4px;' +
      'font-size:18px;' +
      'line-height:1.1;' +
      'color:hsl(var(--h),85%,62%)' +
    '}' +

    '.td-n{' +
      'display:block;' +
      'margin-top:3px;' +
      'font-size:10px;' +
      'color:#9aa8c9' +
    '}' +

    '.td-o{' +
      'display:block;' +
      'margin-top:2px;' +
      'font-size:10px;' +
      'color:#6f7f9f' +
    '}' +

    '.td-empty{' +
      'background:#0d1422;' +
      'border:1px solid #1d2a3d;' +
      'border-radius:8px;' +
      'padding:22px;' +
      'text-align:center;' +
      'color:#9ba6bf;' +
      'line-height:1.7' +
    '}' +

    '.td-empty button{' +
      'margin:4px;' +
      'padding:8px 12px;' +
      'border-radius:8px;' +
      'border:1px solid #33405f;' +
      'background:#18223a;' +
      'color:#e8ecf7;' +
      'font-weight:700;' +
      'cursor:pointer' +
    '}' +

    '.td-note{' +
      'font-size:12px;' +
      'color:#8290a7;' +
      'padding:2px' +
    '}' +

    '@media(max-width:800px){' +
      '.td-ctl{grid-template-columns:repeat(2,1fr)}' +
    '}' +

    '@media(max-width:520px){' +
      '.td-panel{padding:12px}' +
      '.td-ctl{grid-template-columns:1fr 1fr;gap:8px}' +
      '.td-ctl .wide{grid-column:span 2}' +
      '.td-stats{gap:6px}' +
      '.td-stat{padding:8px}' +
      '.td-stat b{font-size:14px}' +
      '.td-stat span{font-size:10px}' +
      '.td-head{padding:8px;gap:8px}' +
      '.td-teams{font-size:13px}' +
      '.td-chip{font-size:10px;padding:4px 6px}' +
      '.td-body{padding:8px}' +
      '.td-grid{gap:5px}' +
      '.td-box{padding:7px 2px}' +
      '.td-l{font-size:10px}' +
      '.td-box b{font-size:15px}' +
      '.td-n,.td-o{font-size:9px}' +
    '}';

  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);


  /* =========================================================
     SEKME
  ========================================================= */
  var tabs = document.querySelector('.tabs');

  var btn = document.createElement('button');
  btn.className = 'tab';
  btn.dataset.tab = 'todayTab';
  btn.textContent = 'Bugünün maçları';

  btn.onclick = function () {
    showTab('todayTab');
    render();
  };

  if (tabs) {
    tabs.insertBefore(btn, tabs.firstChild);
  }


  /* =========================================================
     BÖLÜM
  ========================================================= */
  var sec = document.createElement('section');

  sec.id = 'todayTab';
  sec.hidden = true;

  sec.innerHTML =
    '<div class="td-panel">' +

      '<h2>Bugünün maçları</h2>' +

      '<div class="notice">' +
        'Oynanmamış maçlar listelenir. Maçın yanındaki <b>+</b> ' +
        'butonuna basınca, seçilen eşleştirmeye göre ' +
        '<b>' + fmtDate(START) + ' ve sonrası</b> oynanmış maçların ' +
        'sonuç yüzdeleri gösterilir. ' +
        'Oynanmamış maçlar yüzde hesabına girmez.' +
      '</div>' +

      '<div class="td-ctl">' +

        '<div class="field">' +
          '<label for="tdDate">Maç günü</label>' +
          '<input id="tdDate" type="date" class="input">' +
        '</div>' +

        '<div class="field wide">' +
          '<label for="tdBasis">Eşleştirme</label>' +
          '<select id="tdBasis" class="select"></select>' +
        '</div>' +

        '<div class="field">' +
          '<label for="tdThr">İdeal eşik (%)</label>' +
          '<input id="tdThr" type="number" class="input" value="70" min="0" max="100">' +
        '</div>' +

        '<div class="field">' +
          '<label for="tdMin">Min. geçmiş maç</label>' +
          '<input id="tdMin" type="number" class="input" value="5" min="1">' +
        '</div>' +

      '</div>' +

      '<div class="td-checks">' +

        '<label>' +
          '<input type="checkbox" id="tdOnly">' +
          ' Sadece ideal sonucu olan maçlar' +
        '</label>' +

        '<label>' +
          '<input type="checkbox" id="tdAll">' +
          ' Tüm sonuçları göster' +
        '</label>' +

      '</div>' +

    '</div>' +

    '<div id="tdStats"></div>' +

    '<div id="tdList"></div>';


  var anchor = $('futureTab');

  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  } else {
    document.body.appendChild(sec);
  }


  /* =========================================================
     MENÜYÜ DOLDUR
  ========================================================= */
  $('tdDate').value = iso(new Date());

  $('tdBasis').innerHTML = BASIS.map(function (b) {
    return '<option value="' + b.v + '">' +
      E(b.l) +
    '</option>';
  }).join('');


  ['tdDate', 'tdBasis', 'tdThr', 'tdMin', 'tdOnly', 'tdAll']
    .forEach(function (id) {

      $(id).addEventListener('change', render);

    });


  $('tdThr').addEventListener('input', render);
  $('tdMin').addEventListener('input', render);


  /* =========================================================
     TIKLAMALAR
  ========================================================= */
  sec.addEventListener('click', function (e) {

    var p = e.target.closest
      ? e.target.closest('.td-plus')
      : null;

    if (p) {
      p.closest('.td-card').classList.toggle('open');
      return;
    }

    var d = e.target.closest
      ? e.target.closest('[data-d]')
      : null;

    if (d) {
      $('tdDate').value = d.getAttribute('data-d');
      render();
    }

  });


  /* =========================================================
     ANALİZ
  ========================================================= */
  function analyze(r, keys, pool, thr, min) {

    var odds = r.odds || {};

    /*
      Seçilen bütün oranların mevcut olup olmadığını kontrol et.
    */
    var has = keys.every(function (k) {

      return !isEmpty(odds[k]);

    });

    if (!has) {
      return null;
    }


    /*
      Aynı oranlara sahip geçmiş maçları bul.
    */
    var hist = pool.filter(function (x) {

      return keys.every(function (k) {

        var a = num(x.odds[k]);
        var b = num(odds[k]);

        return isFinite(a) &&
               isFinite(b) &&
               a === b;

      });

    });


    /*
      Sonuç istatistikleri
    */
    var list = RES.map(function (d) {

      var n = 0;
      var t = 0;

      hist.forEach(function (x) {

        var v = d.t(x.f, x.h);

        if (v === null || v === undefined) {
          return;
        }

        t++;

        if (v) {
          n++;
        }

      });


      return {
        d: d,
        n: n,
        t: t,
        p: t ? 100 * n / t : 0,

        /*
          O anki maçın ilgili oranını göster.
        */
        odd: odds[d.odd]
      };

    });


    /*
      İdeal sonuç
    */
    list.forEach(function (x) {

      x.ideal =
        x.t >= min &&
        x.p >= thr;

    });


    /*
      Önce ideal,
      sonra yüzde,
      sonra maç sayısı.
    */
    list.sort(function (a, b) {

      return (
        (b.ideal - a.ideal) ||
        (b.p - a.p) ||
        (b.t - a.t)
      );

    });


    return {
      hist: hist.length,
      list: list,
      ideal: list.filter(function (x) {
        return x.ideal;
      })
    };

  }


  /* =========================================================
     SONUÇ KUTUSU
  ========================================================= */
  function boxHtml(x) {

    var h = hue(x.p);

    return (

      '<div class="td-box' +
        (x.ideal ? ' ideal' : ' dim') +
        '" style="--h:' + h + '">' +

        '<span class="td-l">' +
          E(x.d.l) +
        '</span>' +

        '<b>%' +
          fmtRate(x.p) +
        '</b>' +

        '<span class="td-n">' +
          x.n + '/' + x.t +
        '</span>' +

        (
          x.odd != null &&
          String(x.odd).trim() !== ''
            ? '<span class="td-o">' +
                E(x.odd) +
              '</span>'
            : ''
        ) +

      '</div>'

    );

  }


  /* =========================================================
     ÇİZİM
  ========================================================= */
  function render() {

    var out = $('tdList');
    var stats = $('tdStats');

    if (!out) {
      return;
    }


    var date =
      $('tdDate').value ||
      iso(new Date());

    var keys =
      $('tdBasis').value.split(',');

    var thr =
      Number($('tdThr').value) || 0;

    var min =
      Math.max(
        1,
        Number($('tdMin').value) || 1
      );

    var showAll =
      $('tdAll').checked;

    var onlyIdeal =
      $('tdOnly').checked;


    /*
      DATA
    */
    var src =
      (typeof DATA !== 'undefined' &&
       Array.isArray(DATA))
        ? DATA
        : [];


    /*
      Geçmiş havuzu
      SADECE:
      - oynanmış
      - START ve sonrası
    */
    var pool = src
      .filter(function (x) {

        return (
          x.played &&
          String(x.date) >= START
        );

      })
      .map(function (x) {

        return {

          odds: x.odds || {},

          f: sc(x.scoreFT),

          h: sc(x.scoreHT)

        };

      });


    /*
      Bugünün oynanmamış maçları
    */
    var today = src
      .filter(function (x) {

        return (
          !x.played &&
          x.date === date
        );

      })
      .sort(function (a, b) {

        return String(a.time)
          .localeCompare(
            String(b.time)
          );

      });


    /*
      Analiz
    */
    var items = today.map(function (r) {

      return {

        r: r,

        a: analyze(
          r,
          keys,
          pool,
          thr,
          min
        )

      };

    });


    var idealCount =
      items.filter(function (i) {

        return (
          i.a &&
          i.a.ideal.length
        );

      }).length;


    if (onlyIdeal) {

      items =
        items.filter(function (i) {

          return (
            i.a &&
            i.a.ideal.length
          );

        });

    }


    /*
      İstatistik kutuları
    */
    stats.innerHTML =

      '<div class="td-stats">' +

        '<div class="td-stat">' +
          '<span>Oynanmamış maç</span>' +
          '<b>' + today.length + '</b>' +
        '</div>' +

        '<div class="td-stat">' +
          '<span>İdeal sonuçlu</span>' +
          '<b>' + idealCount + '</b>' +
        '</div>' +

        '<div class="td-stat">' +
          '<span>Analiz havuzu</span>' +
          '<b>' +
            pool.length.toLocaleString('tr-TR') +
          '</b>' +
        '</div>' +

      '</div>';


    /*
      Maç yok
    */
    if (!today.length) {

      var dates = [];

      src.forEach(function (x) {

        if (
          !x.played &&
          x.date &&
          String(x.date) >= date &&
          dates.indexOf(x.date) < 0
        ) {

          dates.push(x.date);

        }

      });


      dates.sort();


      out.innerHTML =

        '<div class="td-empty">' +

          fmtDate(date) +
          ' için oynanmamış maç bulunamadı.' +

          (
            dates.length

              ? '<br>Maç olan günler:<br>' +

                dates
                  .slice(0, 6)
                  .map(function (d) {

                    return (
                      '<button data-d="' +
                      d +
                      '">' +
                      fmtDate(d) +
                      '</button>'
                    );

                  })
                  .join('')

              : '<br>Excel’de ileri tarihli maç yok.'
          ) +

        '</div>';

      return;

    }


    /*
      İdeal maç yok
    */
    if (!items.length) {

      out.innerHTML =

        '<div class="td-empty">' +

          'Bu ayarlarla ideal sonucu olan maç yok. ' +
          'Eşiği veya minimum maç sayısını düşürebilirsin.' +

        '</div>';

      return;

    }


    /*
      Maç kartları
    */
    out.innerHTML = items.map(function (i) {

      var r = i.r;
      var a = i.a;

      var chip;
      var body;


      if (!a) {

        chip =
          '<span class="td-chip none">' +
            'Oran yok' +
          '</span>';

        body =
          '<div class="td-note">' +
            'Bu maçta seçilen eşleştirme oranları ' +
            'veri içinde bulunmuyor.' +
          '</div>';

      } else {

        var best = a.ideal[0];

        chip = best

          ? '<span class="td-chip" style="--h:' +
              hue(best.p) +
            '">' +
              E(best.d.l) +
              ' %' +
              fmtRate(best.p) +
            '</span>'

          : '<span class="td-chip none">' +
              'İdeal yok' +
            '</span>';


        var shown =
          showAll
            ? a.list
            : a.ideal;


        body =

          '<div class="td-sub">' +

            'Aynı oranlı geçmiş maç: <b>' +
              a.hist +
            '</b> (' +
              fmtDate(START) +
            ' ve sonrası) · ' +

            'eşik %' +
              thr +
            ' · en az ' +
              min +
            ' maç' +

          '</div>' +

          (
            shown.length

              ? '<div class="td-grid">' +
                  shown
                    .map(boxHtml)
                    .join('') +
                '</div>'

              : '<div class="td-note">' +
                  'İdeal sonuç yok. ' +
                  '“Tüm sonuçları göster” ile ' +
                  'hepsini görebilirsin.' +
                '</div>'
          );

      }


      return (

        '<div class="td-card">' +

          '<div class="td-head">' +

            '<button ' +
              'class="td-plus" ' +
              'type="button" ' +
              'aria-label="Sonuçları aç/kapat">' +
              '+' +
            '</button>' +

            '<div class="td-info">' +

              '<div class="td-meta">' +
                E(r.time || '') +
                (
                  r.league
                    ? ' · ' + E(r.league)
                    : ''
                ) +
              '</div>' +

              '<div class="td-teams">' +
                E(r.home) +
                ' - ' +
                E(r.away) +
              '</div>' +

            '</div>' +

            chip +

          '</div>' +

          '<div class="td-body">' +
            body +
          '</div>' +

        '</div>'

      );

    }).join('');

  }


  /*
    Açılışta otomatik açmak istersen:
    
    showTab('todayTab');
    render();
  */

})();
```
