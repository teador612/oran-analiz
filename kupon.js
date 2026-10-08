"use strict";

/* =========================================================
   İDEAL KUPON
   Skor kaynağı:
   Bugünün Maçları -> window.ORAN_LIVE_SCORES

   Yeni skor dosyası YOK.
========================================================= */

(function () {

  /* =========================================================
     AYARLAR
  ========================================================= */

  var HISTORY_DAYS = 60;
  var MIN_SAMPLE = 5;
  var MIN_SUCCESS = 70;

  var MIN_TOTAL_ODDS = 2.00;
  var MAX_MATCHES = 4;

  /* =========================================================
     DURUM
  ========================================================= */

  var DATA = [];
  var DATE_INDEX = {};
  var HISTORY_CACHE = {};
  var STATS_CACHE = {};
  var CANDIDATE_CACHE = {};

  var selectedDate = "";
  var renderTimer = null;
  var renderVersion = 0;

  /* =========================================================
     YARDIMCILAR
  ========================================================= */

  function E(v) {
    return String(v == null ? "" : v).replace(
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

  function number(v) {

    if (
      v === null ||
      v === undefined ||
      v === ""
    ) {
      return null;
    }

    var n = Number(
      String(v)
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    );

    return isFinite(n)
      ? n
      : null;
  }

  function normalizeDate(v) {

    if (!v) return "";

    var s = String(v).trim();

    var m =
      s.match(
        /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/
      );

    if (m) {

      return (
        m[1] +
        "-" +
        String(m[2]).padStart(2, "0") +
        "-" +
        String(m[3]).padStart(2, "0")
      );

    }

    m =
      s.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
      );

    if (m) {

      return (
        m[3] +
        "-" +
        String(m[2]).padStart(2, "0") +
        "-" +
        String(m[1]).padStart(2, "0")
      );

    }

    return "";

  }

  function today() {

    var d = new Date();

    return (
      d.getFullYear() +
      "-" +
      String(
        d.getMonth() + 1
      ).padStart(2, "0") +
      "-" +
      String(
        d.getDate()
      ).padStart(2, "0")
    );

  }

  function shiftDate(date, days) {

    var d =
      new Date(
        date + "T12:00:00"
      );

    d.setDate(
      d.getDate() + days
    );

    return (
      d.getFullYear() +
      "-" +
      String(
        d.getMonth() + 1
      ).padStart(2, "0") +
      "-" +
      String(
        d.getDate()
      ).padStart(2, "0")
    );

  }

  function dateDisplay(date) {

    var p =
      String(date).split("-");

    return p.length === 3
      ? p[2] + "." + p[1] + "." + p[0]
      : date;

  }

  /* =========================================================
     ORAN
  ========================================================= */

  function oddsOf(row) {

    return (
      row.odds ||
      row.openingOdds ||
      row.opening_odds ||
      row.opening ||
      {}
    );

  }

  function odd(row, key) {

    var odds =
      oddsOf(row);

    var v =
      number(
        odds[key]
      );

    return v !== null &&
      v > 0
      ? v
      : null;

  }

  /* =========================================================
     SKOR
  ========================================================= */

  function parseScore(v) {

    if (
      v === null ||
      v === undefined
    ) {
      return null;
    }

    if (
      Array.isArray(v) &&
      v.length >= 2
    ) {

      var ah =
        number(v[0]);

      var aa =
        number(v[1]);

      if (
        ah !== null &&
        aa !== null
      ) {

        return {
          home: ah,
          away: aa
        };

      }

    }

    if (
      typeof v === "object"
    ) {

      var h =
        number(
          v.home ??
          v.homeScore ??
          v.homeGoals ??
          v.h
        );

      var a =
        number(
          v.away ??
          v.awayScore ??
          v.awayGoals ??
          v.a
        );

      if (
        h !== null &&
        a !== null
      ) {

        return {
          home: h,
          away: a
        };

      }

    }

    var m =
      String(v).match(
        /(\d+)\s*[-:]\s*(\d+)/
      );

    if (!m) return null;

    return {
      home: Number(m[1]),
      away: Number(m[2])
    };

  }

  /* =========================================================
     BUGÜNÜN MAÇLARI SKORU
  ========================================================= */

  function liveScores() {

    var list =
      window.ORAN_LIVE_SCORES;

    return Array.isArray(list)
      ? list
      : [];

  }

  function cleanTeam(v) {

    return String(v || "")
      .toLowerCase()
      .replace(
        /fc|sc|cd|de|club|atletico|deportivo|fk|sk|sporting/g,
        ""
      )
      .replace(
        /[^a-z0-9ğüşıöç]/g,
        ""
      )
      .trim();

  }

  function teamsMatch(a, b) {

    var x =
      cleanTeam(a);

    var y =
      cleanTeam(b);

    if (!x || !y) return false;

    if (x === y) return true;

    return (
      x.length > 3 &&
      y.length > 3 &&
      (
        x.indexOf(y) >= 0 ||
        y.indexOf(x) >= 0
      )
    );

  }

  function scoreFromBugun(row) {

    var scores =
      liveScores();

    if (!scores.length) {
      return null;
    }

    var rowCode =
      row.code ||
      row.matchId ||
      row.id ||
      "";

    for (
      var i = 0;
      i < scores.length;
      i++
    ) {

      var s =
        scores[i];

      if (
        rowCode &&
        s.code &&
        String(rowCode) ===
        String(s.code)
      ) {

        return {
          home: Number(
            s.homeScore
          ),
          away: Number(
            s.awayScore
          )
        };

      }

    }

    for (
      var j = 0;
      j < scores.length;
      j++
    ) {

      var x =
        scores[j];

      if (
        teamsMatch(
          x.home,
          row.home
        ) &&
        teamsMatch(
          x.away,
          row.away
        )
      ) {

        var h =
          number(
            x.homeScore
          );

        var a =
          number(
            x.awayScore
          );

        if (
          h !== null &&
          a !== null
        ) {

          return {
            home: h,
            away: a
          };

        }

        var parsed =
          parseScore(
            x.score
          );

        if (parsed) {
          return parsed;
        }

      }

    }

    return null;

  }

  function ftScore(row) {

    /*
      Önce Bugünün Maçları skor kaynağı.
    */

    var live =
      scoreFromBugun(row);

    if (live) {
      return live;
    }

    /*
      Sonra ORAN_DATA içindeki mevcut skor.
    */

    var values = [
      row.scoreFT,
      row.ftScore,
      row.fullTimeScore,
      row.score &&
        row.score.fullTime,
      row.score &&
        row.score.ft,
      row.score
    ];

    for (
      var i = 0;
      i < values.length;
      i++
    ) {

      var s =
        parseScore(
          values[i]
        );

      if (s) return s;

    }

    return null;

  }

  function htScore(row) {

    var values = [
      row.scoreHT,
      row.htScore,
      row.halfTimeScore,
      row.score &&
        row.score.halfTime,
      row.score &&
        row.score.ht
    ];

    for (
      var i = 0;
      i < values.length;
      i++
    ) {

      var s =
        parseScore(
          values[i]
        );

      if (s) return s;

    }

    return null;

  }

  function played(row) {

    var ft =
      ftScore(row);

    if (ft) return true;

    var status =
      String(
        row.status ||
        row.matchStatus ||
        ""
      ).toLowerCase();

    if (
      status === "finished" ||
      status === "final" ||
      status === "ft" ||
      status === "completed" ||
      status === "ended"
    ) {
      return true;
    }

    return row.played === true;

  }

  /* =========================================================
     SONUÇ
  ========================================================= */

  function result(row, key) {

    var ft =
      ftScore(row);

    var ht =
      htScore(row);

    if (
      key === "iy1" ||
      key === "iy0" ||
      key === "iy2" ||
      key === "iyOver05" ||
      key === "iyUnder05" ||
      key === "iyOver15" ||
      key === "iyUnder15"
    ) {

      if (!ht) return null;

      var htTotal =
        ht.home +
        ht.away;

      if (key === "iy1")
        return ht.home > ht.away
          ? "1"
          : null;

      if (key === "iy0")
        return ht.home === ht.away
          ? "X"
          : null;

      if (key === "iy2")
        return ht.away > ht.home
          ? "2"
          : null;

      if (key === "iyOver05")
        return htTotal > 0
          ? "ÜST"
          : "ALT";

      if (key === "iyUnder05")
        return htTotal < 1
          ? "ALT"
          : "ÜST";

      if (key === "iyOver15")
        return htTotal > 1
          ? "ÜST"
          : "ALT";

      if (key === "iyUnder15")
        return htTotal < 2
          ? "ALT"
          : "ÜST";

    }

    if (!ft) return null;

    var total =
      ft.home +
      ft.away;

    switch (key) {

      case "ms1":
        return ft.home > ft.away
          ? "1"
          : null;

      case "ms0":
        return ft.home === ft.away
          ? "X"
          : null;

      case "ms2":
        return ft.away > ft.home
          ? "2"
          : null;

      case "kgVar":
        return (
          ft.home > 0 &&
          ft.away > 0
        )
          ? "VAR"
          : "YOK";

      case "kgYok":
        return (
          ft.home === 0 ||
          ft.away === 0
        )
          ? "YOK"
          : "VAR";

      case "over25":
        return total > 2
          ? "ÜST"
          : "ALT";

      case "under25":
        return total < 3
          ? "ALT"
          : "ÜST";

      default:
        return null;

    }

  }

  /* =========================================================
     MAÇ ID
  ========================================================= */

  function id(row) {

    return String(
      row.matchId ??
      row.id ??
      row.code ??
      (
        normalizeDate(
          row.date
        ) +
        "|" +
        row.time +
        "|" +
        row.home +
        "|" +
        row.away
      )
    );

  }

  /* =========================================================
     VERİYİ AL
  ========================================================= */

  function loadData() {

    var source =
      window.ORAN_DATA;

    if (
      !Array.isArray(source)
    ) {

      DATA = [];

      return false;

    }

    DATA =
      source;

    DATE_INDEX = {};

    for (
      var i = 0;
      i < DATA.length;
      i++
    ) {

      var row =
        DATA[i];

      var d =
        normalizeDate(
          row.date
        );

      if (!d) continue;

      if (!DATE_INDEX[d]) {
        DATE_INDEX[d] = [];
      }

      DATE_INDEX[d].push(
        row
      );

    }

    HISTORY_CACHE = {};
    STATS_CACHE = {};
    CANDIDATE_CACHE = {};

    return true;

  }

  /* =========================================================
     GEÇMİŞ
  ========================================================= */

  function history(date) {

    if (
      HISTORY_CACHE[date]
    ) {
      return HISTORY_CACHE[date];
    }

    var out = [];

    for (
      var i = 1;
      i <= HISTORY_DAYS;
      i++
    ) {

      var d =
        shiftDate(
          date,
          -i
        );

      var rows =
        DATE_INDEX[d];

      if (!rows) continue;

      for (
        var j = 0;
        j < rows.length;
        j++
      ) {

        if (
          played(
            rows[j]
          )
        ) {

          out.push(
            rows[j]
          );

        }

      }

    }

    HISTORY_CACHE[date] =
      out;

    return out;

  }

  /* =========================================================
     İSTATİSTİK
  ========================================================= */

  function stats(date) {

    if (
      STATS_CACHE[date]
    ) {
      return STATS_CACHE[date];
    }

    var hist =
      history(date);

    var map = {};

    var markets = [
      ["ms1", "MS 1", "1"],
      ["ms0", "MS X", "X"],
      ["ms2", "MS 2", "2"],
      ["kgVar", "KG Var", "VAR"],
      ["kgYok", "KG Yok", "YOK"],
      ["over25", "2.5 Üst", "ÜST"],
      ["under25", "2.5 Alt", "ALT"],
      ["iy1", "İY 1", "1"],
      ["iy0", "İY X", "X"],
      ["iy2", "İY 2", "2"],
      ["iyOver05", "İY 0.5 Üst", "ÜST"],
      ["iyUnder05", "İY 0.5 Alt", "ALT"],
      ["iyOver15", "İY 1.5 Üst", "ÜST"],
      ["iyUnder15", "İY 1.5 Alt", "ALT"]
    ];

    for (
      var i = 0;
      i < markets.length;
      i++
    ) {

      var m =
        markets[i];

      map[m[0]] = {
        key: m[0],
        label: m[1],
        prediction: m[2],
        sample: 0,
        success: 0
      };

    }

    for (
      var r = 0;
      r < hist.length;
      r++
    ) {

      var row =
        hist[r];

      for (
        var k = 0;
        k < markets.length;
        k++
      ) {

        var key =
          markets[k][0];

        if (
          odd(
            row,
            key
          ) === null
        ) {
          continue;
        }

        var actual =
          result(
            row,
            key
          );

        if (
          actual === null
        ) {
          continue;
        }

        map[key].sample++;

        if (
          actual ===
          map[key].prediction
        ) {

          map[key].success++;

        }

      }

    }

    Object.keys(map)
      .forEach(function (key) {

        var s =
          map[key];

        s.rate =
          s.sample
            ? (
                s.success /
                s.sample
              ) * 100
            : 0;

      });

    STATS_CACHE[date] =
      map;

    return map;

  }

  /* =========================================================
     ADAYLAR
  ========================================================= */

  function candidates(date) {

    if (
      CANDIDATE_CACHE[date]
    ) {

      return CANDIDATE_CACHE[date];

    }

    var rows =
      DATE_INDEX[date] ||
      [];

    var st =
      stats(date);

    var out = [];

    for (
      var i = 0;
      i < rows.length;
      i++
    ) {

      var row =
        rows[i];

      if (
        played(row)
      ) {
        continue;
      }

      var markets =
        Object.keys(st);

      for (
        var j = 0;
        j < markets.length;
        j++
      ) {

        var key =
          markets[j];

        var o =
          odd(
            row,
            key
          );

        if (
          o === null
        ) {
          continue;
        }

        var s =
          st[key];

        if (
          s.sample <
          MIN_SAMPLE
        ) {
          continue;
        }

        if (
          s.rate <
          MIN_SUCCESS
        ) {
          continue;
        }

        out.push({

          row: row,

          key: key,

          label: s.label,

          prediction:
            s.prediction,

          odd: o,

          rate: s.rate,

          sample: s.sample

        });

      }

    }

    out.sort(function (a, b) {

      return (
        b.rate -
        a.rate
        ||
        b.sample -
        a.sample
        ||
        b.odd -
        a.odd
      );

    });

    CANDIDATE_CACHE[date] =
      out;

    return out;

  }

  /* =========================================================
     KUPON
  ========================================================= */

  function createCoupon(date) {

    var list =
      candidates(date);

    var items = [];
    var used = {};
    var total = 1;

    for (
      var i = 0;
      i < list.length;
      i++
    ) {

      var c =
        list[i];

      var match =
        id(c.row);

      if (used[match]) {
        continue;
      }

      used[match] =
        true;

      items.push(c);

      total *=
        c.odd;

      if (
        items.length >=
        MAX_MATCHES
      ) {
        break;
      }

      if (
        total >=
        MIN_TOTAL_ODDS
      ) {
        break;
      }

    }

    return {
      items: items,
      total: total
    };

  }

  /* =========================================================
     DURUM
  ========================================================= */

  function itemStatus(item) {

    if (
      !played(
        item.row
      )
    ) {

      return "pending";

    }

    var actual =
      result(
        item.row,
        item.key
      );

    if (
      actual === null
    ) {

      return "pending";

    }

    return actual ===
      item.prediction
      ? "won"
      : "lost";

  }

  function couponStatus(coupon) {

    if (
      !coupon.items.length
    ) {
      return "empty";
    }

    var pending =
      false;

    for (
      var i = 0;
      i < coupon.items.length;
      i++
    ) {

      var s =
        itemStatus(
          coupon.items[i]
        );

      if (s === "lost") {
        return "lost";
      }

      if (s === "pending") {
        pending = true;
      }

    }

    return pending
      ? "pending"
      : "won";

  }

  /* =========================================================
     HTML
  ========================================================= */

  function css() {

    if (
      document.getElementById(
        "oran-kupon-css"
      )
    ) {
      return;
    }

    var s =
      document.createElement(
        "style"
      );

    s.id =
      "oran-kupon-css";

    s.textContent = `

      .oa-coupon-box{
        margin:14px 0;
        padding:14px;
        border-radius:12px;
        border:1px solid rgba(127,127,127,.2);
        background:var(--card,#111827);
      }

      .oa-coupon-head{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        margin-bottom:12px;
      }

      .oa-coupon-title{
        font-size:18px;
        font-weight:800;
      }

      .oa-coupon-total{
        font-size:15px;
        font-weight:800;
      }

      .oa-coupon-item{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        padding:12px 0;
        border-top:1px solid rgba(127,127,127,.15);
      }

      .oa-coupon-teams{
        min-width:0;
        flex:1;
      }

      .oa-coupon-teams b{
        display:block;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .oa-coupon-meta{
        margin-top:4px;
        font-size:11px;
        opacity:.65;
      }

      .oa-coupon-right{
        display:flex;
        align-items:center;
        gap:7px;
        flex-shrink:0;
      }

      .oa-coupon-market{
        font-size:11px;
        opacity:.7;
      }

      .oa-coupon-pred{
        font-weight:900;
        min-width:30px;
        text-align:center;
      }

      .oa-coupon-odd{
        font-weight:800;
      }

      .oa-coupon-status{
        font-size:12px;
        font-weight:800;
        min-width:72px;
      }

      .oa-coupon-status.won{
        color:#16a34a;
      }

      .oa-coupon-status.lost{
        color:#dc2626;
      }

      .oa-coupon-status.pending{
        color:#d49a00;
      }

      .oa-coupon-empty{
        padding:20px 5px;
        text-align:center;
        opacity:.7;
      }

      .oa-coupon-date{
        margin-bottom:10px;
      }

      .oa-coupon-date input{
        width:100%;
        box-sizing:border-box;
        padding:10px;
        border-radius:8px;
        border:1px solid rgba(127,127,127,.3);
        background:inherit;
        color:inherit;
      }

      @media(max-width:650px){

        .oa-coupon-item{
          align-items:flex-start;
        }

        .oa-coupon-right{
          flex-direction:column;
          align-items:flex-end;
        }

        .oa-coupon-status{
          min-width:auto;
        }

      }

    `;

    document.head.appendChild(s);

  }

  /* =========================================================
     KUpon ALANINI BUL
  ========================================================= */

  function findContainer() {

    var ids = [
      "couponTab",
      "idealCoupon",
      "ideal-kupon",
      "coupon",
      "kuponTab"
    ];

    for (
      var i = 0;
      i < ids.length;
      i++
    ) {

      var el =
        document.getElementById(
          ids[i]
        );

      if (el) return el;

    }

    var selectors = [
      '[data-tab="couponTab"]',
      '[data-tab="idealCoupon"]',
      '[data-tab="ideal-kupon"]',
      ".ideal-kupon",
      ".idealCoupon"
    ];

    for (
      var j = 0;
      j < selectors.length;
      j++
    ) {

      var found =
        document.querySelector(
          selectors[j]
        );

      if (found) return found;

    }

    return null;

  }

  /* =========================================================
     TARİH
  ========================================================= */

  function datePicker(container) {

    var input =
      container.querySelector(
        "#couponDate"
      );

    if (!input) {

      var wrap =
        document.createElement(
          "div"
        );

      wrap.className =
        "oa-coupon-date";

      wrap.innerHTML =
        '<input id="couponDate" type="date">';

      container.prepend(
        wrap
      );

      input =
        wrap.querySelector(
          "#couponDate"
        );

      input.addEventListener(
        "change",
        function () {

          selectedDate =
            input.value;

          render(
            container
          );

        }
      );

    }

    return input;

  }

  /* =========================================================
     RENDER
  ========================================================= */

  function render(container) {

    var version =
      ++renderVersion;

    var input =
      datePicker(
        container
      );

    var date =
      selectedDate ||
      input.value ||
      today();

    selectedDate =
      date;

    input.value =
      date;

    var old =
      container.querySelector(
        ".oa-coupon-box"
      );

    if (old) {
      old.remove();
    }

    var box =
      document.createElement(
        "div"
      );

    box.className =
      "oa-coupon-box";

    box.innerHTML =
      '<div class="oa-coupon-empty">' +
      "Kupon hazırlanıyor..." +
      "</div>";

    container.appendChild(
      box
    );

    clearTimeout(
      renderTimer
    );

    renderTimer =
      setTimeout(
        function () {

          if (
            version !==
            renderVersion
          ) {
            return;
          }

          if (
            !DATA.length
          ) {

            loadData();

          }

          var coupon =
            createCoupon(
              date
            );

          if (
            version !==
            renderVersion
          ) {
            return;
          }

          var status =
            couponStatus(
              coupon
            );

          var statusText =
            status === "won"
              ? "✓ Kupon Kazandı"
              : status === "lost"
                ? "✕ Kupon Kaybetti"
                : status === "pending"
                  ? "• Bekliyor"
                  : "";

          box.innerHTML =

            '<div class="oa-coupon-head">' +

              '<div class="oa-coupon-title">' +
                "🎯 İdeal Kupon" +
              "</div>" +

              '<div class="oa-coupon-total">' +
                (
                  coupon.items.length
                    ? coupon.total.toFixed(2)
                    : ""
                ) +
              "</div>" +

            "</div>" +

            '<div style="font-size:12px;opacity:.65;margin-bottom:8px;">' +
              dateDisplay(date) +
              (
                statusText
                  ? " · " +
                    statusText
                  : ""
              ) +
            "</div>" +

            (
              coupon.items.length

                ? coupon.items
                    .map(function (item) {

                      var s =
                        itemStatus(
                          item
                        );

                      var icon =
                        s === "won"
                          ? "✓"
                          : s === "lost"
                            ? "✕"
                            : "•";

                      var text =
                        s === "won"
                          ? "Kazandı"
                          : s === "lost"
                            ? "Kaybetti"
                            : "Bekliyor";

                      var score =
                        ftScore(
                          item.row
                        );

                      var scoreText =
                        score
                          ? " · " +
                            score.home +
                            "-" +
                            score.away
                          : "";

                      return (

                        '<div class="oa-coupon-item">' +

                          '<div class="oa-coupon-teams">' +

                            "<b>" +
                              E(
                                item.row.home
                              ) +
                              " - " +
                              E(
                                item.row.away
                              ) +
                            "</b>" +

                            '<div class="oa-coupon-meta">' +
                              E(
                                item.row.time ||
                                ""
                              ) +
                              scoreText +
                            "</div>" +

                          "</div>" +

                          '<div class="oa-coupon-right">' +

                            '<span class="oa-coupon-market">' +
                              E(
                                item.label
                              ) +
                            "</span>" +

                            '<span class="oa-coupon-pred">' +
                              E(
                                item.prediction
                              ) +
                            "</span>" +

                            '<span class="oa-coupon-odd">' +
                              item.odd.toFixed(2) +
                            "</span>" +

                            '<span class="oa-coupon-status ' +
                            s +
                            '">' +
                              icon +
                              " " +
                              text +
                            "</span>" +

                          "</div>" +

                        "</div>"

                      );

                    })
                    .join("")

                : '<div class="oa-coupon-empty">' +
                  "Bu tarih için %70 ve üzeri uygun tahmin bulunamadı." +
                  "</div>"
            );

        },
        0
      );

  }

  /* =========================================================
     BAŞLAT
  ========================================================= */

  function init() {

    css();

    if (!loadData()) {
      return;
    }

    var container =
      findContainer();

    if (!container) {

      /*
        HTML'de kupon alanı farklı isimlendirilmişse
        mevcut .tab-content alanlarından ideal kuponu
        bulmaya çalış.
      */

      var sections =
        document.querySelectorAll(
          "section, .tab-content, .tab-pane"
        );

      for (
        var i = 0;
        i < sections.length;
        i++
      ) {

        var text =
          String(
            sections[i].textContent ||
            ""
          ).toLowerCase();

        if (
          text.indexOf(
            "ideal kupon"
          ) >= 0
        ) {

          container =
            sections[i];

          break;

        }

      }

    }

    if (!container) {

      console.warn(
        "İdeal Kupon alanı bulunamadı."
      );

      return;

    }

    var input =
      datePicker(
        container
      );

    var dates =
      Object.keys(
        DATE_INDEX
      ).sort();

    if (dates.length) {

      input.min =
        dates[0];

      input.max =
        dates[dates.length - 1];

    }

    selectedDate =
      DATE_INDEX[today()]
        ? today()
        : (
            dates.length
              ? dates[dates.length - 1]
              : today()
          );

    input.value =
      selectedDate;

    render(
      container
    );

    /*
      Bugünün Maçları yeni skor çektiğinde
      kupon durumlarını yeniden göster.
    */

    window.addEventListener(
      "oran-live-scores-updated",
      function () {

        if (!selectedDate) {
          return;
        }

        /*
          Skor değiştiğinde geçmiş istatistikleri
          tekrar hesaplamıyoruz.
          Sadece kupon durumunu yeniliyoruz.
        */

        render(
          container
        );

      }
    );

    /*
      ORAN_DATA yeniden geldiyse
      indeksleri yenile.
    */

    [
      "oran-data-ready",
      "oran-data-updated",
      "matches-updated",
      "mackolik-data-updated",
      "score-updated",
      "scores-updated"
    ].forEach(
      function (eventName) {

        window.addEventListener(
          eventName,
          function () {

            loadData();

            render(
              container
            );

          }
        );

      }
    );

  }

  /* =========================================================
     ÇALIŞTIR
  ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }

  /* =========================================================
     GLOBAL
  ========================================================= */

  window.oranAnalizCoupon = {
    refresh: function () {

      var c =
        findContainer();

      if (c) {
        loadData();
        render(c);
      }

    }
  };

})();
