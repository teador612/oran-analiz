/* =========================================================
   BUGÜNÜN MAÇLARI MENÜSÜ
   v3 - JSON CANLI SKOR + SEKME GÖRÜNÜRLÜK DÜZELTMESİ

   index.html içindeki:
   DATA / MARKETS / MIN_ODD / showTab
   değişkenlerini kullanır.

   Bölümü ve sekmeyi kendisi oluşturur.
========================================================= */

(function () {
  'use strict';

  var START = '2026-09-01';

  var CUR = {
    items: [],
    idxPlayed: {},
    idxUnp: {},
    cfg: {},
    liveScores: {}
  };

  var LIVE_JSON_URL =
    'https://teador612.github.io/mackolik1/data/matches.json';

  /* =========================================================
     YARDIMCILAR
  ========================================================= */

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
    var p = String(s || '').split('-');

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
    return (
      typeof MARKETS !== 'undefined' && MARKETS
    )
      ? MARKETS
      : {};
  }

  function defMinOdd() {
    return (
      typeof MIN_ODD !== 'undefined' &&
      isFinite(MIN_ODD)
    )
      ? MIN_ODD
      : 1.4;
  }

  /* =========================================================
     TAKIM İSMİ EŞLEŞTİRME
  ========================================================= */

  function cleanTeamName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(
        /fc|sc|cd|de|club|atletico|deportivo|fk|sk|sporting/g,
        ''
      )
      .replace(/[^a-z0-9ğüşıöç]/g, '')
      .trim();
  }

  function isTeamMatch(t1, t2) {
    var c1 = cleanTeamName(t1);
    var c2 = cleanTeamName(t2);

    if (!c1 || !c2) return false;

    if (c1 === c2) return true;

    if (c1.length > 3 && c2.length > 3) {
      return c1.includes(c2) || c2.includes(c1);
    }

    return false;
  }

  /* =========================================================
     SONUÇ TÜRLERİ
  ========================================================= */

  var RES = [
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
    {
      l: 'KG Var',
      odd: 'kgVar',
      t: function (f) {
        return f
          ? f[0] > 0 && f[1] > 0
          : null;
      }
    },
    {
      l: '2,5 Üst',
      odd: 'over25',
      t: function (f) {
        return f
          ? f[0] + f[1] > 2.5
          : null;
      }
    },
    {
      l: 'İY 0,5 Üst',
      odd: 'iyOver05',
      t: function (f, h) {
        return h
          ? h[0] + h[1] > 0.5
          : null;
      }
    },
    {
      l: 'İY 1,5 Üst',
      odd: 'iyOver15',
      t: function (f, h) {
        return h
          ? h[0] + h[1] > 1.5
          : null;
      }
    }
  ];

  var BASIS = [
    {
      v: 'each',
      l: 'Her oran türü tek tek (önerilen)'
    },
    {
      v: 'ms1',
      l: 'Sadece MS1 oranı aynı olanlar'
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
      v: 'league',
      l: 'Oransız: aynı ligdeki maçlar'
    },
    {
      v: 'team',
      l: 'Oransız: iki takımın tüm maçları'
    },
    {
      v: 'all',
      l: 'Oransız: tüm maçlar'
    }
  ];

  var NOODDS = [
    'league',
    'team',
    'all'
  ];

  /* =========================================================
     CSS
  ========================================================= */

  var css = '' +

    '.td-panel{background:#0d1422;border:1px solid #1d2a3d;border-radius:8px;padding:16px;margin:14px 0}' +

    '.td-panel h2{margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em;font-size:14px;color:#e4ebf7}' +

    '.td-ctl{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:12px}' +

    '.td-ctl .field{display:flex;flex-direction:column;gap:6px}' +

    '.td-ctl label{font-size:12px;color:#9ba6bf}' +

    '.td-checks{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:13px;color:#c9d1e5}' +

    '.td-checks label{display:flex;align-items:center;gap:6px;cursor:pointer}' +

    '.td-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}' +

    '.td-stat{background:#111b2d;border:1px solid #1d2a3d;border-radius:6px;padding:10px}' +

    '.td-stat span{display:block;font-size:11px;color:#8290a7}' +

    '.td-stat b{display:block;margin-top:3px;font-size:17px;color:#e8eef8}' +

    '.td-card{background:#0d1422;border:1px solid #1d2a3d;border-radius:10px;margin-bottom:8px;overflow:hidden}' +

    '.td-head{display:flex;align-items:center;gap:10px;padding:10px}' +

    '.td-plus{flex:0 0 32px;width:32px;height:32px;border-radius:8px;border:1px solid #2b4058;background:#111d30;color:#9fb6d1;font-size:20px;line-height:1;cursor:pointer}' +

    '.td-card.open>.td-head .td-plus{background:#1d6ef2;border-color:#1d6ef2;color:#fff}' +

    '.td-info{flex:1;min-width:0}' +

    '.td-meta{font-size:11px;color:#8290a7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +

    '.td-teams{margin-top:3px;font-size:14px;font-weight:700;color:#f0f4fb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +

    '.td-score{flex:0 0 auto;font-size:13px;font-weight:800;padding:4px 8px;border-radius:6px;background:#18263a;color:#00ffcc;border:1px solid #283d5a;margin-right:4px}' +

    '.td-score.live{background:#e74c3c;color:#fff;border-color:#c0392b;animation:pulse 1.5s infinite}' +

    '@keyframes pulse{0%{opacity:1}50%{opacity:.6}100%{opacity:1}}' +

    '.td-chip{flex:0 0 auto;font-size:11px;font-weight:800;padding:5px 8px;border-radius:6px;white-space:nowrap;color:hsl(var(--h),85%,66%);background:hsl(var(--h),60%,13%);border:1px solid hsl(var(--h),55%,30%)}' +

    '.td-chip.none{color:#7d8aa3;background:#111b2d;border-color:#1d2a3d;font-weight:600}' +

    '.td-body{display:none;border-top:1px solid #1b2738;background:#0a111d;padding:10px}' +

    '.td-card.open>.td-body{display:block}' +

    '.td-sub{font-size:11px;color:#8290a7;margin-bottom:8px;line-height:1.5}' +

    '.td-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}' +

    '.td-box{min-width:0;text-align:center;padding:8px 4px;border-radius:8px;background:hsl(var(--h),60%,12%);border:1px solid hsl(var(--h),50%,26%)}' +

    '.td-box.ideal{border-color:hsl(var(--h),70%,46%);box-shadow:0 0 0 1px hsl(var(--h),70%,40%) inset}' +

    '.td-box.dim{opacity:.5}' +

    '.td-l{display:block;font-size:11px;font-weight:700;color:#dbe5f3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +

    '.td-box b{display:block;margin-top:4px;font-size:18px;line-height:1.1;color:hsl(var(--h),85%,62%)}' +

    '.td-n{display:block;margin-top:3px;font-size:10px;color:#9aa8c9}' +

    '.td-o{display:block;margin-top:2px;font-size:10px;color:#6f7f9f}' +

    '.td-row{background:#0d1422;border:1px solid #1d2a3d;border-radius:8px;margin-bottom:7px;padding:8px}' +

    '.td-rh{display:flex;align-items:center;gap:8px;margin-bottom:7px}' +

    '.td-p2{flex:0 0 26px;width:26px;height:26px;border-radius:7px;border:1px solid #2b4058;background:#111d30;color:#9fb6d1;font-size:16px;line-height:1;cursor:pointer}' +

    '.td-row.open .td-p2{background:#1d6ef2;border-color:#1d6ef2;color:#fff}' +

    '.td-rt{font-size:13px;font-weight:700;color:#f0f4fb;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +

    '.td-ro{flex:0 0 auto;font-size:13px;font-weight:800;color:#5fd4cc}' +

    '.td-rn{flex:1;text-align:right;font-size:10px;color:#8290a7;white-space:nowrap}' +

    '.td-det{display:none;margin-top:8px;border-top:1px solid #1b2738;padding-top:6px}' +

    '.td-row.open .td-det{display:block}' +

    '.td-dh{font-size:11px;color:#8290a7;margin:2px 0 6px;line-height:1.5}' +

    '.td-m{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid #182538;font-size:12px;color:#dbe5f3}' +

    '.td-m.unp{opacity:.55}' +

    '.td-mt b{display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +

    '.td-mt small{display:block;margin-top:2px;font-size:10px;color:#7f8daf;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +

    '.td-m span{white-space:nowrap;font-size:11px;color:#b7c4d8}' +

    '.td-empty{background:#0d1422;border:1px solid #1d2a3d;border-radius:8px;padding:22px;text-align:center;color:#9ba6bf;line-height:1.7}' +

    '.td-empty button{margin:4px;padding:8px 12px;border-radius:8px;border:1px solid #33405f;background:#18223a;color:#e8ecf7;font-weight:700;cursor:pointer}' +

    '.td-note{font-size:12px;color:#8290a7;padding:2px}' +

    '@media(max-width:800px){.td-ctl{grid-template-columns:repeat(2,1fr)}}' +

    '@media(max-width:520px){' +
      '.td-panel{padding:12px}' +
      '.td-ctl{gap:8px}.td-ctl .wide{grid-column:span 2}' +
      '.td-stats{gap:6px}.td-stat{padding:8px}.td-stat b{font-size:14px}.td-stat span{font-size:10px}' +
      '.td-head{padding:8px;gap:8px}.td-teams{font-size:13px}' +
      '.td-chip{font-size:10px;padding:4px 6px}' +
      '.td-body{padding:8px}.td-grid{gap:5px}' +
      '.td-box{padding:7px 2px}.td-l{font-size:10px}.td-box b{font-size:15px}.td-n,.td-o{font-size:9px}' +
      '.td-row{padding:7px}.td-rt{font-size:12px}.td-ro{font-size:12px}' +
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

    /*
      ÖNEMLİ:
      hidden=true kullanmıyoruz.
      showTab() display üzerinden çalıştığı için
      hidden attribute sekmenin görünmesini engelleyebiliyordu.
    */

    sec.style.display = '';
    sec.hidden = false;

    if (typeof showTab === 'function') {
      showTab('todayTab');
    }

    sec.style.display = '';
    sec.hidden = false;

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

  /*
    .tab-content ekliyoruz.
    index.html içindeki showTab() bunu normal sekme gibi
    yönetebilsin.
  */
  sec.className = 'panel tab-content';

  /*
    hidden ATTRIBUTE YOK.
    İlk açılışta CSS ile gizliyoruz.
  */
  sec.style.display = 'none';

  sec.innerHTML =

    '<div class="td-panel">' +

      '<h2>Bugünün maçları</h2>' +

      '<div class="notice">' +
        'Oynanmamış maçlar listelenir. ' +
        'Maçın yanındaki <b>+</b> butonuna basınca her oran türü için, ' +
        'aynı oranla <b>' + fmtDate(START) + ' ve sonrası</b> ' +
        'oynanmış maçların sonuç yüzdeleri çıkar. ' +
        'Oranın yanındaki <b>+</b> ile o oranlı maçlar listelenir. ' +
        'Oynanmamış maçlar yüzdeye girmez.' +
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

        '<div class="field">' +
          '<label for="tdOdd">Min. oran</label>' +
          '<input id="tdOdd" type="number" class="input" step="0.01" min="1" value="' +
          defMinOdd() +
          '">' +
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
    anchor.parentNode.insertBefore(
      sec,
      anchor.nextSibling
    );
  } else {
    document.body.appendChild(sec);
  }

  /* =========================================================
     KONTROLLER
  ========================================================= */

  if ($('tdDate')) {
    $('tdDate').value = iso(new Date());
  }

  if ($('tdBasis')) {
    $('tdBasis').innerHTML = BASIS.map(function (b) {
      return (
        '<option value="' +
        E(b.v) +
        '">' +
        E(b.l) +
        '</option>'
      );
    }).join('');
  }

  [
    'tdDate',
    'tdBasis',
    'tdThr',
    'tdMin',
    'tdOdd',
    'tdOnly',
    'tdAll'
  ].forEach(function (id) {

    var el = $(id);

    if (!el) return;

    el.addEventListener('change', render);
  });

  [
    'tdThr',
    'tdMin',
    'tdOdd'
  ].forEach(function (id) {

    var el = $(id);

    if (!el) return;

    el.addEventListener('input', render);
  });

  /* =========================================================
     CANLI SKOR JSON
  ========================================================= */

  function fetchLiveScores() {

    fetch(
      LIVE_JSON_URL + '?_=' + Date.now(),
      {
        cache: 'no-store'
      }
    )

      .then(function (res) {

        if (!res.ok) {
          throw new Error(
            'JSON yüklenemedi: ' + res.status
          );
        }

        return res.json();
      })

      .then(function (data) {

        var matches =
          data && Array.isArray(data.matches)
            ? data.matches
            : [];

        var scores = [];

        matches.forEach(function (m) {

          if (!m) return;

          var homeScore =
            m.score &&
            m.score.home != null
              ? String(m.score.home)
              : '';

          var awayScore =
            m.score &&
            m.score.away != null
              ? String(m.score.away)
              : '';

          if (
            /^\d+$/.test(homeScore) &&
            /^\d+$/.test(awayScore)
          ) {

            scores.push({
              home: m.home || '',
              away: m.away || '',
              score:
                homeScore +
                ' - ' +
                awayScore,
              code: m.code
            });
          }
        });

        CUR.liveScores = scores;

        updateScoresOnUI();
        updateMainMatchScores();
      })

      .catch(function (err) {

        console.log(
          'Maçkolik JSON skor hatası:',
          err
        );
      });
  }

  /* =========================================================
     BUGÜNÜN MAÇLARI SKORLARI
  ========================================================= */

  function updateScoresOnUI() {

    if (
      !CUR.liveScores ||
      !CUR.liveScores.length
    ) {
      return;
    }

    CUR.items.forEach(function (it, i) {

      if (!it || !it.r) return;

      var home = it.r.home;
      var away = it.r.away;

      var found =
        CUR.liveScores.find(function (s) {

          if (
            it.r.code &&
            s.code &&
            String(s.code) ===
            String(it.r.code)
          ) {
            return true;
          }

          return (
            isTeamMatch(s.home, home) &&
            isTeamMatch(s.away, away)
          );
        });

      var card =
        document.querySelector(
          '.td-card[data-i="' + i + '"]'
        );

      if (!card) return;

      var existingScore =
        card.querySelector('.td-score');

      if (found) {

        if (!existingScore) {

          existingScore =
            document.createElement('div');

          var chip =
            card.querySelector('.td-chip');

          card
            .querySelector('.td-head')
            .insertBefore(
              existingScore,
              chip
            );
        }

        existingScore.className =
          'td-score';

        existingScore.textContent =
          found.score;
      }
    });
  }

  /* =========================================================
     ANA ANALİZ MAÇ SKORLARI
  ========================================================= */

  function updateMainMatchScores() {

    document
      .querySelectorAll('.match')
      .forEach(function (element) {

        var original =
          element.getAttribute(
            'data-live-base'
          );

        if (!original) {

          original =
            element.textContent.trim();

          element.setAttribute(
            'data-live-base',
            original
          );
        }

        /*
          Daha önce eklediğimiz "Skor:" kısmını
          tekrar parçalamıyoruz.
        */
        var cleanText =
          original
            .replace(
              /\s*·\s*Skor:\s*\d+\s*-\s*\d+/g,
              ''
            )
            .trim();

        var parts =
          cleanText.split(/\s+-\s+/);

        if (parts.length < 2) {
          return;
        }

        var home =
          parts[0].trim();

        var away =
          parts
            .slice(1)
            .join(' - ')
            .trim();

        var found =
          CUR.liveScores.find(function (score) {

            return (
              isTeamMatch(
                score.home,
                home
              ) &&
              isTeamMatch(
                score.away,
                away
              )
            );
          });

        element.textContent =
          found
            ? cleanText +
              ' · Skor: ' +
              found.score
            : cleanText;
      });
  }

  /* =========================================================
     TIKLAMALAR
  ========================================================= */

  sec.addEventListener(
    'click',
    function (e) {

      var t = e.target;

      if (!t.closest) return;

      /* Oran satırı + */
      var p2 =
        t.closest('.td-p2');

      if (p2) {

        var row =
          p2.closest('.td-row');

        var card =
          p2.closest('.td-card');

        if (!row || !card) return;

        row.classList.toggle('open');

        if (
          row.classList.contains('open') &&
          !row.getAttribute('data-f')
        ) {

          var it =
            CUR.items[
              +card.getAttribute('data-i')
            ];

          var rw =
            it &&
            it.shown &&
            it.shown[
              +row.getAttribute(
                'data-r'
              )
            ];

          if (rw) {

            row.querySelector(
              '.td-det'
            ).innerHTML =
              detailHtml(
                it.r,
                rw
              );

            row.setAttribute(
              'data-f',
              '1'
            );
          }
        }

        return;
      }

      /* Maç + */
      var p =
        t.closest('.td-plus');

      if (p) {

        var c =
          p.closest('.td-card');

        if (!c) return;

        c.classList.toggle('open');

        if (
          c.classList.contains('open') &&
          !c.getAttribute('data-b')
        ) {

          var item =
            CUR.items[
              +c.getAttribute('data-i')
            ];

          c.querySelector(
            '.td-body'
          ).innerHTML =
            bodyHtml(item);

          c.setAttribute(
            'data-b',
            '1'
          );
        }

        return;
      }

      /* Tarih butonu */
      var d =
        t.closest('[data-d]');

      if (d) {

        var date =
          d.getAttribute('data-d');

        if ($('tdDate')) {
          $('tdDate').value = date;
        }

        render();
      }
    }
  );

  /* =========================================================
     VERİ HAZIRLAMA
  ========================================================= */

  function mk(x) {

    return {
      r: x,
      date: x.date,
      league: x.league,
      home: x.home,
      away: x.away,
      HT: x.scoreHT,
      FT: x.scoreFT,
      f: sc(x.scoreFT),
      h: sc(x.scoreHT),
      odds: x.odds || {}
    };
  }

  function buildIndex(arr) {

    var m =
      Object.create(null);

    arr.forEach(function (x) {

      Object.keys(x.odds).forEach(function (k) {

        var n =
          num(x.odds[k]);

        if (!(n > 0)) return;

        var key =
          k + '|' + n;

        (
          m[key] ||
          (m[key] = [])
        ).push(x);
      });
    });

    return m;
  }

  /* =========================================================
     İSTATİSTİK
  ========================================================= */

  function statsOf(
    hist,
    oddsOfMatch,
    thr,
    min
  ) {

    var list =
      RES.map(function (d) {

        var n = 0;
        var t = 0;

        hist.forEach(function (x) {

          var v =
            d.t(
              x.f,
              x.h
            );

          if (
            v === null ||
            v === undefined
          ) {
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
          p: t
            ? 100 * n / t
            : 0,
          odd:
            oddsOfMatch
              ? oddsOfMatch[d.odd]
              : ''
        };
      });

    list.forEach(function (x) {

      x.ideal =
        x.t >= min &&
        x.p >= thr;
    });

    list.sort(function (a, b) {

      return (
        (b.ideal - a.ideal) ||
        (b.p - a.p) ||
        (b.t - a.t)
      );
    });

    return list;
  }

  /* =========================================================
     HER ORAN AYRI ANALİZ
  ========================================================= */

  function analyzeEach(r, cfg) {

    var rows = [];

    var M =
      marketsMap();

    var odds =
      r.odds || {};

    var seenHistKeys = {};

    Object.keys(odds).forEach(function (k) {

      if (!(k in M)) {
        return;
      }

      var n =
        num(odds[k]);

      if (!(n >= cfg.minOdd)) {
        return;
      }

      var hist =
        CUR.idxPlayed[
          k + '|' + n
        ];

      if (
        !hist ||
        !hist.length
      ) {
        return;
      }

      var histSignature =
        hist
          .map(function (m) {
            return (
              m.date +
              '_' +
              m.home +
              '_' +
              m.away
            );
          })
          .sort()
          .join('|');

      var uniqueKey =
        n +
        '::' +
        histSignature;

      if (seenHistKeys[uniqueKey]) {
        return;
      }

      seenHistKeys[uniqueKey] = true;

      var list =
        statsOf(
          hist,
          null,
          cfg.thr,
          cfg.min
        );

      rows.push({
        k: k,
        label: M[k],
        odd: odds[k],
        n: n,
        hist: hist,
        list: list,
        ideal:
          list.filter(function (x) {
            return x.ideal;
          }),
        top: list[0]
      });
    });

    rows.sort(function (a, b) {

      return (
        (b.ideal.length > 0) -
        (a.ideal.length > 0)
      ) ||
        (b.top.p - a.top.p) ||
        (b.top.t - a.top.t);
    });

    var best = null;

    rows.forEach(function (rw) {

      if (!rw.ideal.length) {
        return;
      }

      var t =
        rw.ideal[0];

      if (
        !best ||
        t.p > best.p ||
        (
          t.p === best.p &&
          t.t > best.t
        )
      ) {
        best = t;
      }
    });

    var idealRows =
      rows.filter(function (x) {
        return x.ideal.length;
      });

    return {
      mode: 'each',
      rows: rows,
      idealRows: idealRows,
      best: best,
      hasIdeal:
        idealRows.length > 0
    };
  }

  /* =========================================================
     TEK EŞLEŞTİRME
  ========================================================= */

  function analyzeSingle(
    r,
    keys,
    pool,
    cfg
  ) {

    var odds =
      r.odds || {};

    var mode =
      NOODDS.indexOf(keys[0]) >= 0
        ? keys[0]
        : '';

    if (!mode) {

      var has =
        keys.every(function (k) {
          return !isEmpty(
            odds[k]
          );
        });

      if (!has) {
        return null;
      }
    }

    var hist =
      pool.filter(function (x) {

        if (mode === 'all') {
          return true;
        }

        if (mode === 'league') {
          return (
            !!r.league &&
            x.league === r.league
          );
        }

        if (mode === 'team') {

          return (
            x.home === r.home ||
            x.away === r.home ||
            x.home === r.away ||
            x.away === r.away
          );
        }

        return keys.every(
          function (k) {
            return (
              num(x.odds[k]) ===
              num(odds[k])
            );
          }
        );
      });

    var list =
      statsOf(
        hist,
        odds,
        cfg.thr,
        cfg.min
      );

    var ideal =
      list.filter(function (x) {
        return x.ideal;
      });

    return {
      mode: 'single',
      noOdds: !!mode,
      hist: hist.length,
      list: list,
      ideal: ideal,
      best: ideal[0] || null,
      hasIdeal:
        ideal.length > 0
    };
  }

  /* =========================================================
     KUTULAR
  ========================================================= */

  function boxHtml(
    x,
    showOdd
  ) {

    return (
      '<div class="td-box' +
      (
        x.ideal
          ? ' ideal'
          : ' dim'
      ) +
      '" style="--h:' +
      hue(x.p) +
      '">' +

        '<span class="td-l">' +
          E(x.d.l) +
        '</span>' +

        '<b>%' +
          fmtRate(x.p) +
        '</b>' +

        '<span class="td-n">' +
          x.n +
          '/' +
          x.t +
        '</span>' +

        (
          showOdd &&
          !isEmpty(x.odd)
            ? '<span class="td-o">' +
                E(x.odd) +
              '</span>'
            : ''
        ) +

      '</div>'
    );
  }

  /* =========================================================
     DETAY
  ========================================================= */

  function detailHtml(
    cur,
    rw
  ) {

    var played =
      rw.hist
        .slice()
        .sort(function (a, b) {
          return String(b.date)
            .localeCompare(
              String(a.date)
            );
        });

    var unp =
      (
        CUR.idxUnp[
          rw.k + '|' + rw.n
        ] || []
      )
        .filter(function (x) {
          return x.r !== cur;
        })
        .sort(function (a, b) {
          return String(a.date)
            .localeCompare(
              String(b.date)
            );
        });

    var LIM = 80;

    function line(
      x,
      isUnp
    ) {

      return (
        '<div class="td-m' +
        (
          isUnp
            ? ' unp'
            : ''
        ) +
        '">' +

          '<div class="td-mt">' +

            '<b>' +
              E(x.home) +
              ' - ' +
              E(x.away) +
            '</b>' +

            '<small>' +
              E(fmtDate(x.date)) +
              (
                x.league
                  ? ' · ' +
                    E(x.league)
                  : ''
              ) +
            '</small>' +

          '</div>' +

          '<span>İY ' +
            E(
              isUnp ||
              isEmpty(x.HT)
                ? '—'
                : x.HT
            ) +
          '</span>' +

          '<span>MS ' +
            E(
              isUnp ||
              isEmpty(x.FT)
                ? '—'
                : x.FT
            ) +
          '</span>' +

        '</div>'
      );
    }

    return (

      '<div class="td-dh">' +

        '<b>' +
          E(rw.label) +
          ' = ' +
          E(rw.odd) +
        '</b>' +

        ' · ' +
        played.length +
        ' oynanmış' +

        (
          unp.length
            ? ' · ' +
              unp.length +
              ' oynanmamış (yüzdeye girmez)'
            : ''
        ) +

      '</div>' +

      played
        .slice(0, LIM)
        .map(function (x) {
          return line(
            x,
            false
          );
        })
        .join('') +

      (
        played.length > LIM
          ? '<div class="td-note">' +
              'İlk ' +
              LIM +
              ' maç gösteriliyor.' +
            '</div>'
          : ''
      ) +

      unp
        .slice(0, 30)
        .map(function (x) {
          return line(
            x,
            true
          );
        })
        .join('')
    );
  }

  /* =========================================================
     MAÇ DETAYI
  ========================================================= */

  function bodyHtml(it) {

    var a = it.a;
    var cfg = CUR.cfg;

    if (!a) {

      return (
        '<div class="td-note">' +
        'Bu maçta seçilen eşleştirme oranları veride bulunmuyor.' +
        '</div>'
      );
    }

    if (a.mode === 'each') {

      var shown =
        cfg.showAll
          ? a.rows
          : a.idealRows;

      it.shown = shown;

      if (!shown.length) {

        return (
          '<div class="td-note">' +

          (
            a.rows.length

              ? 'İdeal sonuç yok ' +
                '(eşik %' +
                cfg.thr +
                ', en az ' +
                cfg.min +
                ' maç). ' +
                '“Tüm sonuçları göster” ile hepsini görebilirsin.'

              : 'Bu maçın oranlarıyla eşleşen geçmiş maç bulunamadı.'
          ) +

          '</div>'
        );
      }

      return (

        '<div class="td-sub">' +
          'Her oran türü ayrı aranır · ' +
          fmtDate(START) +
          ' ve sonrası · eşik %' +
          cfg.thr +
          ' · en az ' +
          cfg.min +
          ' maç · ' +
          shown.length +
          ' oran' +
        '</div>' +

        shown
          .map(function (rw, i) {

            var boxes =
              cfg.showAll
                ? rw.list
                : rw.ideal;

            return (

              '<div class="td-row" data-r="' +
                i +
              '">' +

                '<div class="td-rh">' +

                  '<button class="td-p2" type="button" aria-label="Maçları göster">' +
                    '+' +
                  '</button>' +

                  '<span class="td-rt">' +
                    E(rw.label) +
                  '</span>' +

                  '<span class="td-ro">' +
                    E(rw.odd) +
                  '</span>' +

                  '<span class="td-rn">' +
                    rw.hist.length +
                    ' maç' +
                  '</span>' +

                '</div>' +

                '<div class="td-grid">' +
                  boxes
                    .map(function (x) {
                      return boxHtml(
                        x,
                        false
                      );
                    })
                    .join('') +
                '</div>' +

                '<div class="td-det"></div>' +

              '</div>'
            );
          })
          .join('')
      );
    }

    var shownS =
      cfg.showAll
        ? a.list
        : a.ideal;

    return (

      '<div class="td-sub">' +

        (
          a.noOdds
            ? 'Geçmiş maç'
            : 'Aynı oranlı geçmiş maç'
        ) +

        ': <b>' +
        a.hist +
        '</b> (' +
        fmtDate(START) +
        ' ve sonrası) · eşik %' +
        cfg.thr +
        ' · en az ' +
        cfg.min +
        ' maç' +

      '</div>' +

      (
        shownS.length

          ? '<div class="td-grid">' +
              shownS
                .map(function (x) {
                  return boxHtml(
                    x,
                    true
                  );
                })
                .join('') +
            '</div>'

          : '<div class="td-note">' +
              'İdeal sonuç yok. “Tüm sonuçları göster” ile hepsini görebilirsin.' +
            '</div>'
      )
    );
  }

  /* =========================================================
     ANA RENDER
  ========================================================= */

  function render() {

    var out =
      $('tdList');

    var stats =
      $('tdStats');

    if (!out || !stats) {
      return;
    }

    var date =
      $('tdDate').value ||
      iso(new Date());

    var keys =
      $('tdBasis')
        .value
        .split(',');

    var cfg = {

      thr:
        Number(
          $('tdThr').value
        ) || 0,

      min:
        Math.max(
          1,
          Number(
            $('tdMin').value
          ) || 1
        ),

      minOdd:
        Number(
          $('tdOdd').value
        ) || 0,

      showAll:
        $('tdAll').checked,

      onlyIdeal:
        $('tdOnly').checked
    };

    CUR.cfg = cfg;

    var src =
      (
        typeof DATA !== 'undefined' &&
        Array.isArray(DATA)
      )
        ? DATA
        : [];

    /* -------------------------------------------------------
       GEÇMİŞ HAVUZU
       Sadece oynanmış ve START sonrası
    ------------------------------------------------------- */

    var pool =
      src
        .filter(function (x) {

          return (
            x.played &&
            String(x.date) >= START
          );
        })
        .map(mk);

    var unpAll =
      src
        .filter(function (x) {
          return !x.played;
        })
        .map(mk);

    CUR.idxPlayed =
      buildIndex(pool);

    CUR.idxUnp =
      buildIndex(unpAll);

    /* -------------------------------------------------------
       GÖSTERİLECEK MAÇLAR
       SADECE OYNANMAMIŞ
    ------------------------------------------------------- */

    var today =
      src
        .filter(function (x) {

          return (
            !x.played &&
            String(x.date) ===
            String(date)
          );
        })
        .sort(function (a, b) {

          return String(
            a.time || ''
          ).localeCompare(
            String(
              b.time || ''
            )
          );
        });

    var items =
      today.map(function (r) {

        var a =
          keys[0] === 'each'

            ? analyzeEach(
                r,
                cfg
              )

            : analyzeSingle(
                r,
                keys,
                pool,
                cfg
              );

        return {
          r: r,
          a: a
        };
      });

    var idealCount =
      items.filter(function (i) {

        return (
          i.a &&
          i.a.hasIdeal
        );
      }).length;

    if (cfg.onlyIdeal) {

      items =
        items.filter(function (i) {

          return (
            i.a &&
            i.a.hasIdeal
          );
        });
    }

    CUR.items = items;

    /* -------------------------------------------------------
       İSTATİSTİK
    ------------------------------------------------------- */

    stats.innerHTML =

      '<div class="td-stats">' +

        '<div class="td-stat">' +
          '<span>Oynanmamış maç</span>' +
          '<b>' +
            today.length +
          '</b>' +
        '</div>' +

        '<div class="td-stat">' +
          '<span>İdeal sonuçlu</span>' +
          '<b>' +
            idealCount +
          '</b>' +
        '</div>' +

        '<div class="td-stat">' +
          '<span>Analiz havuzu</span>' +
          '<b>' +
            pool.length.toLocaleString(
              'tr-TR'
            ) +
          '</b>' +
        '</div>' +

      '</div>';

    /* -------------------------------------------------------
       TARİHTE MAÇ YOK
    ------------------------------------------------------- */

    if (!today.length) {

      var dates = [];

      src.forEach(function (x) {

        if (
          !x.played &&
          x.date &&
          String(x.date) >=
          String(date) &&
          dates.indexOf(
            x.date
          ) < 0
        ) {

          dates.push(
            x.date
          );
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
                      E(d) +
                      '">' +
                      fmtDate(d) +
                      '</button>'
                    );
                  })
                  .join('')

              : '<br>Veride ileri tarihli maç yok.'
          ) +

        '</div>';

      return;
    }

    /* -------------------------------------------------------
       İDEAL YOK
    ------------------------------------------------------- */

    if (!items.length) {

      out.innerHTML =

        '<div class="td-empty">' +

          'Bu ayarlarla ideal sonucu olan maç yok.' +

          '<br>' +

          'Eşiği veya minimum maç sayısını düşürebilirsin.' +

        '</div>';

      return;
    }

    /* -------------------------------------------------------
       MAÇLAR
    ------------------------------------------------------- */

    out.innerHTML =

      items
        .map(function (it, i) {

          var r = it.r;
          var a = it.a;

          var chip;

          if (!a) {

            chip =
              '<span class="td-chip none">' +
              'Oran yok' +
              '</span>';

          } else if (a.best) {

            chip =
              '<span class="td-chip" style="--h:' +
              hue(a.best.p) +
              '">' +

                E(a.best.d.l) +

                ' %' +
                fmtRate(a.best.p) +

              '</span>';

          } else {

            chip =
              '<span class="td-chip none">' +
              'İdeal yok' +
              '</span>';
          }

          return (

            '<div class="td-card" data-i="' +
              i +
            '">' +

              '<div class="td-head">' +

                '<button class="td-plus" type="button" aria-label="Sonuçları aç/kapat">' +
                  '+' +
                '</button>' +

                '<div class="td-info">' +

                  '<div class="td-meta">' +
                    E(r.time || '') +

                    (
                      r.league
                        ? ' · ' +
                          E(r.league)
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

              '<div class="td-body"></div>' +

            '</div>'
          );
        })
        .join('');

    /* JSON'dan skorları çek */
    fetchLiveScores();
  }

  /* =========================================================
     PERİYODİK SKOR GÜNCELLEMESİ
  ========================================================= */

  setInterval(
    fetchLiveScores,
    30000
  );

  setInterval(
    updateMainMatchScores,
    1000
  );

  /* =========================================================
     İLK ÇALIŞTIRMA
  ========================================================= */

  /*
    DATA yüklendikten sonra bölümü hazırlıyoruz.
    Sekmeyi otomatik açmıyoruz.
  */

  setTimeout(function () {

    if (
      $('tdDate') &&
      $('tdBasis')
    ) {
      render();
    }

  }, 100);

})();
