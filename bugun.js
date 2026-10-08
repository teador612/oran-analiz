"use strict";
/* =========================================================
   BUGÜNÜN MAÇLARI
   - Ana sayfanın CSS sınıflarına dokunmaz.
   - Tüm sınıflar oa-today- ile başlar.
   - Maç isimleri ana tema ile karışmaz.
   - Canlı skor Mackolik JSON'dan alınır.
========================================================= */
(function () {
  /* =========================================================
     AYARLAR
  ========================================================= */
  var START = "2026-09-01";
  var LIVE_JSON_URL =
    "https://teador612.github.io/mackolik1/data/matches.json";
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
  function E(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c];
      }
    );
  }
  function isEmpty(value) {
    return value == null || String(value).trim() === "";
  }
  function num(value) {
    if (isEmpty(value)) return NaN;
    return Number(
      String(value)
        .trim()
        .replace(",", ".")
    );
  }
  function sc(value) {
    var m = String(value || "").match(/(\d+)\s*[-:]\s*(\d+)/);
    return m
      ? [+m[1], +m[2]]
      : null;
  }
  function iso(date) {
    return new Date(
      date.getTime() -
      date.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 10);
  }
  function fmtDate(value) {
    var p = String(value).split("-");
    return p.length === 3
      ? p[2] + "." + p[1] + "." + p[0]
      : value;
  }
  function fmtRate(value) {
    return String(+value.toFixed(1));
  }
  function hue(value) {
    return Math.round(value * 1.2);
  }
  function marketsMap() {
    return (
      typeof MARKETS !== "undefined" &&
      MARKETS
    )
      ? MARKETS
      : {};
  }
  function defMinOdd() {
    return (
      typeof MIN_ODD !== "undefined" &&
      isFinite(MIN_ODD)
    )
      ? MIN_ODD
      : 1.4;
  }
  /* =========================================================
     TAKIM EŞLEŞTİRME
  ========================================================= */
  function cleanTeamName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(
        /fc|sc|cd|de|club|atletico|deportivo|fk|sk|sporting/g,
        ""
      )
      .replace(/[^a-z0-9ğüşıöç]/g, "")
      .trim();
  }
  function isTeamMatch(t1, t2) {
    var c1 = cleanTeamName(t1);
    var c2 = cleanTeamName(t2);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.length > 3 && c2.length > 3) {
      return (
        c1.indexOf(c2) >= 0 ||
        c2.indexOf(c1) >= 0
      );
    }
    return false;
  }
  /* =========================================================
     SONUÇLAR
  ========================================================= */
  var RES = [
    {
      l: "MS1",
      odd: "ms1",
      t: function (f) {
        return f ? f[0] > f[1] : null;
      }
    },
    {
      l: "MS0",
      odd: "ms0",
      t: function (f) {
        return f ? f[0] === f[1] : null;
      }
    },
    {
      l: "MS2",
      odd: "ms2",
      t: function (f) {
        return f ? f[0] < f[1] : null;
      }
    },
    {
      l: "KG Var",
      odd: "kgVar",
      t: function (f) {
        return f
          ? f[0] > 0 && f[1] > 0
          : null;
      }
    },
    {
      l: "2,5 Üst",
      odd: "over25",
      t: function (f) {
        return f
          ? f[0] + f[1] > 2.5
          : null;
      }
    },
    {
      l: "İY 0,5 Üst",
      odd: "iyOver05",
      t: function (f, h) {
        return h
          ? h[0] + h[1] > 0.5
          : null;
      }
    },
    {
      l: "İY 1,5 Üst",
      odd: "iyOver15",
      t: function (f, h) {
        return h
          ? h[0] + h[1] > 1.5
          : null;
      }
    }
  ];
  var BASIS = [
    {
      v: "each",
      l: "Her oran türü tek tek (önerilen)"
    },
    {
      v: "ms1",
      l: "Sadece MS1 oranı aynı olanlar"
    },
    {
      v: "ms1,ms2",
      l: "MS1 + MS2 oranı aynı olanlar"
    },
    {
      v: "ms1,ms0,ms2",
      l: "MS1 + MS0 + MS2 aynı olanlar"
    },
    {
      v: "league",
      l: "Oransız: aynı ligdeki maçlar"
    },
    {
      v: "team",
      l: "Oransız: iki takımın tüm maçları"
    },
    {
      v: "all",
      l: "Oransız: tüm maçlar"
    }
  ];
  var NOODDS = [
    "league",
    "team",
    "all"
  ];
  /* =========================================================
     CSS
     TAMAMEN İZOLE
  ========================================================= */
  var css = [
    ".oa-today-root{",
    "font-family:inherit;",
    "color:#e8ecf7;",
    "}",
    ".oa-today-root *{",
    "box-sizing:border-box;",
    "}",
    ".oa-today-panel{",
    "background:#0d1422;",
    "border:1px solid #1d2a3d;",
    "border-radius:8px;",
    "padding:16px;",
    "margin:14px 0;",
    "}",
    ".oa-today-panel h2{",
    "margin:0 0 10px;",
    "text-transform:uppercase;",
    "letter-spacing:.06em;",
    "font-size:14px;",
    "color:#e4ebf7;",
    "}",
    ".oa-today-ctl{",
    "display:grid;",
    "grid-template-columns:repeat(5,1fr);",
    "gap:10px;",
    "margin-top:12px;",
    "}",
    ".oa-today-field{",
    "display:flex;",
    "flex-direction:column;",
    "gap:6px;",
    "}",
    ".oa-today-field label{",
    "font-size:12px;",
    "color:#9ba6bf;",
    "}",
    ".oa-today-input,",
    ".oa-today-select{",
    "height:42px;",
    "border-radius:9px;",
    "border:1px solid #33405f;",
    "background:#0e1526;",
    "color:#e8ecf7;",
    "padding:0 10px;",
    "width:100%;",
    "}",
    ".oa-today-checks{",
    "display:flex;",
    "flex-wrap:wrap;",
    "gap:14px;",
    "margin-top:12px;",
    "font-size:13px;",
    "color:#c9d1e5;",
    "}",
    ".oa-today-checks label{",
    "display:flex;",
    "align-items:center;",
    "gap:6px;",
    "cursor:pointer;",
    "}",
    ".oa-today-stats{",
    "display:grid;",
    "grid-template-columns:repeat(3,1fr);",
    "gap:8px;",
    "margin:14px 0;",
    "}",
    ".oa-today-stat{",
    "background:#111b2d;",
    "border:1px solid #1d2a3d;",
    "border-radius:6px;",
    "padding:10px;",
    "}",
    ".oa-today-stat span{",
    "display:block;",
    "font-size:11px;",
    "color:#8290a7;",
    "}",
    ".oa-today-stat b{",
    "display:block;",
    "margin-top:3px;",
    "font-size:17px;",
    "color:#e8eef8;",
    "}",
    ".oa-today-card{",
    "background:#0d1422;",
    "border:1px solid #1d2a3d;",
    "border-radius:10px;",
    "margin-bottom:8px;",
    "overflow:hidden;",
    "}",
    ".oa-today-head{",
    "display:flex;",
    "align-items:center;",
    "gap:10px;",
    "padding:10px;",
    "background:#0d1422;",
    "}",
    ".oa-today-plus{",
    "flex:0 0 32px;",
    "width:32px;",
    "height:32px;",
    "border-radius:8px;",
    "border:1px solid #2b4058;",
    "background:#111d30;",
    "color:#9fb6d1;",
    "font-size:20px;",
    "line-height:1;",
    "cursor:pointer;",
    "}",
    ".oa-today-card.open>.oa-today-head .oa-today-plus{",
    "background:#1d6ef2;",
    "border-color:#1d6ef2;",
    "color:#fff;",
    "}",
    ".oa-today-info{",
    "flex:1;",
    "min-width:0;",
    "background:transparent;",
    "}",
    ".oa-today-meta{",
    "font-size:11px;",
    "color:#8290a7;",
    "white-space:nowrap;",
    "overflow:hidden;",
    "text-overflow:ellipsis;",
    "background:transparent;",
    "}",
    ".oa-today-teams{",
    "margin-top:3px;",
    "font-size:14px;",
    "font-weight:700;",
    "color:#f0f4fb;",
    "white-space:nowrap;",
    "overflow:hidden;",
    "text-overflow:ellipsis;",
    "background:transparent;",
    "}",
    ".oa-today-score{",
    "flex:0 0 auto;",
    "font-size:13px;",
    "font-weight:800;",
    "padding:4px 8px;",
    "border-radius:6px;",
    "background:#18263a;",
    "color:#00ffcc;",
    "border:1px solid #283d5a;",
    "margin-right:4px;",
    "}",
    ".oa-today-score.live{",
    "background:#e74c3c;",
    "color:#fff;",
    "border-color:#c0392b;",
    "}",
    ".oa-today-chip{",
    "flex:0 0 auto;",
    "font-size:11px;",
    "font-weight:800;",
    "padding:5px 8px;",
    "border-radius:6px;",
    "white-space:nowrap;",
    "color:hsl(var(--h),85%,66%);",
    "background:hsl(var(--h),60%,13%);",
    "border:1px solid hsl(var(--h),55%,30%);",
    "}",
    ".oa-today-chip.none{",
    "color:#7d8aa3;",
    "background:#111b2d;",
    "border-color:#1d2a3d;",
    "font-weight:600;",
    "}",
    ".oa-today-body{",
    "display:none;",
    "border-top:1px solid #1b2738;",
    "background:#0a111d;",
    "padding:10px;",
    "}",
    ".oa-today-card.open>.oa-today-body{",
    "display:block;",
    "}",
    ".oa-today-sub{",
    "font-size:11px;",
    "color:#8290a7;",
    "margin-bottom:8px;",
    "line-height:1.5;",
    "}",
    ".oa-today-grid{",
    "display:grid;",
    "grid-template-columns:repeat(3,minmax(0,1fr));",
    "gap:6px;",
    "}",
    ".oa-today-box{",
    "min-width:0;",
    "text-align:center;",
    "padding:8px 4px;",
    "border-radius:8px;",
    "background:hsl(var(--h),60%,12%);",
    "border:1px solid hsl(var(--h),50%,26%);",
    "}",
    ".oa-today-box.ideal{",
    "border-color:hsl(var(--h),70%,46%);",
    "box-shadow:0 0 0 1px hsl(var(--h),70%,40%) inset;",
    "}",
    ".oa-today-box.dim{",
    "opacity:.5;",
    "}",
    ".oa-today-label{",
    "display:block;",
    "font-size:11px;",
    "font-weight:700;",
    "color:#dbe5f3;",
    "white-space:nowrap;",
    "overflow:hidden;",
    "text-overflow:ellipsis;",
    "}",
    ".oa-today-box b{",
    "display:block;",
    "margin-top:4px;",
    "font-size:18px;",
    "line-height:1.1;",
    "color:hsl(var(--h),85%,62%);",
    "}",
    ".oa-today-n{",
    "display:block;",
    "margin-top:3px;",
    "font-size:10px;",
    "color:#9aa8c9;",
    "}",
    ".oa-today-o{",
    "display:block;",
    "margin-top:2px;",
    "font-size:10px;",
    "color:#6f7f9f;",
    "}",
    ".oa-today-row{",
    "background:#0d1422;",
    "border:1px solid #1d2a3d;",
    "border-radius:8px;",
    "margin-bottom:7px;",
    "padding:8px;",
    "}",
    ".oa-today-rh{",
    "display:flex;",
    "align-items:center;",
    "gap:8px;",
    "margin-bottom:7px;",
    "}",
    ".oa-today-p2{",
    "flex:0 0 26px;",
    "width:26px;",
    "height:26px;",
    "border-radius:7px;",
    "border:1px solid #2b4058;",
    "background:#111d30;",
    "color:#9fb6d1;",
    "font-size:16px;",
    "line-height:1;",
    "cursor:pointer;",
    "}",
    ".oa-today-row.open .oa-today-p2{",
    "background:#1d6ef2;",
    "border-color:#1d6ef2;",
    "color:#fff;",
    "}",
    ".oa-today-rt{",
    "font-size:13px;",
    "font-weight:700;",
    "color:#f0f4fb;",
    "min-width:0;",
    "overflow:hidden;",
    "text-overflow:ellipsis;",
    "white-space:nowrap;",
    "}",
    ".oa-today-ro{",
    "flex:0 0 auto;",
    "font-size:13px;",
    "font-weight:800;",
    "color:#5fd4cc;",
    "}",
    ".oa-today-rn{",
    "flex:1;",
    "text-align:right;",
    "font-size:10px;",
    "color:#8290a7;",
    "white-space:nowrap;",
    "}",
    ".oa-today-det{",
    "display:none;",
    "margin-top:8px;",
    "border-top:1px solid #1b2738;",
    "padding-top:6px;",
    "}",
    ".oa-today-row.open .oa-today-det{",
    "display:block;",
    "}",
    ".oa-today-dh{",
    "font-size:11px;",
    "color:#8290a7;",
    "margin:2px 0 6px;",
    "line-height:1.5;",
    "}",
    ".oa-today-match{",
    "display:grid;",
    "grid-template-columns:minmax(0,1fr) auto auto;",
    "gap:8px;",
    "align-items:center;",
    "padding:6px 0;",
    "border-top:1px solid #182538;",
    "font-size:12px;",
    "color:#dbe5f3;",
    "}",
    ".oa-today-match.unp{",
    "opacity:.55;",
    "}",
    ".oa-today-match-teams b{",
    "display:block;",
    "font-weight:700;",
    "overflow:hidden;",
    "text-overflow:ellipsis;",
    "white-space:nowrap;",
    "}",
    ".oa-today-match-teams small{",
    "display:block;",
    "margin-top:2px;",
    "font-size:10px;",
    "color:#7f8daf;",
    "}",
    ".oa-today-empty{",
    "background:#0d1422;",
    "border:1px solid #1d2a3d;",
    "border-radius:8px;",
    "padding:22px;",
    "text-align:center;",
    "color:#9ba6bf;",
    "line-height:1.7;",
    "}",
    ".oa-today-empty button{",
    "margin:4px;",
    "padding:8px 12px;",
    "border-radius:8px;",
    "border:1px solid #33405f;",
    "background:#18223a;",
    "color:#e8ecf7;",
    "font-weight:700;",
    "cursor:pointer;",
    "}",
    ".oa-today-note{",
    "font-size:12px;",
    "color:#8290a7;",
    "padding:2px;",
    "}",
    "@media(max-width:800px){",
    ".oa-today-ctl{grid-template-columns:repeat(2,1fr);}",
    "}",
    "@media(max-width:520px){",
    ".oa-today-panel{padding:12px;}",
    ".oa-today-ctl{gap:8px;}",
    ".oa-today-stats{gap:6px;}",
    ".oa-today-stat{padding:8px;}",
    ".oa-today-stat b{font-size:14px;}",
    ".oa-today-stat span{font-size:10px;}",
    ".oa-today-head{padding:8px;gap:8px;}",
    ".oa-today-teams{font-size:13px;}",
    ".oa-today-chip{font-size:10px;padding:4px 6px;}",
    ".oa-today-body{padding:8px;}",
    ".oa-today-grid{gap:5px;}",
    ".oa-today-box{padding:7px 2px;}",
    ".oa-today-label{font-size:10px;}",
    ".oa-today-box b{font-size:15px;}",
    ".oa-today-n,.oa-today-o{font-size:9px;}",
    ".oa-today-row{padding:7px;}",
    ".oa-today-rt{font-size:12px;}",
    ".oa-today-ro{font-size:12px;}",
    "}"
  ].join("");
  var st = document.createElement("style");
  st.id = "oa-today-isolated-style";
  st.textContent = css;
  document.head.appendChild(st);
  /* =========================================================
     SEKME
  ========================================================= */
  var tabs = document.querySelector(".tabs");
  if (!tabs) return;
  var btn = document.createElement("button");
  btn.className = "tab";
  btn.dataset.tab = "todayTab";
  btn.textContent = "Bugünün maçları";
  btn.onclick = function () {
    if (typeof showTab === "function") {
      showTab("todayTab");
    }
    render();
  };
  tabs.insertBefore(btn, tabs.firstChild);
  /* =========================================================
     BÖLÜM
  ========================================================= */
  var sec = document.createElement("section");
  sec.id = "todayTab";
  sec.hidden = true;
  sec.className = "oa-today-root";
  sec.innerHTML =
    '<div class="oa-today-panel">' +
      "<h2>Bugünün maçları</h2>" +
      '<div class="notice">' +
        "Oynanmamış maçlar listelenir. Maçın yanındaki " +
        "<b>+</b> butonuna basınca her oran türü için, " +
        "aynı oranla <b>" +
        fmtDate(START) +
        "</b> ve sonrası oynanmış maçların sonuç yüzdeleri çıkar. " +
        "Oranın yanındaki <b>+</b> ile o oranlı maçlar listelenir." +
      "</div>" +
      '<div class="oa-today-ctl">' +
        '<div class="oa-today-field">' +
          '<label for="tdDate">Maç günü</label>' +
          '<input id="tdDate" type="date" class="oa-today-input">' +
        "</div>" +
        '<div class="oa-today-field">' +
          '<label for="tdBasis">Eşleştirme</label>' +
          '<select id="tdBasis" class="oa-today-select"></select>' +
        "</div>" +
        '<div class="oa-today-field">' +
          '<label for="tdThr">İdeal eşik (%)</label>' +
          '<input id="tdThr" type="number" class="oa-today-input" value="70" min="0" max="100">' +
        "</div>" +
        '<div class="oa-today-field">' +
          '<label for="tdMin">Min. geçmiş maç</label>' +
          '<input id="tdMin" type="number" class="oa-today-input" value="5" min="1">' +
        "</div>" +
        '<div class="oa-today-field">' +
          '<label for="tdOdd">Min. oran</label>' +
          '<input id="tdOdd" type="number" class="oa-today-input" step="0.01" min="1" value="' +
          defMinOdd() +
          '">' +
        "</div>" +
      "</div>" +
      '<div class="oa-today-checks">' +
        '<label>' +
          '<input type="checkbox" id="tdOnly">' +
          " Sadece ideal sonucu olan maçlar" +
        "</label>" +
        '<label>' +
          '<input type="checkbox" id="tdAll">' +
          " Tüm sonuçları göster" +
        "</label>" +
      "</div>" +
    "</div>" +
    '<div id="tdStats"></div>' +
    '<div id="tdList"></div>';
  var anchor = $("futureTab");
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(
      sec,
      anchor.nextSibling
    );
  } else {
    document.body.appendChild(sec);
  }
  $("tdDate").value = iso(new Date());
  $("tdBasis").innerHTML = BASIS
    .map(function (b) {
      return (
        '<option value="' +
        E(b.v) +
        '">' +
        E(b.l) +
        "</option>"
      );
    })
    .join("");
  [
    "tdDate",
    "tdBasis",
    "tdThr",
    "tdMin",
    "tdOdd",
    "tdOnly",
    "tdAll"
  ].forEach(function (id) {
    $(id).addEventListener(
      "change",
      render
    );
  });
  [
    "tdThr",
    "tdMin",
    "tdOdd"
  ].forEach(function (id) {
    $(id).addEventListener(
      "input",
      render
    );
  });
  /* =========================================================
     CANLI SKOR
  ========================================================= */
  function fetchLiveScores() {
    fetch(
      LIVE_JSON_URL +
      "?_=" +
      Date.now(),
      {
        cache: "no-store"
      }
    )
      .then(function (res) {
        if (!res.ok) {
          throw new Error(
            "JSON yüklenemedi"
          );
        }
        return res.json();
      })
      .then(function (data) {
        var matches =
          data.matches || [];
        var scores = [];
        matches.forEach(function (m) {
          if (
            m.score &&
            m.score.home !== null &&
            m.score.home !== undefined
          ) {
            scores.push({
              home: m.home,
              away: m.away,
              score:
                m.score.home +
                " - " +
                m.score.away,
              code: m.code
            });
          }
        });
        CUR.liveScores = scores;
        updateScoresOnUI();
      })
      .catch(function (err) {
        console.log(
          "Maçkolik JSON skor hatası:",
          err
        );
      });
  }
  function updateScoresOnUI() {
    if (
      !CUR.liveScores ||
      !CUR.liveScores.length
    ) {
      return;
    }
    CUR.items.forEach(function (it, i) {
      var home = it.r.home;
      var away = it.r.away;
      var found =
        CUR.liveScores.find(function (s) {
          return (
            (
              it.r.code &&
              String(s.code) ===
              String(it.r.code)
            )
            ||
            (
              isTeamMatch(
                s.home,
                home
              )
              &&
              isTeamMatch(
                s.away,
                away
              )
            )
          );
        });
      var card =
        sec.querySelector(
          '.oa-today-card[data-i="' +
          i +
          '"]'
        );
      if (!card) return;
      var existingScore =
        card.querySelector(
          ".oa-today-score"
        );
      if (found) {
        if (!existingScore) {
          existingScore =
            document.createElement(
              "div"
            );
          var chip =
            card.querySelector(
              ".oa-today-chip"
            );
          card
            .querySelector(
              ".oa-today-head"
            )
            .insertBefore(
              existingScore,
              chip
            );
        }
        existingScore.className =
          "oa-today-score";
        existingScore.textContent =
          found.score;
      }
    });
  }
  /* =========================================================
     TIKLAMALAR
  ========================================================= */
  sec.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      if (!t.closest) return;
      var p2 =
        t.closest(
          ".oa-today-p2"
        );
      if (p2) {
        var row =
          p2.closest(
            ".oa-today-row"
          );
        var card =
          p2.closest(
            ".oa-today-card"
          );
        row.classList.toggle(
          "open"
        );
        if (
          row.classList.contains(
            "open"
          ) &&
          !row.getAttribute(
            "data-f"
          )
        ) {
          var it =
            CUR.items[
              +card.getAttribute(
                "data-i"
              )
            ];
          var rw =
            it &&
            it.shown &&
            it.shown[
              +row.getAttribute(
                "data-r"
              )
            ];
          if (rw) {
            row.querySelector(
              ".oa-today-det"
            ).innerHTML =
              detailHtml(
                it.r,
                rw
              );
            row.setAttribute(
              "data-f",
              "1"
            );
          }
        }
        return;
      }
      var p =
        t.closest(
          ".oa-today-plus"
        );
      if (p) {
        var c =
          p.closest(
            ".oa-today-card"
          );
        c.classList.toggle(
          "open"
        );
        if (
          c.classList.contains(
            "open"
          ) &&
          !c.getAttribute(
            "data-b"
          )
        ) {
          c.querySelector(
            ".oa-today-body"
          ).innerHTML =
            bodyHtml(
              CUR.items[
                +c.getAttribute(
                  "data-i"
                )
              ]
            );
          c.setAttribute(
            "data-b",
            "1"
          );
        }
        return;
      }
      var d =
        t.closest("[data-d]");
      if (d) {
        $("tdDate").value =
          d.getAttribute(
            "data-d"
          );
        render();
      }
    }
  );
  /* =========================================================
     VERİ
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
      Object.keys(x.odds)
        .forEach(function (k) {
          var n =
            num(x.odds[k]);
          if (!(n > 0)) return;
          var key =
            k + "|" + n;
          (
            m[key] ||
            (
              m[key] = []
            )
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
        hist.forEach(
          function (x) {
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
            if (v) n++;
          }
        );
        return {
          d: d,
          n: n,
          t: t,
          p:
            t
              ? 100 * n / t
              : 0,
          odd:
            oddsOfMatch
              ? oddsOfMatch[
                  d.odd
                ]
              : ""
        };
      });
    list.forEach(
      function (x) {
        x.ideal =
          x.t >= min &&
          x.p >= thr;
      }
    );
    list.sort(
      function (a, b) {
        return (
          (b.ideal - a.ideal) ||
          (b.p - a.p) ||
          (b.t - a.t)
        );
      }
    );
    return list;
  }
  /* =========================================================
     ANALİZ
  ========================================================= */
  function analyzeEach(
    r,
    cfg
  ) {
    var rows = [];
    var M =
      marketsMap();
    var odds =
      r.odds || {};
    var seenHistKeys = {};
    Object.keys(odds)
      .forEach(function (k) {
        if (!(k in M)) return;
        var n =
          num(odds[k]);
        if (
          !(n >= cfg.minOdd)
        ) {
          return;
        }
        var hist =
          CUR.idxPlayed[
            k + "|" + n
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
                "_" +
                m.home +
                "_" +
                m.away
              );
            })
            .sort()
            .join("|");
        var uniqueKey =
          n +
          "::" +
          histSignature;
        if (
          seenHistKeys[
            uniqueKey
          ]
        ) {
          return;
        }
        seenHistKeys[
          uniqueKey
        ] = true;
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
          top: list[0]
        });
      });
    rows.sort(
      function (a, b) {
        return (
          (
            b.ideal.length > 0
          ) -
          (
            a.ideal.length > 0
          )
          ||
          (
            b.top.p -
            a.top.p
          )
          ||
          (
            b.top.t -
            a.top.t
          )
        );
      }
    );
    var best = null;
    rows.forEach(
      function (rw) {
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
      }
    );
    var idealRows =
      rows.filter(
        function (x) {
          return x.ideal.length;
        }
      );
    return {
      mode: "each",
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
        : "";
    if (!mode) {
      var has =
        keys.every(
          function (k) {
            return !isEmpty(
              odds[k]
            );
          }
        );
      if (!has) return null;
    }
    var hist =
      pool.filter(
        function (x) {
          if (
            mode === "all"
          ) {
            return true;
          }
          if (
            mode === "league"
          ) {
            return (
              !!r.league &&
              x.league ===
              r.league
            );
          }
          if (
            mode === "team"
          ) {
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
                num(
                  x.odds[k]
                ) ===
                num(
                  odds[k]
                )
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
      mode: "single",
      noOdds: !!mode,
      hist: hist.length,
      list: list,
      ideal: ideal,
      best:
        ideal[0] ||
        null,
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
      '<div class="oa-today-box ' +
      (
        x.ideal
          ? "ideal"
          : "dim"
      ) +
      '" style="--h:' +
      hue(x.p) +
      '">' +
        '<span class="oa-today-label">' +
          E(x.d.l) +
        "</span>" +
        "<b>%" +
          fmtRate(x.p) +
        "</b>" +
        '<span class="oa-today-n">' +
          x.n +
          "/" +
          x.t +
        "</span>" +
        (
          showOdd &&
          !isEmpty(x.odd)
            ? '<span class="oa-today-o">' +
              E(x.odd) +
              "</span>"
            : ""
        ) +
      "</div>"
    );
  }
  function detailHtml(
    cur,
    rw
  ) {
    var played =
      rw.hist
        .slice()
        .sort(
          function (a, b) {
            return String(
              b.date
            ).localeCompare(
              String(a.date)
            );
          }
        );
    var unp =
      (
        CUR.idxUnp[
          rw.k +
          "|" +
          rw.n
        ] ||
        []
      )
        .filter(
          function (x) {
            return x.r !== cur;
          }
        )
        .sort(
          function (a, b) {
            return String(
              a.date
            ).localeCompare(
              String(b.date)
            );
          }
        );
    var LIM = 80;
    function line(
      x,
      isUnp
    ) {
      return (
        '<div class="oa-today-match' +
        (
          isUnp
            ? " unp"
            : ""
        ) +
        '">' +
          '<div class="oa-today-match-teams">' +
            "<b>" +
              E(x.home) +
              " - " +
              E(x.away) +
            "</b>" +
            "<small>" +
              E(fmtDate(x.date)) +
              (
                x.league
                  ? " · " +
                    E(x.league)
                  : ""
              ) +
            "</small>" +
          "</div>" +
          "<span>İY " +
            E(
              isUnp ||
              isEmpty(x.HT)
                ? "—"
                : x.HT
            ) +
          "</span>" +
          "<span>MS " +
            E(
              isUnp ||
              isEmpty(x.FT)
                ? "—"
                : x.FT
            ) +
          "</span>" +
        "</div>"
      );
    }
    return (
      '<div class="oa-today-dh">' +
        "<b>" +
          E(rw.label) +
          " = " +
          E(rw.odd) +
        "</b>" +
        " · " +
        played.length +
        " oynanmış" +
        (
          unp.length
            ? " · " +
              unp.length +
              " oynanmamış (yüzdeye girmez)"
            : ""
        ) +
      "</div>" +
      played
        .slice(0, LIM)
        .map(
          function (x) {
            return line(
              x,
              false
            );
          }
        )
        .join("") +
      (
        played.length > LIM
          ? '<div class="oa-today-note">' +
            "İlk " +
            LIM +
            " maç gösteriliyor." +
            "</div>"
          : ""
      ) +
      unp
        .slice(0, 30)
        .map(
          function (x) {
            return line(
              x,
              true
            );
          }
        )
        .join("")
    );
  }
  function bodyHtml(it) {
    var a = it.a;
    var cfg = CUR.cfg;
    if (!a) {
      return (
        '<div class="oa-today-note">' +
        "Bu maçta seçilen eşleştirme " +
        "oranları Excel’de bulunmuyor." +
        "</div>"
      );
    }
    if (a.mode === "each") {
      var shown =
        cfg.showAll
          ? a.rows
          : a.idealRows;
      it.shown = shown;
      if (!shown.length) {
        return (
          '<div class="oa-today-note">' +
          (
            a.rows.length
              ? "İdeal sonuç yok " +
                "(eşik %" +
                cfg.thr +
                ", en az " +
                cfg.min +
                " maç). " +
                "“Tüm sonuçları göster” " +
                "ile hepsini görebilirsin."
              : "Bu maçın oranlarıyla " +
                "eşleşen geçmiş maç bulunamadı."
          ) +
          "</div>"
        );
      }
      return (
        '<div class="oa-today-sub">' +
          "Her oran türü ayrı aranır · " +
          fmtDate(START) +
          " ve sonrası · eşik %" +
          cfg.thr +
          " · en az " +
          cfg.min +
          " maç · " +
          shown.length +
          " oran" +
        "</div>" +
        shown
          .map(
            function (rw, i) {
              var boxes =
                cfg.showAll
                  ? rw.list
                  : rw.ideal;
              return (
                '<div class="oa-today-row" data-r="' +
                i +
                '">' +
                  '<div class="oa-today-rh">' +
                    '<button class="oa-today-p2" type="button">' +
                      "+" +
                    "</button>" +
                    '<span class="oa-today-rt">' +
                      E(rw.label) +
                    "</span>" +
                    '<span class="oa-today-ro">' +
                      E(rw.odd) +
                    "</span>" +
                    '<span class="oa-today-rn">' +
                      rw.hist.length +
                      " maç" +
                    "</span>" +
                  "</div>" +
                  '<div class="oa-today-grid">' +
                    boxes
                      .map(
                        function (x) {
                          return boxHtml(
                            x,
                            false
                          );
                        }
                      )
                      .join("") +
                  "</div>" +
                  '<div class="oa-today-det"></div>' +
                "</div>"
              );
            }
          )
          .join("")
      );
    }
    var shownS =
      cfg.showAll
        ? a.list
        : a.ideal;
    return (
      '<div class="oa-today-sub">' +
        (
          a.noOdds
            ? "Geçmiş maç"
            : "Aynı oranlı geçmiş maç"
        ) +
        ": <b>" +
        a.hist +
        "</b> (" +
        fmtDate(START) +
        " ve sonrası) · eşik %" +
        cfg.thr +
        " · en az " +
        cfg.min +
        " maç" +
      "</div>" +
      (
        shownS.length
          ? '<div class="oa-today-grid">' +
            shownS
              .map(
                function (x) {
                  return boxHtml(
                    x,
                    true
                  );
                }
              )
              .join("") +
            "</div>"
          : '<div class="oa-today-note">' +
            "İdeal sonuç yok. " +
            "“Tüm sonuçları göster” ile hepsini görebilirsin." +
            "</div>"
      )
    );
  }
  /* =========================================================
     ÇİZİM
  ========================================================= */
  function render() {
    var out =
      $("tdList");
    var stats =
      $("tdStats");
    if (!out) return;
    var date =
      $("tdDate").value ||
      iso(new Date());
    var keys =
      $("tdBasis")
        .value
        .split(",");
    var cfg = {
      thr:
        Number(
          $("tdThr").value
        ) || 0,
      min:
        Math.max(
          1,
          Number(
            $("tdMin").value
          ) || 1
        ),
      minOdd:
        Number(
          $("tdOdd").value
        ) || 0,
      showAll:
        $("tdAll").checked,
      onlyIdeal:
        $("tdOnly").checked
    };
    CUR.cfg = cfg;
    var src =
      typeof DATA !== "undefined" &&
      Array.isArray(DATA)
        ? DATA
        : [];
    var pool =
      src
        .filter(
          function (x) {
            return (
              x.played &&
              String(x.date) >=
              START
            );
          }
        )
        .map(mk);
    var unpAll =
      src
        .filter(
          function (x) {
            return !x.played;
          }
        )
        .map(mk);
    CUR.idxPlayed =
      buildIndex(pool);
    CUR.idxUnp =
      buildIndex(unpAll);
    var today =
      src
        .filter(
          function (x) {
            return (
              !x.played &&
              x.date === date
            );
          }
        )
        .sort(
          function (a, b) {
            return String(
              a.time
            ).localeCompare(
              String(b.time)
            );
          }
        );
    var items =
      today.map(
        function (r) {
          var a =
            keys[0] === "each"
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
        }
      );
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
      '<div class="oa-today-stats">' +
        '<div class="oa-today-stat">' +
          "<span>Oynanmamış maç</span>" +
          "<b>" +
          today.length +
          "</b>" +
        "</div>" +
        '<div class="oa-today-stat">' +
          "<span>İdeal sonuçlu</span>" +
          "<b>" +
          idealCount +
          "</b>" +
        "</div>" +
        '<div class="oa-today-stat">' +
          "<span>Analiz havuzu</span>" +
          "<b>" +
          pool.length.toLocaleString(
            "tr-TR"
          ) +
          "</b>" +
        "</div>" +
      "</div>";
    if (!today.length) {
      var dates = [];
      src.forEach(
        function (x) {
          if (
            !x.played &&
            x.date &&
            String(x.date) >=
            date &&
            dates.indexOf(
              x.date
            ) < 0
          ) {
            dates.push(
              x.date
            );
          }
        }
      );
      dates.sort();
      out.innerHTML =
        '<div class="oa-today-empty">' +
          fmtDate(date) +
          " için oynanmamış " +
          "maç bulunamadı." +
          (
            dates.length
              ? "<br>Maç olan günler:<br>" +
                dates
                  .slice(0, 6)
                  .map(
                    function (d) {
                      return (
                        '<button data-d="' +
                        d +
                        '">' +
                        fmtDate(d) +
                        "</button>"
                      );
                    }
                  )
                  .join("")
              : "<br>Excel’de ileri " +
                "tarihli maç yok."
          ) +
        "</div>";
      return;
    }
    if (!items.length) {
      out.innerHTML =
        '<div class="oa-today-empty">' +
        "Bu ayarlarla ideal sonucu olan maç yok. " +
        "Eşiği veya minimum maç sayısını düşürebilirsin." +
        "</div>";
      return;
    }
    out.innerHTML =
      items
        .map(
          function (it, i) {
            var r = it.r;
            var a = it.a;
            var chip;
            if (!a) {
              chip =
                '<span class="oa-today-chip none">' +
                "Oran yok" +
                "</span>";
            }
            else if (a.best) {
              chip =
                '<span class="oa-today-chip" style="--h:' +
                hue(a.best.p) +
                '">' +
                E(a.best.d.l) +
                " %" +
                fmtRate(a.best.p) +
                "</span>";
            }
            else {
              chip =
                '<span class="oa-today-chip none">' +
                "İdeal yok" +
                "</span>";
            }
            return (
              '<div class="oa-today-card" data-i="' +
              i +
              '">' +
                '<div class="oa-today-head">' +
                  '<button class="oa-today-plus" type="button">' +
                    "+" +
                  "</button>" +
                  '<div class="oa-today-info">' +
                    '<div class="oa-today-meta">' +
                      E(r.time || "") +
                      (
                        r.league
                          ? " · " +
                            E(r.league)
                          : ""
                      ) +
                    "</div>" +
                    '<div class="oa-today-teams">' +
                      E(r.home) +
                      " - " +
                      E(r.away) +
                    "</div>" +
                  "</div>" +
                  chip +
                "</div>" +
                '<div class="oa-today-body"></div>' +
              "</div>"
            );
          }
        )
        .join("");
    fetchLiveScores();
  }
  /* =========================================================
     SKORU 30 SANİYEDE BİR KONTROL
  ========================================================= */
  setInterval(
    fetchLiveScores,
    30000
  );
})();
