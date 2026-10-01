/* =========================================================
   BUGÜNÜN MAÇLARI
   v3 - data.js + Mackolik canlı skor entegrasyonu
========================================================= */
(function () {
  'use strict';

  var START = '2026-09-01';
  var LIVE_JSON_URL =
    'https://teador612.github.io/mackolik1/data/matches.json';

  var CUR = {
    items: [],
    idxPlayed: {},
    idxUnp: {},
    cfg: {},
    liveScores: {}
  };

  /* =========================================================
     YARDIMCILAR
  ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }

  function E(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function empty(v) {
    return v == null || String(v).trim() === '';
  }

  function num(v) {
    if (empty(v)) return NaN;
    return Number(String(v).trim().replace(',', '.'));
  }

  function score(v) {
    if (v == null) return null;

    if (typeof v === 'object') {
      if (
        v.home != null &&
        v.away != null &&
        v.home !== '' &&
        v.away !== ''
      ) {
        var h = Number(v.home);
        var a = Number(v.away);

        if (isFinite(h) && isFinite(a)) {
          return [h, a];
        }
      }
      return null;
    }

    var m = String(v).match(/(\d+)\s*[-:]\s*(\d+)/);

    return m
      ? [Number(m[1]), Number(m[2])]
      : null;
  }

  function iso(d) {
    return new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 10);
  }

  function fmtDate(s) {
    var p = String(s || '').split('-');

    if (p.length === 3) {
      return p[2] + '.' + p[1] + '.' + p[0];
    }

    return s;
  }

  function fmtRate(p) {
    return String(Number(p.toFixed(1)));
  }

  function hue(p) {
    return Math.round(p * 1.2);
  }

  function marketsMap() {
    return typeof MARKETS !== 'undefined' && MARKETS
      ? MARKETS
      : {};
  }

  function defMinOdd() {
    return typeof MIN_ODD !== 'undefined' && isFinite(MIN_ODD)
      ? MIN_ODD
      : 1.4;
  }

  /* =========================================================
     TAKIM ADI NORMALİZASYONU
  ========================================================= */

  function cleanTeamName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/\b(fc|sc|cd|de|club|fk|sk|cf)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  function teamMatch(a, b) {
    var x = cleanTeamName(a);
    var y = cleanTeamName(b);

    if (!x || !y) return false;

    if (x === y) return true;

    if (x.length >= 5 && y.length >= 5) {
      if (x.indexOf(y) !== -1) return true;
      if (y.indexOf(x) !== -1) return true;
    }

    return false;
  }

  /* =========================================================
     BUGÜNÜN MAÇLARI SONUÇ TÜRLERİ
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

  var css = `
.td-panel{
background:#0d1422;
border:1px solid #1d2a3d;
border-radius:8px;
padding:16px;
margin:14px 0
}

.td-panel h2{
margin:0 0 10px;
font-size:14px;
color:#e4ebf7
}

.td-ctl{
display:grid;
grid-template-columns:repeat(5,1fr);
gap:10px;
margin-top:12px
}

.td-ctl .field{
display:flex;
flex-direction:column;
gap:6px
}

.td-ctl label{
font-size:12px;
color:#9ba6bf
}

.td-checks{
display:flex;
flex-wrap:wrap;
gap:14px;
margin-top:12px;
font-size:13px;
color:#c9d1e5
}

.td-checks label{
display:flex;
align-items:center;
gap:6px
}

.td-stats{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:8px;
margin:14px 0
}

.td-stat{
background:#111b2d;
border:1px solid #1d2a3d;
border-radius:6px;
padding:10px
}

.td-stat span{
display:block;
font-size:11px;
color:#8290a7
}

.td-stat b{
display:block;
margin-top:3px;
font-size:17px;
color:#e8eef8
}

.td-card{
background:#0d1422;
border:1px solid #1d2a3d;
border-radius:10px;
margin-bottom:8px;
overflow:hidden
}

.td-head{
display:flex;
align-items:center;
gap:10px;
padding:10px
}

.td-plus{
flex:0 0 32px;
width:32px;
height:32px;
border-radius:8px;
border:1px solid #2b4058;
background:#111d30;
color:#9fb6d1;
font-size:20px;
cursor:pointer
}

.td-card.open>.td-head .td-plus{
background:#1d6ef2;
border-color:#1d6ef2;
color:#fff
}

.td-info{
flex:1;
min-width:0
}

.td-meta{
font-size:11px;
color:#8290a7;
white-space:nowrap;
overflow:hidden;
text-overflow:ellipsis
}

.td-teams{
margin-top:3px;
font-size:14px;
font-weight:700;
color:#f0f4fb;
white-space:nowrap;
overflow:hidden;
text-overflow:ellipsis
}

.td-score{
flex:0 0 auto;
font-size:14px;
font-weight:900;
padding:5px 9px;
border-radius:6px;
background:#18263a;
color:#00ffcc;
border:1px solid #283d5a;
white-space:nowrap
}

.td-score.live{
background:#e74c3c;
color:#fff;
border-color:#c0392b
}

.td-chip{
flex:0 0 auto;
font-size:11px;
font-weight:800;
padding:5px 8px;
border-radius:6px;
white-space:nowrap;
color:hsl(var(--h),85%,66%);
background:hsl(var(--h),60%,13%);
border:1px solid hsl(var(--h),55%,30%)
}

.td-chip.none{
color:#7d8aa3;
background:#111b2d;
border-color:#1d2a3d
}

.td-body{
display:none;
border-top:1px solid #1b2738;
background:#0a111d;
padding:10px
}

.td-card.open>.td-body{
display:block
}

.td-sub{
font-size:11px;
color:#8290a7;
margin-bottom:8px;
line-height:1.5
}

.td-grid{
display:grid;
grid-template-columns:repeat(3,minmax(0,1fr));
gap:6px
}

.td-box{
min-width:0;
text-align:center;
padding:8px 4px;
border-radius:8px;
background:hsl(var(--h),60%,12%);
border:1px solid hsl(var(--h),50%,26%)
}

.td-box.ideal{
border-color:hsl(var(--h),70%,46%)
}

.td-box.dim{
opacity:.5
}

.td-l{
display:block;
font-size:11px;
font-weight:700;
color:#dbe5f3
}

.td-box b{
display:block;
margin-top:4px;
font-size:18px;
color:hsl(var(--h),85%,62%)
}

.td-n{
display:block;
margin-top:3px;
font-size:10px;
color:#9aa8c9
}

.td-o{
display:block;
margin-top:2px;
font-size:10px;
color:#6f7f9f
}

.td-row{
background:#0d1422;
border:1px solid #1d2a3d;
border-radius:8px;
margin-bottom:7px;
padding:8px
}

.td-rh{
display:flex;
align-items:center;
gap:8px;
margin-bottom:7px
}

.td-p2{
flex:0 0 26px;
width:26px;
height:26px;
border-radius:7px;
border:1px solid #2b4058;
background:#111d30;
color:#9fb6d1;
font-size:16px;
cursor:pointer
}

.td-row.open .td-p2{
background:#1d6ef2;
border-color:#1d6ef2;
color:#fff
}

.td-rt{
font-size:13px;
font-weight:700;
color:#f0f4fb;
min-width:0;
overflow:hidden;
text-overflow:ellipsis;
white-space:nowrap
}

.td-ro{
font-size:13px;
font-weight:800;
color:#5fd4cc
}

.td-rn{
flex:1;
text-align:right;
font-size:10px;
color:#8290a7
}

.td-det{
display:none;
margin-top:8px;
border-top:1px solid #1b2738;
padding-top:6px
}

.td-row.open .td-det{
display:block
}

.td-dh{
font-size:11px;
color:#8290a7;
margin:2px 0 6px
}

.td-m{
display:grid;
grid-template-columns:minmax(0,1fr) auto auto;
gap:8px;
align-items:center;
padding:6px 0;
border-top:1px solid #182538;
font-size:12px;
color:#dbe5f3
}

.td-m.unp{
opacity:.55
}

.td-mt b{
display:block;
overflow:hidden;
text-overflow:ellipsis;
white-space:nowrap
}

.td-mt small{
display:block;
margin-top:2px;
font-size:10px;
color:#7f8daf
}

.td-empty{
background:#0d1422;
border:1px solid #1d2a3d;
border-radius:8px;
padding:22px;
text-align:center;
color:#9ba6bf;
line-height:1.7
}

.td-empty button{
margin:4px;
padding:8px 12px;
border-radius:8px;
border:1px solid #33405f;
background:#18223a;
color:#e8ecf7;
font-weight:700
}

.td-note{
font-size:12px;
color:#8290a7;
padding:2px
}

@media(max-width:800px){
.td-ctl{
grid-template-columns:repeat(2,1fr)
}
}

@media(max-width:520px){
.td-panel{
padding:12px
}

.td-ctl{
gap:8px
}

.td-ctl .wide{
grid-column:span 2
}

.td-stats{
gap:6px
}

.td-stat{
padding:8px
}

.td-stat b{
font-size:14px
}

.td-head{
padding:8px;
gap:7px
}

.td-teams{
font-size:13px
}

.td-chip{
font-size:10px;
padding:4px 6px
}

.td-score{
font-size:12px;
padding:4px 6px
}

.td-body{
padding:8px
}

.td-grid{
gap:5px
}

.td-box{
padding:7px 2px
}

.td-l{
font-size:10px
}

.td-box b{
font-size:15px
}
}
`;

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* =========================================================
     SEKME
  ========================================================= */

  var tabs = document.querySelector('.tabs');

  if (!document.querySelector('[data-tab="todayTab"]')) {
    var btn = document.createElement('button');

    btn.className = 'tab';
    btn.dataset.tab = 'todayTab';
    btn.textContent = 'Bugünün maçları';

    btn.onclick = function () {
      if (typeof showTab === 'function') {
        showTab('todayTab');
      }

      render();
    };

    if (tabs) {
      tabs.insertBefore(btn, tabs.firstChild);
    }
  }

  /* =========================================================
     BÖLÜM
  ========================================================= */

  if (!$('todayTab')) {
    var sec = document.createElement('section');

    sec.id = 'todayTab';
    sec.hidden = true;

    sec.innerHTML =
      '<div class="td-panel">' +
      '<h2>Bugünün maçları</h2>' +

      '<div class="notice">' +
      'Oynanmamış maçlar listelenir. ' +
      'Maçın yanındaki <b>+</b> ile analiz sonuçlarını açabilirsin. ' +
      '<b>' + fmtDate(START) + '</b> ve sonrası oynanmış maçlar istatistiğe dahil edilir.' +
      '</div>' +

      '<div class="td-ctl">' +

      '<div class="field">' +
      '<label>Maç günü</label>' +
      '<input id="tdDate" type="date" class="input">' +
      '</div>' +

      '<div class="field wide">' +
      '<label>Eşleştirme</label>' +
      '<select id="tdBasis" class="select"></select>' +
      '</div>' +

      '<div class="field">' +
      '<label>İdeal eşik (%)</label>' +
      '<input id="tdThr" type="number" class="input" value="70" min="0" max="100">' +
      '</div>' +

      '<div class="field">' +
      '<label>Min. geçmiş maç</label>' +
      '<input id="tdMin" type="number" class="input" value="5" min="1">' +
      '</div>' +

      '<div class="field">' +
      '<label>Min. oran</label>' +
      '<input id="tdOdd" type="number" class="input" step="0.01" min="1" value="' +
      defMinOdd() +
      '">' +
      '</div>' +

      '</div>' +

      '<div class="td-checks">' +
      '<label><input type="checkbox" id="tdOnly"> Sadece ideal sonucu olan maçlar</label>' +
      '<label><input type="checkbox" id="tdAll"> Tüm sonuçları göster</label>' +
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
  }

  /* =========================================================
     KONTROLLERİ HAZIRLA
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

    if (el) {
      el.addEventListener('change', render);
    }
  });

  [
    'tdThr',
    'tdMin',
    'tdOdd'
  ].forEach(function (id) {
    var el = $(id);

    if (el) {
      el.addEventListener('input', render);
    }
  });

  /* =========================================================
     MAÇKOLİK CANLI SKOR VERİSİ
  ========================================================= */

  function fetchLiveScores() {
    fetch(
      LIVE_JSON_URL +
      '?_=' +
      Date.now(),
      {
        cache: 'no-store'
      }
    )
      .then(function (res) {
        if (!res.ok) {
          throw new Error('matches.json yüklenemedi');
        }

        return res.json();
      })

      .then(function (data) {
        var matches = Array.isArray(data.matches)
          ? data.matches
          : [];

        var map = {};

        matches.forEach(function (m) {

          var fs = score(m.score);

          /*
             Çok önemli:

             Mackolik'te skor alanı bazen 0-0 olabilir.
             Ama status / skor bilgisinin olmadığı maçta
             sahte 0-0 göstermiyoruz.
          */

          if (!fs) return;

          var code =
            m.code != null
              ? String(m.code)
              : '';

          var key =
            cleanTeamName(m.home) +
            '|' +
            cleanTeamName(m.away);

          map[key] = {
            code: code,
            home: m.home,
            away: m.away,
            date: m.date,
            score: fs[0] + ' - ' + fs[1]
          };

          if (code) {
            map['CODE|' + code] = map[key];
          }
        });

        CUR.liveScores = map;

        updateScoresOnUI();
      })

      .catch(function (err) {
        console.log(
          'Maçkolik skor alınamadı:',
          err
        );
      });
  }

  /* =========================================================
     SKOR BUL
  ========================================================= */

  function findLiveScore(r) {

    /*
      1) Eğer data.js içine ileride code eklenirse
         doğrudan code ile bul.
    */

    if (r.code != null) {
      var codeKey =
        'CODE|' +
        String(r.code);

      if (CUR.liveScores[codeKey]) {
        return CUR.liveScores[codeKey];
      }
    }

    /*
      2) Takım + tarih
    */

    var key =
      cleanTeamName(r.home) +
      '|' +
      cleanTeamName(r.away);

    if (CUR.liveScores[key]) {
      var s = CUR.liveScores[key];

      /*
        Tarih mevcutsa farklı güne ait eşleşmeyi engelle.
      */

      if (
        !s.date ||
        !r.date ||
        String(s.date) === String(r.date)
      ) {
        return s;
      }
    }

    /*
      3) Son çare takım adı esnek eşleşmesi
    */

    var keys = Object.keys(CUR.liveScores);

    for (var i = 0; i < keys.length; i++) {

      if (keys[i].indexOf('CODE|') === 0) {
        continue;
      }

      var item = CUR.liveScores[keys[i]];

      if (
        teamMatch(item.home, r.home) &&
        teamMatch(item.away, r.away)
      ) {

        if (
          item.date &&
          r.date &&
          String(item.date) !== String(r.date)
        ) {
          continue;
        }

        return item;
      }
    }

    return null;
  }

  /* =========================================================
     EKRANDAKİ SKORLARI GÜNCELLE
  ========================================================= */

  function updateScoresOnUI() {

    CUR.items.forEach(function (it, i) {

      var card = document.querySelector(
        '.td-card[data-i="' + i + '"]'
      );

      if (!card) return;

      var r = it.r;

      /*
        Önce data.js'deki scoreFT.
      */

      var ft =
        score(r.scoreFT);

      /*
        Sonra Mackolik canlı JSON.
      */

      var live =
        findLiveScore(r);

      var text = '';
      var liveClass = '';

      if (ft) {

        text =
          ft[0] +
          ' - ' +
          ft[1];

      } else if (live && live.score) {

        text =
          live.score;

        liveClass =
          ' live';
      }

      /*
        Skor yoksa hiçbir şey gösterme.
      */

      var existing =
        card.querySelector('.td-score');

      if (!text) {

        if (existing) {
          existing.remove();
        }

        return;
      }

      if (!existing) {

        existing =
          document.createElement('div');

        var chip =
          card.querySelector('.td-chip');

        card
          .querySelector('.td-head')
          .insertBefore(
            existing,
            chip
          );
      }

      existing.className =
        'td-score' +
        liveClass;

      existing.textContent =
        text;
    });
  }

  /* =========================================================
     TIKLAMALAR
  ========================================================= */

  var section = $('todayTab');

  if (section && !section.dataset.eventsReady) {

    section.dataset.eventsReady = '1';

    section.addEventListener(
      'click',
      function (e) {

        var t = e.target;

        if (!t.closest) return;

        var p2 =
          t.closest('.td-p2');

        if (p2) {

          var row =
            p2.closest('.td-row');

          var card =
            p2.closest('.td-card');

          row.classList.toggle(
            'open'
          );

          if (
            row.classList.contains('open') &&
            !row.getAttribute('data-f')
          ) {

            var it =
              CUR.items[
                Number(
                  card.getAttribute(
                    'data-i'
                  )
                )
              ];

            var rw =
              it &&
              it.shown &&
              it.shown[
                Number(
                  row.getAttribute(
                    'data-r'
                  )
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

        var plus =
          t.closest('.td-plus');

        if (plus) {

          var c =
            plus.closest('.td-card');

          c.classList.toggle(
            'open'
          );

          if (
            c.classList.contains('open') &&
            !c.getAttribute('data-b')
          ) {

            var item =
              CUR.items[
                Number(
                  c.getAttribute(
                    'data-i'
                  )
                )
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

          /*
             Kart açıldıktan sonra güncel skoru tekrar çek.
          */

          fetchLiveScores();

          return;
        }

        var d =
          t.closest('[data-d]');

        if (d) {

          $('tdDate').value =
            d.getAttribute(
              'data-d'
            );

          render();
        }
      }
    );
  }

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

      /*
        data.js'de code yok.
        Varsa kullanılır.
      */

      code: x.code,

      HT: x.scoreHT,
      FT: x.scoreFT,

      f: score(x.scoreFT),
      h: score(x.scoreHT),

      odds:
        x.odds || {}
    };
  }

  function buildIndex(arr) {

    var m =
      Object.create(null);

    arr.forEach(function (x) {

      Object.keys(x.odds).forEach(
        function (k) {

          var n =
            num(x.odds[k]);

          if (!(n > 0)) return;

          var key =
            k + '|' + n;

          (
            m[key] ||
            (m[key] = [])
          ).push(x);
        }
      );
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
          ) return;

          t++;

          if (v) n++;
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
     ANALİZ
  ========================================================= */

  function analyzeEach(r, cfg) {

    var rows = [];

    var M =
      marketsMap();

    var odds =
      r.odds || {};

    var seen = {};

    Object.keys(odds).forEach(
      function (k) {

        if (!(k in M)) return;

        var n =
          num(odds[k]);

        if (
          !(n >= cfg.minOdd)
        ) return;

        var hist =
          CUR.idxPlayed[
            k + '|' + n
          ];

        if (
          !hist ||
          !hist.length
        ) return;

        var signature =
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

        var unique =
          n +
          '::' +
          signature;

        if (seen[unique]) return;

        seen[unique] = true;

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
            list.filter(
              function (x) {
                return x.ideal;
              }
            ),

          top:
            list[0]
        });
      }
    );

    rows.sort(function (a, b) {

      return (
        (b.ideal.length > 0) -
          (a.ideal.length > 0) ||

        b.top.p -
          a.top.p ||

        b.top.t -
          a.top.t
      );
    });

    var best = null;

    rows.forEach(function (rw) {

      if (!rw.ideal.length)
        return;

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
      rows.filter(
        function (x) {
          return x.ideal.length;
        }
      );

    return {
      mode: 'each',
      rows: rows,
      idealRows: idealRows,
      best: best,
      hasIdeal:
        idealRows.length > 0
    };
  }

  function analyzeSingle(
    r,
    keys,
    pool,
    cfg
  ) {

    var odds =
      r.odds || {};

    var mode =
      NOODDS.indexOf(
        keys[0]
      ) >= 0
        ? keys[0]
        : '';

    if (!mode) {

      var has =
        keys.every(
          function (k) {
            return !empty(
              odds[k]
            );
          }
        );

      if (!has) return null;
    }

    var hist =
      pool.filter(
        function (x) {

          if (mode === 'all')
            return true;

          if (mode === 'league')
            return (
              !!r.league &&
              x.league ===
                r.league
            );

          if (mode === 'team')
            return (
              x.home === r.home ||
              x.away === r.home ||
              x.home === r.away ||
              x.away === r.away
            );

          return keys.every(
            function (k) {
              return (
                num(x.odds[k]) ===
                num(odds[k])
              );
            }
          );
        }
      );

    var list =
      statsOf(
        hist,
        odds,
        cfg.thr,
        cfg.min
      );

    var ideal =
      list.filter(
        function (x) {
          return x.ideal;
        }
      );

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
     HTML
  ========================================================= */

  function boxHtml(
    x,
    showOdd
  ) {

    return (
      '<div class="td-box ' +
      (x.ideal
        ? 'ideal'
        : 'dim') +
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
        !empty(x.odd)
          ? '<span class="td-o">' +
            E(x.odd) +
            '</span>'
          : ''
      ) +

      '</div>'
    );
  }

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
          rw.k +
          '|' +
          rw.n
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

    function line(
      x,
      isUnp
    ) {

      return (
        '<div class="td-m ' +
        (
          isUnp
            ? 'unp'
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
          empty(x.HT)
            ? '—'
            : x.HT
        ) +
        '</span>' +

        '<span>MS ' +
        E(
          isUnp ||
          empty(x.FT)
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
      '</b> · ' +
      played.length +
      ' oynanmış' +

      (
        unp.length
          ? ' · ' +
            unp.length +
            ' oynanmamış'
          : ''
      ) +

      '</div>' +

      played
        .slice(0, 80)
        .map(function (x) {
          return line(
            x,
            false
          );
        })
        .join('') +

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

  function bodyHtml(it) {

    var a = it.a;
    var cfg = CUR.cfg;

    if (!a) {
      return (
        '<div class="td-note">' +
        'Bu maçta seçilen eşleştirme oranları bulunamadı.' +
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
              ? 'İdeal sonuç yok. "Tüm sonuçları göster" ile sonuçları görebilirsin.'
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
        ' maç</div>' +

        shown.map(
          function (rw, i) {

            var boxes =
              cfg.showAll
                ? rw.list
                : rw.ideal;

            return (
              '<div class="td-row" data-r="' +
              i +
              '">' +

              '<div class="td-rh">' +

              '<button class="td-p2" type="button">+</button>' +

              '<span class="td-rt">' +
              E(rw.label) +
              '</span>' +

              '<span class="td-ro">' +
              E(rw.odd) +
              '</span>' +

              '<span class="td-rn">' +
              rw.hist.length +
              ' maç</span>' +

              '</div>' +

              '<div class="td-grid">' +
              boxes.map(
                function (x) {
                  return boxHtml(
                    x,
                    false
                  );
                }
              ).join('') +
              '</div>' +

              '<div class="td-det"></div>' +

              '</div>'
            );
          }
        ).join('')
      );
    }

    var shownS =
      cfg.showAll
        ? a.list
        : a.ideal;

    return (
      '<div class="td-sub">' +
      'Geçmiş maç: <b>' +
      a.hist +
      '</b> · eşik %' +
      cfg.thr +
      ' · en az ' +
      cfg.min +
      ' maç</div>' +

      (
        shownS.length
          ? '<div class="td-grid">' +
            shownS.map(
              function (x) {
                return boxHtml(
                  x,
                  true
                );
              }
            ).join('') +
            '</div>'

          : '<div class="td-note">' +
            'İdeal sonuç yok. "Tüm sonuçları göster" ile hepsini görebilirsin.' +
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

    if (!out || !stats)
      return;

    var date =
      $('tdDate').value ||
      iso(new Date());

    var keys =
      $('tdBasis').value
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

    /*
      ÖNEMLİ:
      index.html'deki güncel DATA kullanılıyor.
      window.ORAN_DATA'ya sabitlenmiyoruz.
    */

    var src =
      typeof DATA !== 'undefined' &&
      Array.isArray(DATA)
        ? DATA
        : (
          Array.isArray(
            window.ORAN_DATA
          )
            ? window.ORAN_DATA
            : []
        );

    /*
      OYNANMIŞ MAÇLAR
    */

    var pool =
      src
        .filter(function (x) {

          return (
            x.played === true &&
            String(x.date) >=
              START &&
            score(x.scoreFT)
          );
        })
        .map(mk);

    /*
      OYNANMAMIŞ MAÇLAR
    */

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

    /*
      BUGÜNÜN OYNANMAMIŞ MAÇLARI
    */

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

          return String(a.time || '')
            .localeCompare(
              String(b.time || '')
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
      items.filter(
        function (i) {
          return (
            i.a &&
            i.a.hasIdeal
          );
        }
      ).length;

    if (cfg.onlyIdeal) {

      items =
        items.filter(
          function (i) {
            return (
              i.a &&
              i.a.hasIdeal
            );
          }
        );
    }

    CUR.items = items;

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
      pool.length.toLocaleString('tr-TR') +
      '</b>' +
      '</div>' +

      '</div>';

    if (!today.length) {

      var dates = [];

      src.forEach(
        function (x) {

          if (
            !x.played &&
            x.date &&
            String(x.date) >=
              String(date) &&
            dates.indexOf(
              x.date
            ) < 0
          ) {
            dates.push(x.date);
          }
        }
      );

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
                .map(
                  function (d) {
                    return (
                      '<button data-d="' +
                      d +
                      '">' +
                      fmtDate(d) +
                      '</button>'
                    );
                  }
                )
                .join('')
            : '<br>İleri tarihli maç yok.'
        ) +

        '</div>';

      /*
        Yine de canlı JSON'u çek.
      */

      fetchLiveScores();

      return;
    }

    if (!items.length) {

      out.innerHTML =
        '<div class="td-empty">' +
        'Bu ayarlarla ideal sonucu olan maç yok.' +
        '</div>';

      fetchLiveScores();

      return;
    }

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

            '<button class="td-plus" type="button">+</button>' +

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

    /*
      Kartlar çizildikten sonra:
      data.js scoreFT veya Mackolik JSON skoru uygulanır.
    */

    updateScoresOnUI();

    fetchLiveScores();
  }

  /* =========================================================
     İLK ÇALIŞTIRMA
  ========================================================= */

  function start() {

    if (!$('todayTab')) {
      setTimeout(
        start,
        100
      );
      return;
    }

    if ($('tdDate')) {
      $('tdDate').value =
        iso(new Date());
    }

    render();

    /*
      İlk canlı skor çekimi
    */

    fetchLiveScores();
  }

  /*
    index.html içindeki DATA restore işlemi
    tamamlandıktan sonra tekrar çiz.
  */

  setTimeout(
    start,
    300
  );

  /*
    Her 30 saniyede:
    - matches.json çekilir
    - skorlar güncellenir
  */

  setInterval(
    fetchLiveScores,
    30000
  );

  /*
    5 saniye sonra bir kez daha render.
    IndexedDB'den DATA gelmişse onu kullanır.
  */

  setTimeout(
    function () {
      render();
      fetchLiveScores();
    },
    5000
  );

})();
