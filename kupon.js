"use strict";

/* =========================================================
   ORAN ANALİZİ - İDEAL KUPON
   Skor kaynağı:
   1) Bugünün Maçları / ORAN_DATA
   2) Aynı maç kaydındaki skor alanları
   Yeni skor dosyası YOK.
========================================================= */

(function () {

  /* =========================================================
     AYARLAR
  ========================================================= */

  const HISTORY_DAYS = 60;
  const MIN_SAMPLE = 5;
  const MIN_SUCCESS = 70;
  const MIN_TOTAL_ODDS = 2.00;
  const MAX_MATCHES = 4;

  const MARKETS = [
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

  /* =========================================================
     DURUM
  ========================================================= */

  let DATA = [];
  let DATE_INDEX = new Map();
  let HISTORY_CACHE = new Map();
  let STATS_CACHE = new Map();
  let CANDIDATE_CACHE = new Map();

  let selectedDate = "";
  let renderToken = 0;
  let scoreRefreshTimer = null;

  /* =========================================================
     GENEL YARDIMCILAR
  ========================================================= */

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function num(value) {
    const n = Number(
      String(value ?? "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    );

    return Number.isFinite(n) ? n : null;
  }

  function normalizeDate(value) {
    if (!value) return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0")
      ].join("-");
    }

    const s = String(value).trim();

    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    }

    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) {
      return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    }

    return "";
  }

  function todayISO() {
    const d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function dateOffset(dateString, days) {
    const d = new Date(`${dateString}T12:00:00`);

    if (Number.isNaN(d.getTime())) return "";

    d.setDate(d.getDate() + days);

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function dateText(date) {
    if (!date) return "";

    const p = date.split("-");

    if (p.length !== 3) return date;

    return `${p[2]}.${p[1]}.${p[0]}`;
  }

  /* =========================================================
     ORAN OKUMA
  ========================================================= */

  function getOdds(row) {
    return (
      row?.odds ||
      row?.openingOdds ||
      row?.opening_odds ||
      row?.opening ||
      row?.Odds ||
      {}
    );
  }

  function getOdd(row, key) {
    const odds = getOdds(row);

    const possible = [
      key,
      key.toLowerCase(),
      key.toUpperCase()
    ];

    for (const k of possible) {
      const n = num(odds?.[k]);

      if (n !== null && n > 0) {
        return n;
      }
    }

    return null;
  }

  /* =========================================================
     SKOR OKUMA
     BUGÜNÜN MAÇLARI İLE UYUMLU
  ========================================================= */

  function parseScore(value) {

    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value) && value.length >= 2) {
      const h = num(value[0]);
      const a = num(value[1]);

      if (h !== null && a !== null) {
        return { home: h, away: a };
      }
    }

    if (typeof value === "object") {

      const homeKeys = [
        "home",
        "homeScore",
        "homeGoals",
        "homeTeam",
        "h",
        "scoreHome"
      ];

      const awayKeys = [
        "away",
        "awayScore",
        "awayGoals",
        "awayTeam",
        "a",
        "scoreAway"
      ];

      let h = null;
      let a = null;

      for (const k of homeKeys) {
        const v = num(value[k]);

        if (v !== null) {
          h = v;
          break;
        }
      }

      for (const k of awayKeys) {
        const v = num(value[k]);

        if (v !== null) {
          a = v;
          break;
        }
      }

      if (h !== null && a !== null) {
        return {
          home: h,
          away: a
        };
      }

      return null;
    }

    const s = String(value).trim();

    const m = s.match(/(-?\d+)\s*[-:]\s*(-?\d+)/);

    if (!m) return null;

    return {
      home: Number(m[1]),
      away: Number(m[2])
    };
  }

  function getFTScore(row) {

    const values = [
      row?.scoreFT,
      row?.ftScore,
      row?.fullTimeScore,
      row?.score?.fullTime,
      row?.score?.ft,
      row?.score,
      row?.ft
    ];

    for (const value of values) {
      const score = parseScore(value);

      if (score) return score;
    }

    /* Bazı Bugünün Maçları kayıtlarında doğrudan alanlar olabilir */

    const directHome = [
      row?.homeScore,
      row?.homeGoals,
      row?.scoreHome,
      row?.ftHome
    ];

    const directAway = [
      row?.awayScore,
      row?.awayGoals,
      row?.scoreAway,
      row?.ftAway
    ];

    for (let i = 0; i < directHome.length; i++) {

      const h = num(directHome[i]);
      const a = num(directAway[i]);

      if (h !== null && a !== null) {
        return {
          home: h,
          away: a
        };
      }
    }

    return null;
  }

  function getHTScore(row) {

    const values = [
      row?.scoreHT,
      row?.htScore,
      row?.halfTimeScore,
      row?.score?.halfTime,
      row?.score?.ht,
      row?.halfTime,
      row?.ht
    ];

    for (const value of values) {
      const score = parseScore(value);

      if (score) return score;
    }

    return null;
  }

  function getStatus(row) {

    const status = String(
      row?.status ||
      row?.matchStatus ||
      row?.state ||
      ""
    ).toLowerCase();

    if (
      status.includes("finished") ||
      status.includes("finished") ||
      status.includes("ended") ||
      status.includes("final") ||
      status.includes("completed") ||
      status === "ft"
    ) {
      return "finished";
    }

    if (
      status.includes("live") ||
      status.includes("playing") ||
      status.includes("inplay") ||
      status.includes("in_play")
    ) {
      return "live";
    }

    if (
      status.includes("not_started") ||
      status.includes("notstarted") ||
      status.includes("scheduled") ||
      status.includes("upcoming")
    ) {
      return "not_started";
    }

    if (
      status.includes("postpon") ||
      status.includes("cancel")
    ) {
      return "cancelled";
    }

    return "";
  }

  function isPlayed(row) {

    const status = getStatus(row);
    const ft = getFTScore(row);

    if (status === "finished") return true;

    if (ft) return true;

    if (row?.played === true) return true;

    if (row?.finished === true) return true;

    return false;
  }

  function scoreText(row) {

    const ft = getFTScore(row);

    if (ft) {
      return `${ft.home}-${ft.away}`;
    }

    const ht = getHTScore(row);

    if (ht) {
      return `${ht.home}-${ht.away}`;
    }

    return "—";
  }

  /* =========================================================
     MAÇ KİMLİĞİ
  ========================================================= */

  function matchId(row) {

    return String(
      row?.matchId ??
      row?.id ??
      row?.eventId ??
      row?.fixtureId ??
      `${normalizeDate(row?.date)}_${row?.time}_${row?.home}_${row?.away}`
    );
  }

  /* =========================================================
     SONUÇ HESABI
  ========================================================= */

  function marketResult(row, key) {

    const ft = getFTScore(row);
    const ht = getHTScore(row);

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

      const total = ht.home + ht.away;

      if (key === "iy1") {
        if (ht.home > ht.away) return "1";
        return null;
      }

      if (key === "iy0") {
        if (ht.home === ht.away) return "X";
        return null;
      }

      if (key === "iy2") {
        if (ht.away > ht.home) return "2";
        return null;
      }

      if (key === "iyOver05") {
        return total > 0 ? "ÜST" : "ALT";
      }

      if (key === "iyUnder05") {
        return total < 1 ? "ALT" : "ÜST";
      }

      if (key === "iyOver15") {
        return total > 1 ? "ÜST" : "ALT";
      }

      if (key === "iyUnder15") {
        return total < 2 ? "ALT" : "ÜST";
      }
    }

    if (!ft) return null;

    const total = ft.home + ft.away;

    switch (key) {

      case "ms1":
        return ft.home > ft.away ? "1" : null;

      case "ms0":
        return ft.home === ft.away ? "X" : null;

      case "ms2":
        return ft.away > ft.home ? "2" : null;

      case "kgVar":
        return ft.home > 0 && ft.away > 0 ? "VAR" : "YOK";

      case "kgYok":
        return ft.home === 0 || ft.away === 0 ? "YOK" : "VAR";

      case "over25":
        return total > 2 ? "ÜST" : "ALT";

      case "under25":
        return total < 3 ? "ALT" : "ÜST";

      default:
        return null;
    }
  }

  /* =========================================================
     DATE INDEX
  ========================================================= */

  function buildDateIndex() {

    DATE_INDEX.clear();

    for (const row of DATA) {

      const date = normalizeDate(row?.date);

      if (!date) continue;

      if (!DATE_INDEX.has(date)) {
        DATE_INDEX.set(date, []);
      }

      DATE_INDEX.get(date).push(row);
    }
  }

  /* =========================================================
     TARİHLER
  ========================================================= */

  function availableDates() {

    return Array.from(DATE_INDEX.keys()).sort();
  }

  /* =========================================================
     TARİH İÇİN GEÇMİŞ
  ========================================================= */

  function getHistory(targetDate) {

    if (HISTORY_CACHE.has(targetDate)) {
      return HISTORY_CACHE.get(targetDate);
    }

    const result = [];

    for (let i = 1; i <= HISTORY_DAYS; i++) {

      const d = dateOffset(targetDate, -i);

      if (!d) continue;

      const rows = DATE_INDEX.get(d);

      if (!rows || !rows.length) continue;

      for (const row of rows) {

        if (!isPlayed(row)) continue;

        result.push(row);
      }
    }

    HISTORY_CACHE.set(targetDate, result);

    return result;
  }

  /* =========================================================
     İSTATİSTİK
  ========================================================= */

  function calculateStats(targetDate) {

    if (STATS_CACHE.has(targetDate)) {
      return STATS_CACHE.get(targetDate);
    }

    const history = getHistory(targetDate);
    const stats = new Map();

    for (const row of history) {

      for (const [key, label, prediction] of MARKETS) {

        const odd = getOdd(row, key);

        if (odd === null) continue;

        const result = marketResult(row, key);

        if (!result) continue;

        if (!stats.has(key)) {
          stats.set(key, {
            key,
            label,
            prediction,
            oddTotal: 0,
            success: 0,
            fail: 0,
            sample: 0
          });
        }

        const s = stats.get(key);

        s.sample++;

        if (result === prediction) {
          s.success++;
        } else {
          s.fail++;
        }

        s.oddTotal += odd;
      }
    }

    for (const s of stats.values()) {

      s.successRate =
        s.sample > 0
          ? (s.success / s.sample) * 100
          : 0;

      s.avgOdd =
        s.sample > 0
          ? s.oddTotal / s.sample
          : 0;
    }

    STATS_CACHE.set(targetDate, stats);

    return stats;
  }

  /* =========================================================
     ADAYLAR
  ========================================================= */

  function buildCandidates(targetDate) {

    if (CANDIDATE_CACHE.has(targetDate)) {
      return CANDIDATE_CACHE.get(targetDate);
    }

    const rows = DATE_INDEX.get(targetDate) || [];
    const stats = calculateStats(targetDate);
    const candidates = [];

    for (const row of rows) {

      if (isPlayed(row)) continue;

      for (const [key, label, prediction] of MARKETS) {

        const odd = getOdd(row, key);

        if (odd === null) continue;

        const s = stats.get(key);

        if (!s) continue;

        if (s.sample < MIN_SAMPLE) continue;

        if (s.successRate < MIN_SUCCESS) continue;

        candidates.push({
          row,
          key,
          label,
          prediction,
          odd,
          successRate: s.successRate,
          sample: s.sample
        });
      }
    }

    /* Önce başarı, sonra örnek sayısı, sonra oran */

    candidates.sort((a, b) => {

      if (b.successRate !== a.successRate) {
        return b.successRate - a.successRate;
      }

      if (b.sample !== a.sample) {
        return b.sample - a.sample;
      }

      return b.odd - a.odd;
    });

    CANDIDATE_CACHE.set(targetDate, candidates);

    return candidates;
  }

  /* =========================================================
     KUPON OLUŞTUR
  ========================================================= */

  function buildCoupon(targetDate) {

    const candidates = buildCandidates(targetDate);

    const selected = [];
    const usedMatches = new Set();

    let totalOdd = 1;

    for (const candidate of candidates) {

      const id = matchId(candidate.row);

      if (usedMatches.has(id)) continue;

      if (selected.length >= MAX_MATCHES) break;

      selected.push(candidate);
      usedMatches.add(id);

      totalOdd *= candidate.odd;

      /*
        Toplam oran 2.00'a ulaştığında
        gereksiz kombinasyon aramıyoruz.
      */

      if (totalOdd >= MIN_TOTAL_ODDS) {
        break;
      }
    }

    return {
      items: selected,
      totalOdd
    };
  }

  /* =========================================================
     KUPON DURUMU
  ========================================================= */

  function predictionWon(item) {

    const result = marketResult(item.row, item.key);

    if (!result) return null;

    return result === item.prediction;
  }

  function couponStatus(coupon) {

    if (!coupon.items.length) {
      return "empty";
    }

    let pending = false;

    for (const item of coupon.items) {

      const played = isPlayed(item.row);

      if (!played) {
        pending = true;
        continue;
      }

      const won = predictionWon(item);

      if (won === false) {
        return "lost";
      }

      if (won === null) {
        pending = true;
      }
    }

    if (pending) return "pending";

    return "won";
  }

  /* =========================================================
     KUPON HTML
  ========================================================= */

  function renderItem(item) {

    const row = item.row;

    let icon = "•";
    let cls = "pending";
    let statusText = "Bekliyor";

    if (isPlayed(row)) {

      const won = predictionWon(item);

      if (won === true) {
        icon = "✓";
        cls = "won";
        statusText = "Kazandı";
      } else if (won === false) {
        icon = "✕";
        cls = "lost";
        statusText = "Kaybetti";
      }
    }

    return `
      <div class="coupon-match ${cls}">

        <div class="coupon-match-main">

          <div class="coupon-teams">
            <strong>${esc(row.home || "Ev Sahibi")}</strong>
            <span> - </span>
            <strong>${esc(row.away || "Deplasman")}</strong>
          </div>

          <div class="coupon-meta">
            ${esc(row.time || "")}
            ${scoreText(row) !== "—"
              ? ` · Skor: <b>${esc(scoreText(row))}</b>`
              : ""}
          </div>

        </div>

        <div class="coupon-prediction">
          <div class="coupon-market">
            ${esc(item.label)}
          </div>

          <div class="coupon-value">
            ${esc(item.prediction)}
          </div>

          <div class="coupon-odd">
            ${item.odd.toFixed(2)}
          </div>

          <div class="coupon-status ${cls}">
            <span>${icon}</span>
            ${statusText}
          </div>
        </div>

      </div>
    `;
  }

  /* =========================================================
     CSS
  ========================================================= */

  function injectCSS() {

    if (document.getElementById("oran-kupon-style")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "oran-kupon-style";

    style.textContent = `
      .coupon-box {
        margin: 12px 0;
        padding: 14px;
        border-radius: 14px;
        background: var(--card, #fff);
        border: 1px solid rgba(127,127,127,.18);
      }

      .coupon-header {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        margin-bottom:12px;
      }

      .coupon-title {
        font-size:18px;
        font-weight:800;
      }

      .coupon-total {
        font-size:15px;
        font-weight:800;
      }

      .coupon-match {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        padding:12px 0;
        border-top:1px solid rgba(127,127,127,.15);
      }

      .coupon-match-main {
        min-width:0;
        flex:1;
      }

      .coupon-teams {
        font-size:14px;
        line-height:1.4;
      }

      .coupon-meta {
        margin-top:4px;
        font-size:12px;
        opacity:.7;
      }

      .coupon-prediction {
        display:flex;
        align-items:center;
        gap:8px;
        flex-shrink:0;
      }

      .coupon-market {
        font-size:12px;
        opacity:.7;
      }

      .coupon-value {
        font-weight:900;
        min-width:32px;
        text-align:center;
      }

      .coupon-odd {
        font-weight:800;
      }

      .coupon-status {
        font-size:12px;
        font-weight:800;
        min-width:75px;
      }

      .coupon-status.won {
        color:#16833b;
      }

      .coupon-status.lost {
        color:#d62828;
      }

      .coupon-status.pending {
        color:#b77900;
      }

      .coupon-empty {
        text-align:center;
        padding:20px 10px;
        opacity:.7;
      }

      .coupon-date {
        margin-bottom:12px;
      }

      .coupon-date input {
        width:100%;
        box-sizing:border-box;
        padding:10px;
        border-radius:9px;
        border:1px solid rgba(127,127,127,.3);
        background:inherit;
        color:inherit;
      }

      @media(max-width:700px) {

        .coupon-match {
          align-items:flex-start;
        }

        .coupon-prediction {
          flex-direction:column;
          align-items:flex-end;
          gap:3px;
        }

        .coupon-market {
          font-size:11px;
        }

        .coupon-status {
          min-width:auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     TARİH SEÇİCİ
  ========================================================= */

  function ensureDatePicker() {

    const container =
      document.getElementById("idealCoupon") ||
      document.getElementById("ideal-kupon") ||
      document.querySelector("[data-tab='ideal-kupon']") ||
      document.querySelector(".ideal-kupon");

    if (!container) return null;

    let input = container.querySelector("#couponDate");

    if (!input) {

      const wrap = document.createElement("div");

      wrap.className = "coupon-date";

      wrap.innerHTML = `
        <input
          id="couponDate"
          type="date"
          aria-label="Kupon tarihi"
        >
      `;

      container.prepend(wrap);

      input = wrap.querySelector("#couponDate");

      input.addEventListener("change", function () {

        selectedDate = this.value;

        render(selectedDate);
      });
    }

    return {
      container,
      input
    };
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function render(date) {

    const token = ++renderToken;

    const ui = ensureDatePicker();

    if (!ui) return;

    const container = ui.container;
    const input = ui.input;

    selectedDate = date || selectedDate || todayISO();

    input.value = selectedDate;

    container.querySelector(".coupon-box")?.remove();

    const loading = document.createElement("div");

    loading.className = "coupon-box";

    loading.innerHTML = `
      <div class="coupon-empty">
        Kupon hazırlanıyor...
      </div>
    `;

    container.appendChild(loading);

    /*
      Ana thread'i bloklamıyoruz.
    */

    setTimeout(() => {

      if (token !== renderToken) return;

      const coupon = buildCoupon(selectedDate);

      if (token !== renderToken) return;

      const status = couponStatus(coupon);

      loading.innerHTML = `
        <div class="coupon-header">

          <div class="coupon-title">
            🎯 İdeal Kupon
          </div>

          <div class="coupon-total">
            ${coupon.items.length
              ? `Toplam: ${coupon.totalOdd.toFixed(2)}`
              : ""}
          </div>

        </div>

        <div class="coupon-subtitle">
          ${dateText(selectedDate)}
          ${
            status === "won"
              ? " · ✓ Kupon Kazandı"
              : status === "lost"
                ? " · ✕ Kupon Kaybetti"
                : status === "pending"
                  ? " · • Bekliyor"
                  : ""
          }
        </div>

        ${
          coupon.items.length
            ? coupon.items.map(renderItem).join("")
            : `
              <div class="coupon-empty">
                Bu tarih için uygun tahmin bulunamadı.
              </div>
            `
        }
      `;

    }, 0);
  }

  /* =========================================================
     VERİ HAZIRLA
  ========================================================= */

  function loadData() {

    const sources = [
      window.ORAN_DATA,
      window.MATCHES_DATA,
      window.MACKOLIK_DATA,
      window.MATCH_DATA
    ];

    let source = null;

    for (const item of sources) {

      if (Array.isArray(item) && item.length) {
        source = item;
        break;
      }
    }

    if (!source) {
      DATA = [];
      return false;
    }

    DATA = source;

    buildDateIndex();

    HISTORY_CACHE.clear();
    STATS_CACHE.clear();
    CANDIDATE_CACHE.clear();

    return true;
  }

  /* =========================================================
     SKOR GÜNCELLEMESİ
     BUGÜNÜN MAÇLARI VERİSİ DEĞİŞİNCE
  ========================================================= */

  function refreshScoresOnly() {

    /*
      ORAN_DATA aynı array içinde güncelleniyorsa
      tekrar veri çekmiyoruz.

      Sadece istatistik/kup cachesini temizliyoruz.
    */

    HISTORY_CACHE.clear();
    STATS_CACHE.clear();
    CANDIDATE_CACHE.clear();

    if (selectedDate) {
      render(selectedDate);
    }
  }

  /* =========================================================
     BAŞLAT
  ========================================================= */

  function init() {

    injectCSS();

    if (!loadData()) {
      return;
    }

    const dates = availableDates();

    if (!dates.length) {
      return;
    }

    const picker = ensureDatePicker();

    if (!picker) {
      return;
    }

    const today = todayISO();

    if (DATE_INDEX.has(today)) {
      selectedDate = today;
    } else {
      selectedDate = dates[dates.length - 1];
    }

    picker.input.value = selectedDate;

    picker.input.min = dates[0];
    picker.input.max = dates[dates.length - 1];

    render(selectedDate);

    /*
      Bugünün Maçları veri güncellerse kupon da güncellensin.
    */

    [
      "oran-data-ready",
      "score-updated",
      "scores-updated",
      "matches-updated",
      "mackolik-data-updated",
      "oran-data-updated"
    ].forEach(eventName => {

      window.addEventListener(eventName, () => {

        loadData();

        refreshScoresOnly();

      });
    });
  }

  /* =========================================================
     GLOBAL ERİŞİM
  ========================================================= */

  window.oranAnalizCoupon = {
    init,
    render,
    refresh: refreshScoresOnly
  };

  /* =========================================================
     ÇALIŞTIR
  ========================================================= */

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", init);

  } else {

    init();

  }

})();
