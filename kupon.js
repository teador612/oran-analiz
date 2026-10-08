"use strict";

/* =========================================================
   ORAN ANALİZİ - OTOMATİK KUPON

   - 60 günlük geçmiş
   - Maksimum 5 maç
   - Toplam oran >= 2.00
   - Mackolik canlı skor
   - Başlamamış maçta 0-0 göstermez
   - Kazandı / Kaybetti / Bekliyor
   - Canlı skor 30 saniyede yenilenir
   - Tarih değişiminde canlı skor kaybolmaz
========================================================= */

(function () {

  "use strict";

  /* =========================================================
     AYARLAR
  ========================================================= */

  const HISTORY_DAYS = 60;
  const MIN_TOTAL_ODDS = 2.00;
  const MAX_MATCHES = 5;
  const CACHE_LIMIT = 40;

  const LIVE_JSON_URL =
    "https://teador612.github.io/mackolik1/data/matches.json";

  const LIVE_REFRESH_MS = 30000;


  /* =========================================================
     STATE
  ========================================================= */

  const state = {

    byDate: new Map(),

    historyByDate: new Map(),

    statsByDate: new Map(),

    candidatesByDate: new Map(),

    renderedDate: "",

    liveScores: [],

    liveById: new Map(),

    liveLastUpdate: 0,

    currentCouponRows: new Map(),

    currentCoupons: [],

    renderToken: 0,

    liveRequestId: 0

  };


  /* =========================================================
     SONUÇLAR
  ========================================================= */

  const RESULT_KEYS = {

    ms1: "1",
    ms0: "X",
    ms2: "2",

    kgVar: "VAR",
    kgYok: "YOK",

    over25: "ÜST",
    under25: "ALT",

    iy1: "1",
    iy0: "X",
    iy2: "2",

    iyOver05: "ÜST",
    iyUnder05: "ALT",

    iyOver15: "ÜST",
    iyUnder15: "ALT",

    msOver15: "ÜST",
    msUnder15: "ALT",

    msOver25: "ÜST",
    msUnder25: "ALT",

    msOver35: "ÜST",
    msUnder35: "ALT",

    evGoal: "VAR",
    depGoal: "VAR"

  };


  /* =========================================================
     MARKETLER
  ========================================================= */

  const MARKET_FALLBACK = [

    ["ms1", "MS1"],
    ["ms0", "MS0 / Beraberlik"],
    ["ms2", "MS2"],

    ["kgVar", "KG Var"],
    ["kgYok", "KG Yok"],

    ["over25", "MS 2,5 Üst"],
    ["under25", "MS 2,5 Alt"],

    ["iy1", "İY1"],
    ["iy0", "İY0"],
    ["iy2", "İY2"],

    ["iyOver05", "İY 0,5 Üst"],
    ["iyUnder05", "İY 0,5 Alt"],

    ["iyOver15", "İY 1,5 Üst"],
    ["iyUnder15", "İY 1,5 Alt"],

    ["msOver15", "MS 1,5 Üst"],
    ["msUnder15", "MS 1,5 Alt"],

    ["msOver25", "MS 2,5 Üst"],
    ["msUnder25", "MS 2,5 Alt"],

    ["msOver35", "MS 3,5 Üst"],
    ["msUnder35", "MS 3,5 Alt"],

    ["evGoal", "Ev gol atar"],
    ["depGoal", "Deplasman gol atar"]

  ];


  /* =========================================================
     ELEMENT
  ========================================================= */

  function el(id) {
    return document.getElementById(id);
  }


  /* =========================================================
     ESCAPE
  ========================================================= */

  function escape(value) {

    if (typeof window.esc === "function") {
      return window.esc(value);
    }

    return String(value ?? "").replace(
      /[&<>\"']/g,
      function (c) {

        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#39;"
        }[c];

      }
    );

  }


  /* =========================================================
     SAYI
  ========================================================= */

  function number(value) {

    const n = Number(
      String(value ?? "")
        .trim()
        .replace(",", ".")
    );

    return Number.isFinite(n)
      ? n
      : null;

  }


  /* =========================================================
     TARİH
  ========================================================= */

  function dateKey(value) {

    const text =
      String(value ?? "").trim();

    if (!text) {
      return "";
    }

    let m = text.match(
      /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
    );

    if (m) {

      return (
        `${m[1]}-` +
        `${String(m[2]).padStart(2, "0")}-` +
        `${String(m[3]).padStart(2, "0")}`
      );

    }

    m = text.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    );

    if (m) {

      return (
        `${m[3]}-` +
        `${String(m[2]).padStart(2, "0")}-` +
        `${String(m[1]).padStart(2, "0")}`
      );

    }

    const d = new Date(text);

    if (Number.isNaN(d.getTime())) {
      return "";
    }

    return (
      `${d.getFullYear()}-` +
      `${String(d.getMonth() + 1).padStart(2, "0")}-` +
      `${String(d.getDate()).padStart(2, "0")}`
    );

  }


  /* =========================================================
     GÜN EKLE
  ========================================================= */

  function addDays(key, amount) {

    const d =
      new Date(`${key}T00:00:00`);

    d.setDate(
      d.getDate() + amount
    );

    return (
      `${d.getFullYear()}-` +
      `${String(d.getMonth() + 1).padStart(2, "0")}-` +
      `${String(d.getDate()).padStart(2, "0")}`
    );

  }


  /* =========================================================
     ORAN
  ========================================================= */

  function getOdd(row, market) {

    const direct =
      number(
        row?.odds?.[market.key]
      );

    if (direct !== null) {
      return direct;
    }

    const containers = [

      row?.openingOdds,
      row?.opening_odds,
      row?.opening,
      row?.odds,
      row?.Odds

    ];

    for (const container of containers) {

      const n =
        number(
          container?.[market.key]
        );

      if (n !== null) {
        return n;
      }

    }

    return null;

  }


  /* =========================================================
     MARKETLER
  ========================================================= */

  function getMarkets() {

    const source =
      Array.isArray(window.ORAN_MARKETS) &&
      window.ORAN_MARKETS.length

        ? window.ORAN_MARKETS.map(
            x => [
              x.key,
              x.label
            ]
          )

        : MARKET_FALLBACK;

    return source
      .filter(
        ([key]) =>
          Object.prototype.hasOwnProperty.call(
            RESULT_KEYS,
            key
          )
      )
      .map(
        ([key, label]) => ({

          key,
          label,
          result: RESULT_KEYS[key]

        })
      );

  }


  /* =========================================================
     SKOR PARSE
  ========================================================= */

  function parseScore(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (typeof value === "object") {

      const home =
        number(
          value.home ??
          value.homeScore ??
          value.homeTeam ??
          value.h
        );

      const away =
        number(
          value.away ??
          value.awayScore ??
          value.awayTeam ??
          value.a
        );

      if (
        home !== null &&
        away !== null
      ) {

        return {
          home,
          away
        };

      }

      return null;

    }

    const match =
      String(value)
        .trim()
        .match(
          /(\d+)\s*[-:]\s*(\d+)/
        );

    if (!match) {
      return null;
    }

    return {
      home: Number(match[1]),
      away: Number(match[2])
    };

  }


  /* =========================================================
     TAKIM TEMİZLE
  ========================================================= */

  function cleanTeamName(name) {

    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /fc|sc|cd|fk|sk|club|sporting|atletico|deportivo/g,
        ""
      )
      .replace(
        /[^a-z0-9ğüşıöç]/g,
        ""
      )
      .trim();

  }


  /* =========================================================
     TAKIM EŞLEŞTİR
  ========================================================= */

  function teamMatch(a, b) {

    const x =
      cleanTeamName(a);

    const y =
      cleanTeamName(b);

    if (!x || !y) {
      return false;
    }

    if (x === y) {
      return true;
    }

    if (
      x.length >= 4 &&
      y.length >= 4
    ) {

      return (
        x.includes(y) ||
        y.includes(x)
      );

    }

    return false;

  }


  /* =========================================================
     MAÇ ID
  ========================================================= */

  function matchId(row) {

    return String(

      row?.id ??
      row?.matchId ??
      row?.mackolikId ??
      row?.code ??
      `${row?.home ?? ""}|` +
      `${row?.away ?? ""}|` +
      `${dateKey(row?.date)}|` +
      `${row?.time ?? ""}`

    );

  }


  /* =========================================================
     CANLI MAÇ NORMALİZE
  ========================================================= */

  function normalizeLiveMatch(m) {

    if (!m) {
      return null;
    }

    const id =
      String(
        m.id ??
        m.matchId ??
        m.code ??
        m.mackolikId ??
        ""
      );

    const home =
      m.home ??
      m.homeTeam ??
      m.homeName ??
      "";

    const away =
      m.away ??
      m.awayTeam ??
      m.awayName ??
      "";

    const ft =
      parseScore(m.score) ||
      parseScore(m.scoreFT) ||
      parseScore(m.fullTimeScore);

    const ht =
      parseScore(m.scoreHT) ||
      parseScore(m.halfTimeScore) ||
      parseScore(m.score?.halfTime) ||
      parseScore(m.score?.ht);

    const status =
      String(
        m.status ??
        m.matchStatus ??
        ""
      )
        .trim()
        .toLowerCase();

    if (!home && !away && !id) {
      return null;
    }

    return {

      id,

      home: String(home),

      away: String(away),

      date: dateKey(m.date),

      time: String(m.time ?? ""),

      status,

      ft,

      ht

    };

  }


  /* =========================================================
     CANLI SKOR ÇEK
     
     ÖNEMLİ:
     - Önceki canlı veri silinmez.
     - Yeni veri başarılı gelirse değiştirilir.
     - Tarih değişimi bunu etkilemez.
  ========================================================= */

  async function fetchLiveScores() {

    const requestId =
      ++state.liveRequestId;

    try {

      const response =
        await fetch(
          LIVE_JSON_URL +
          "?_=" +
          Date.now(),
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          "HTTP " +
          response.status
        );
      }

      const data =
        await response.json();

      const matches =
        Array.isArray(data?.matches)
          ? data.matches
          : [];

      const normalized =
        matches
          .map(normalizeLiveMatch)
          .filter(Boolean);

      /*
         Eski istek sonradan dönerse
         yeni verinin üzerine yazmasın.
      */

      if (
        requestId !==
        state.liveRequestId
      ) {
        return;
      }

      /*
         Boş cevap geldiyse
         mevcut canlı veriyi silme.
      */

      if (!normalized.length) {
        return;
      }

      state.liveScores =
        normalized;

      state.liveById =
        new Map();

      normalized.forEach(
        function (match) {

          if (match.id) {

            state.liveById.set(
              match.id,
              match
            );

          }

        }
      );

      state.liveLastUpdate =
        Date.now();

      /*
         Kupon yeniden oluşturulmaz.
         Sadece skorlar güncellenir.
      */

      updateCouponLiveUI();

      window.ORAN_LIVE_SCORES =
        normalized.map(
          function (m) {

            return {

              home: m.home,

              away: m.away,

              score:
                m.ft
                  ? `${m.ft.home} - ${m.ft.away}`
                  : "",

              homeScore:
                m.ft?.home ?? null,

              awayScore:
                m.ft?.away ?? null,

              code: m.id,

              status: m.status

            };

          }
        );

      window.dispatchEvent(
        new CustomEvent(
          "oran-live-scores-updated"
        )
      );

    } catch (error) {

      /*
         Hata durumunda eski canlı skor
         aynen korunur.
      */

      console.log(
        "Mackolik canlı skor hatası:",
        error
      );

    }

  }


  /* =========================================================
     CANLI MAÇ BUL
     
     ÖNEMLİ:
     Geçmiş maçlarda yanlış canlı skor
     eşleşmesini engelliyoruz.
  ========================================================= */

  function findLiveScore(row) {

    if (!row) {
      return null;
    }

    const possibleIds = [

      row?.id,
      row?.matchId,
      row?.mackolikId,
      row?.code

    ]
      .filter(
        x =>
          x !== null &&
          x !== undefined &&
          String(x) !== ""
      )
      .map(
        x => String(x)
      );

    /*
       1. Önce ID
    */

    for (const id of possibleIds) {

      const exact =
        state.liveById.get(id);

      if (exact) {
        return exact;
      }

    }

    /*
       2. Takım + tarih
    */

    const targetDate =
      dateKey(row?.date);

    /*
       Tarih yoksa takım adına göre
       canlı eşleştirme yapmıyoruz.
    */

    if (!targetDate) {
      return null;
    }

    const byTeams =
      state.liveScores.find(
        function (live) {

          /*
             Canlı kaydın tarihi varsa
             kesinlikle aynı gün olmalı.
          */

          if (
            live.date &&
            targetDate !== live.date
          ) {
            return false;
          }

          /*
             Canlı kaydın tarihi yoksa
             sadece BUGÜN için takım eşleşmesine
             izin ver.
          */

          if (!live.date) {

            const today =
              new Date();

            const todayKey =
              `${today.getFullYear()}-` +
              `${String(
                today.getMonth() + 1
              ).padStart(2, "0")}-` +
              `${String(
                today.getDate()
              ).padStart(2, "0")}`;

            if (
              targetDate !== todayKey
            ) {
              return false;
            }

          }

          return (
            teamMatch(
              row.home,
              live.home
            ) &&
            teamMatch(
              row.away,
              live.away
            )
          );

        }
      );

    return byTeams || null;

  }


  /* =========================================================
     DURUM
  ========================================================= */

  function normalizeStatus(status) {

    const s =
      String(status || "")
        .trim()
        .toLowerCase();

    if (
      [
        "finished",
        "finished_final",
        "ft",
        "ended",
        "completed",
        "final"
      ].includes(s)
    ) {
      return "finished";
    }

    if (
      [
        "live",
        "playing",
        "inplay",
        "in-play",
        "1h",
        "2h",
        "ht"
      ].includes(s)
    ) {
      return "live";
    }

    if (
      [
        "not_started",
        "not-started",
        "scheduled",
        "upcoming",
        "pre-match",
        "prematch"
      ].includes(s)
    ) {
      return "not_started";
    }

    return "";

  }


  /* =========================================================
     MAÇ DURUMU
  ========================================================= */

  function matchStatus(row) {

    const live =
      findLiveScore(row);

    if (live) {

      const liveStatus =
        normalizeStatus(
          live.status
        );

      if (liveStatus) {
        return liveStatus;
      }

    }

    const status =
      normalizeStatus(
        row?.status ??
        row?.matchStatus ??
        row?.state ??
        ""
      );

    if (status) {
      return status;
    }

    if (row?.played === true) {
      return "finished";
    }

    if (row?.played === false) {
      return "not_started";
    }

    return "";

  }


  /* =========================================================
     FULL TIME SKOR
  ========================================================= */

  function getFTScore(row) {

    const live =
      findLiveScore(row);

    if (live) {

      const status =
        normalizeStatus(
          live.status
        );

      /*
         Başlamamış maçta canlı JSON'daki
         0-0 kullanılmaz.
      */

      if (
        status !== "not_started"
      ) {

        if (live.ft) {
          return live.ft;
        }

      }

    }

    /*
       ORAN DATA
    */

    const candidates = [

      row?.scoreFT,
      row?.fullTimeScore,
      row?.ftScore,
      row?.score?.fullTime,
      row?.score?.ft,
      row?.score

    ];

    for (const value of candidates) {

      const score =
        parseScore(value);

      if (score) {
        return score;
      }

    }

    return null;

  }


  /* =========================================================
     İLK YARI SKOR
  ========================================================= */

  function getHTScore(row) {

    const live =
      findLiveScore(row);

    if (live) {

      const status =
        normalizeStatus(
          live.status
        );

      if (
        status !== "not_started"
      ) {

        if (live.ht) {
          return live.ht;
        }

      }

    }

    const candidates = [

      row?.scoreHT,
      row?.halfTimeScore,
      row?.htScore,
      row?.score?.halfTime,
      row?.score?.ht,
      row?.halfTime

    ];

    for (const value of candidates) {

      const score =
        parseScore(value);

      if (score) {
        return score;
      }

    }

    return null;

  }


  /* =========================================================
     OYNANMIŞ MI?
  ========================================================= */

  function played(row) {

    const status =
      matchStatus(row);

    if (
      status === "live" ||
      status === "not_started"
    ) {
      return false;
    }

    if (status === "finished") {
      return true;
    }

    return Boolean(
      getFTScore(row)
    );

  }


  /* =========================================================
     SONUÇ
  ========================================================= */

  function result(row, key) {

    if (
      row?.results &&
      row.results[key]
    ) {
      return row.results[key];
    }

    const ht =
      getHTScore(row);

    const ft =
      getFTScore(row);

    const needsHT =

      key === "iy1" ||
      key === "iy0" ||
      key === "iy2" ||
      key === "iyOver05" ||
      key === "iyUnder05" ||
      key === "iyOver15" ||
      key === "iyUnder15";

    if (needsHT && !ht) {
      return "";
    }

    if (!needsHT && !ft) {
      return "";
    }

    const h =
      ht?.home ?? 0;

    const a =
      ht?.away ?? 0;

    const x =
      ft?.home ?? 0;

    const y =
      ft?.away ?? 0;

    const firstHalfTotal =
      h + a;

    const total =
      x + y;


    if (
      key === "ms1" ||
      key === "ms0" ||
      key === "ms2"
    ) {

      if (x > y) return "1";
      if (x === y) return "X";

      return "2";

    }


    if (
      key === "iy1" ||
      key === "iy0" ||
      key === "iy2"
    ) {

      if (h > a) return "1";
      if (h === a) return "X";

      return "2";

    }


    if (
      key === "kgVar" ||
      key === "kgYok"
    ) {

      return (
        x > 0 &&
        y > 0
      )
        ? "VAR"
        : "YOK";

    }


    if (key === "iyOver05") {

      return firstHalfTotal > 0.5
        ? "ÜST"
        : "ALT";

    }


    if (key === "iyUnder05") {

      return firstHalfTotal <= 0.5
        ? "ALT"
        : "ÜST";

    }


    if (key === "iyOver15") {

      return firstHalfTotal > 1.5
        ? "ÜST"
        : "ALT";

    }


    if (key === "iyUnder15") {

      return firstHalfTotal <= 1.5
        ? "ALT"
        : "ÜST";

    }


    if (key === "msOver15") {

      return total > 1.5
        ? "ÜST"
        : "ALT";

    }


    if (key === "msUnder15") {

      return total <= 1.5
        ? "ALT"
        : "ÜST";

    }


    if (
      key === "over25" ||
      key === "msOver25"
    ) {

      return total > 2.5
        ? "ÜST"
        : "ALT";

    }


    if (
      key === "under25" ||
      key === "msUnder25"
    ) {

      return total <= 2.5
        ? "ALT"
        : "ÜST";

    }


    if (key === "msOver35") {

      return total > 3.5
        ? "ÜST"
        : "ALT";

    }


    if (key === "msUnder35") {

      return total <= 3.5
        ? "ALT"
        : "ÜST";

    }


    if (key === "evGoal") {

      return x > 0
        ? "VAR"
        : "YOK";

    }


    if (key === "depGoal") {

      return y > 0
        ? "VAR"
        : "YOK";

    }

    return "";

  }


  /* =========================================================
     SKOR HTML
  ========================================================= */

  function scoreText(row) {

    const status =
      matchStatus(row);

    /*
       BAŞLAMAMIŞ MAÇ:
       HİÇBİR ŞEKİLDE SKOR GÖSTERME.
    */

    if (
      status === "not_started"
    ) {
      return "";
    }

    const live =
      findLiveScore(row);

    /*
       CANLI MACKOLIK
    */

    if (
      live &&
      live.ft &&
      (
        status === "live" ||
        status === "finished"
      )
    ) {

      if (status === "live") {

        if (live.ht) {

          return `
            <span class="coupon-score live-score">
              İY ${live.ht.home}-${live.ht.away}
              ·
              CANLI ${live.ft.home}-${live.ft.away}
            </span>
          `;

        }

        return `
          <span class="coupon-score live-score">
            CANLI ${live.ft.home}-${live.ft.away}
          </span>
        `;

      }

      if (live.ht) {

        return `
          <span class="coupon-score">
            İY ${live.ht.home}-${live.ht.away}
            ·
            MS ${live.ft.home}-${live.ft.away}
          </span>
        `;

      }

      return `
        <span class="coupon-score">
          MS ${live.ft.home}-${live.ft.away}
        </span>
      `;

    }

    /*
       GEÇMİŞ / ORAN DATA
    */

    const ft =
      getFTScore(row);

    const ht =
      getHTScore(row);

    if (!ft) {
      return "";
    }

    if (ht) {

      return `
        <span class="coupon-score">
          İY ${ht.home}-${ht.away}
          ·
          MS ${ft.home}-${ft.away}
        </span>
      `;

    }

    return `
      <span class="coupon-score">
        MS ${ft.home}-${ft.away}
      </span>
    `;

  }


  /* =========================================================
     MATCH KEY
  ========================================================= */

  function getMatchKey(row) {
    return matchId(row);
  }


  /* =========================================================
     CACHE TEMİZLE
  ========================================================= */

  function trimCache(map) {

    while (map.size > CACHE_LIMIT) {

      const first =
        map.keys().next().value;

      map.delete(first);

    }

  }


  /* =========================================================
     60 GÜNLÜK GEÇMİŞ
  ========================================================= */

  function getHistory(targetDate) {

    if (
      state.historyByDate.has(targetDate)
    ) {

      return state.historyByDate.get(
        targetDate
      );

    }

    const minDate =
      addDays(
        targetDate,
        -HISTORY_DAYS
      );

    const data =
      Array.isArray(window.ORAN_DATA)
        ? window.ORAN_DATA
        : [];

    const history = [];

    for (const row of data) {

      const d =
        dateKey(row?.date);

      if (!d) continue;

      if (d >= targetDate) continue;

      if (d < minDate) continue;

      if (!played(row)) continue;

      history.push(row);

    }

    state.historyByDate.set(
      targetDate,
      history
    );

    trimCache(
      state.historyByDate
    );

    return history;

  }


  /* =========================================================
     TARİH INDEX
  ========================================================= */

  function buildDateIndex() {

    state.byDate.clear();

    const data =
      Array.isArray(window.ORAN_DATA)
        ? window.ORAN_DATA
        : [];

    for (const row of data) {

      const key =
        dateKey(row?.date);

      if (!key) continue;

      if (!state.byDate.has(key)) {

        state.byDate.set(
          key,
          []
        );

      }

      state.byDate
        .get(key)
        .push(row);

    }

  }


  /* =========================================================
     İSTATİSTİK
  ========================================================= */

  function buildStats(targetDate) {

    if (
      state.statsByDate.has(targetDate)
    ) {

      return state.statsByDate.get(
        targetDate
      );

    }

    const history =
      getHistory(targetDate);

    const maps =
      new Map();

    for (const market of getMarkets()) {

      const oddsMap =
        new Map();

      for (const row of history) {

        const odd =
          getOdd(
            row,
            market
          );

        if (odd === null) {
          continue;
        }

        const key =
          odd.toFixed(2);

        let item =
          oddsMap.get(key);

        if (!item) {

          item = {
            odd,
            sample: 0,
            wins: 0
          };

          oddsMap.set(
            key,
            item
          );

        }

        const outcome =
          result(
            row,
            market.key
          );

        if (!outcome) {
          continue;
        }

        item.sample++;

        if (
          outcome ===
          market.result
        ) {
          item.wins++;
        }

      }

      maps.set(
        market.key,
        oddsMap
      );

    }

    state.statsByDate.set(
      targetDate,
      maps
    );

    trimCache(
      state.statsByDate
    );

    return maps;

  }


  /* =========================================================
     ADAYLAR
  ========================================================= */

  function candidates(targetDate) {

    if (
      state.candidatesByDate.has(targetDate)
    ) {

      return state.candidatesByDate.get(
        targetDate
      );

    }

    /*
       Index zaten güncel.
       Gereksiz yeniden oluşturma yok.
    */

    const rows =
      state.byDate.get(
        targetDate
      ) || [];

    const stats =
      buildStats(targetDate);

    const output = [];

    for (const row of rows) {

      if (played(row)) {
        continue;
      }

      const predictions = [];

      for (const market of getMarkets()) {

        const odd =
          getOdd(
            row,
            market
          );

        if (
          odd === null ||
          odd <= 1
        ) {
          continue;
        }

        const bucket =
          stats
            .get(market.key)
            ?.get(
              odd.toFixed(2)
            );

        const sample =
          bucket?.sample || 0;

        const wins =
          bucket?.wins || 0;

        const percentage =
          sample
            ? (
                wins /
                sample
              ) * 100
            : 0;

        predictions.push({

          market: market.key,

          name: market.label,

          result: market.result,

          odd,

          sample,

          wins,

          percentage

        });

      }

      if (!predictions.length) {
        continue;
      }

      predictions.sort(
        function (a, b) {

          return (
            b.percentage -
            a.percentage ||

            b.sample -
            a.sample ||

            b.odd -
            a.odd
          );

        }
      );

      output.push({

        row,

        predictions

      });

    }

    state.candidatesByDate.set(
      targetDate,
      output
    );

    trimCache(
      state.candidatesByDate
    );

    return output;

  }


  /* =========================================================
     PUAN
  ========================================================= */

  function score(prediction, type) {

    if (type === "safe") {

      return (
        prediction.percentage +
        Math.min(
          prediction.sample,
          30
        ) * 0.35 -
        prediction.odd * 0.02
      );

    }

    if (type === "medium") {

      return (
        prediction.percentage * 0.70 +
        Math.min(
          prediction.odd,
          3
        ) * 10 +
        Math.min(
          prediction.sample,
          20
        ) * 0.15
      );

    }

    return (
      prediction.odd * 12 +
      prediction.percentage * 0.35 +
      Math.min(
        prediction.sample,
        20
      ) * 0.1
    );

  }


  /* =========================================================
     KATEGORİ
  ========================================================= */

  function category(prediction, type) {

    if (type === "safe") {

      return (
        prediction.percentage >= 80
      );

    }

    if (type === "medium") {

      return (
        prediction.percentage >= 65 &&
        prediction.percentage < 80
      );

    }

    return (
      prediction.percentage < 65
    );

  }


  /* =========================================================
     EN İYİ TAHMİN
  ========================================================= */

  function bestForMatch(item, type) {

    const list =
      item.predictions.filter(
        function (prediction) {

          return category(
            prediction,
            type
          );

        }
      );

    if (!list.length) {
      return null;
    }

    list.sort(
      function (a, b) {

        return (
          score(b, type) -
          score(a, type)
        );

      }
    );

    return list[0];

  }


  /* =========================================================
     KUPON OLUŞTUR
  ========================================================= */

  function buildCoupon(
    items,
    type,
    blocked
  ) {

    const list = [];

    for (const item of items) {

      const id =
        getMatchKey(
          item.row
        );

      if (blocked.has(id)) {
        continue;
      }

      const prediction =
        bestForMatch(
          item,
          type
        );

      if (!prediction) {
        continue;
      }

      list.push({

        row: item.row,

        prediction

      });

    }

    if (!list.length) {
      return null;
    }

    list.sort(
      function (a, b) {

        return (
          score(
            b.prediction,
            type
          ) -
          score(
            a.prediction,
            type
          ) ||

          b.prediction.odd -
          a.prediction.odd
        );

      }
    );

    const selected = [];

    let total = 1;

    for (const item of list) {

      if (
        selected.length >=
        MAX_MATCHES
      ) {
        break;
      }

      selected.push(item);

      total *=
        item.prediction.odd;

      if (
        total >=
        MIN_TOTAL_ODDS
      ) {
        break;
      }

    }

    if (
      total <
      MIN_TOTAL_ODDS
    ) {
      return null;
    }

    return {

      type,

      matches: selected,

      totalOdds: total

    };

  }


  /* =========================================================
     KUPON DURUMU
  ========================================================= */

  function statusForCoupon(coupon) {

    let hasPending = false;

    let hasLost = false;

    for (const item of coupon.matches) {

      const status =
        matchStatus(item.row);

      if (status !== "finished") {

        hasPending = true;

        continue;

      }

      const actual =
        result(
          item.row,
          item.prediction.market
        );

      if (!actual) {

        hasPending = true;

        continue;

      }

      if (
        actual !==
        item.prediction.result
      ) {

        hasLost = true;

      }

    }

    if (hasLost) {

      return {

        className: "lost",
        text: "Kaybetti",
        icon: "🔴"

      };

    }

    if (hasPending) {

      return {

        className: "pending",
        text: "Bekliyor",
        icon: "🟡"

      };

    }

    return {

      className: "won",
      text: "Kazandı",
      icon: "🟢"

    };

  }


  /* =========================================================
     MAÇ HTML
  ========================================================= */

  function renderPrediction(item) {

    const prediction =
      item.prediction;

    const row =
      item.row;

    let stateClass =
      "pending";

    let icon =
      "•";

    const status =
      matchStatus(row);

    if (
      status === "finished"
    ) {

      const actual =
        result(
          row,
          prediction.market
        );

      if (
        actual &&
        actual ===
        prediction.result
      ) {

        stateClass = "won";
        icon = "✓";

      } else if (actual) {

        stateClass = "lost";
        icon = "✕";

      }

    }

    const id =
      getMatchKey(row);

    return `

      <div
        class="coupon-match"
        data-match-id="${escape(id)}"
      >

        <div class="match-info">

          <div class="match-teams">

            ${escape(
              row?.home || "-"
            )}

            -

            ${escape(
              row?.away || "-"
            )}

          </div>

          <div class="match-meta">

            ${escape(
              row?.time || ""
            )}

            ${
              row?.league
                ? ` · ${escape(row.league)}`
                : ""
            }

          </div>

          <div class="coupon-score-wrap">

            ${scoreText(row)}

          </div>

        </div>

        <div class="prediction">

          <span
            class="result-icon ${stateClass}"
          >
            ${icon}
          </span>

          <div>

            <div class="prediction-name">

              ${escape(
                prediction.name
              )}

            </div>

            <div class="prediction-odd">

              ${prediction.odd.toFixed(2)}

            </div>

            <div class="prediction-rate">

              ${
                prediction.sample
                  ? `%${prediction.percentage.toFixed(1)}
                     ·
                     ${prediction.wins}/${prediction.sample}`
                  : "Geçmiş eşleşme yok"
              }

            </div>

          </div>

        </div>

      </div>

    `;

  }


  /* =========================================================
     KUPON HTML
  ========================================================= */

  function renderCoupon(
    coupon,
    title,
    icon
  ) {

    const status =
      statusForCoupon(coupon);

    return `

      <div
        class="coupon-card ${status.className}"
        data-coupon-type="${escape(
          coupon.type
        )}"
      >

        <div class="coupon-header">

          <div>

            <div class="coupon-name">

              ${icon}
              ${title}

            </div>

            <div class="coupon-count">

              ${coupon.matches.length}
              maç

            </div>

          </div>

          <div class="coupon-status">

            ${status.icon}
            ${status.text}

          </div>

        </div>

        <div class="coupon-total">

          <b>

            Toplam oran:
            ${coupon.totalOdds.toFixed(2)}

          </b>

        </div>

        ${
          coupon.matches
            .map(renderPrediction)
            .join("")
        }

      </div>

    `;

  }


  /* =========================================================
     CANLI UI GÜNCELLE
  ========================================================= */

  function updateCouponLiveUI() {

    const output =
      el("couponResults");

    if (!output) {
      return;
    }

    if (
      !state.currentCoupons.length
    ) {
      return;
    }

    /*
       Maç skorları
    */

    const matchElements =
      output.querySelectorAll(
        ".coupon-match"
      );

    matchElements.forEach(
      function (element) {

        const id =
          element.getAttribute(
            "data-match-id"
          );

        if (!id) {
          return;
        }

        const item =
          state.currentCouponRows.get(
            id
          );

        if (!item) {
          return;
        }

        const row =
          item.row;

        const prediction =
          item.prediction;

        const scoreWrap =
          element.querySelector(
            ".coupon-score-wrap"
          );

        if (scoreWrap) {

          scoreWrap.innerHTML =
            scoreText(row);

        }

        const iconElement =
          element.querySelector(
            ".result-icon"
          );

        if (!iconElement) {
          return;
        }

        let className =
          "pending";

        let icon =
          "•";

        const status =
          matchStatus(row);

        if (
          status === "finished"
        ) {

          const actual =
            result(
              row,
              prediction.market
            );

          if (
            actual &&
            actual ===
            prediction.result
          ) {

            className = "won";
            icon = "✓";

          } else if (actual) {

            className = "lost";
            icon = "✕";

          }

        }

        iconElement.className =
          "result-icon " +
          className;

        iconElement.textContent =
          icon;

      }
    );


    /*
       Kupon başlıkları
    */

    state.currentCoupons.forEach(
      function (coupon) {

        const cards =
          output.querySelectorAll(
            ".coupon-card"
          );

        cards.forEach(
          function (card) {

            if (
              card.getAttribute(
                "data-coupon-type"
              ) !== coupon.type
            ) {
              return;
            }

            const status =
              statusForCoupon(coupon);

            card.classList.remove(
              "won",
              "lost",
              "pending"
            );

            card.classList.add(
              status.className
            );

            const statusElement =
              card.querySelector(
                ".coupon-status"
              );

            if (statusElement) {

              statusElement.textContent =
                `${status.icon} ${status.text}`;

            }

          }
        );

      }
    );

  }


  /* =========================================================
     RENDER
     
     Tarih değişimindeki eski render'ın
     yeni tarihi ezmesini engeller.
  ========================================================= */

  function render(date, force) {

    const output =
      el("couponResults");

    if (!output) {
      return;
    }

    /*
       Her render için benzersiz token.
    */

    const token =
      ++state.renderToken;

    if (!date) {

      state.renderedDate = "";

      state.currentCoupons = [];

      state.currentCouponRows =
        new Map();

      output.innerHTML = `

        <div class="card empty">

          Kupon tarihi seçin.

        </div>

      `;

      return;

    }

    if (
      !force &&
      state.renderedDate === date &&
      output.innerHTML
    ) {
      return;
    }

    state.renderedDate =
      date;

    state.currentCoupons = [];

    state.currentCouponRows =
      new Map();

    output.innerHTML = `

      <div class="loading-coupon">

        Kuponlar hazırlanıyor…

      </div>

    `;

    requestAnimationFrame(
      function () {

        /*
           Bu render artık geçersizse
           hiçbir şey yapma.
        */

        if (
          token !==
          state.renderToken
        ) {
          return;
        }

        /*
           Input değişmişse eski render'ı
           kesinlikle uygulama.
        */

        const currentDate =
          el("couponDate")?.value || "";

        if (
          currentDate !== date
        ) {
          return;
        }

        const items =
          candidates(date);

        /*
           Tekrar token kontrolü
        */

        if (
          token !==
          state.renderToken
        ) {
          return;
        }

        if (!items.length) {

          state.currentCoupons = [];

          state.currentCouponRows =
            new Map();

          output.innerHTML = `

            <div class="no-coupon">

              <div class="no-coupon-title">

                Bu tarih için kupon oluşturulamadı.

              </div>

              <div class="muted">

                Tahmin üretilebilecek
                maç bulunamadı.

              </div>

            </div>

          `;

          return;

        }

        const blocked =
          new Set();

        const types = [

          [
            "safe",
            "Güvenli",
            "🟢"
          ],

          [
            "medium",
            "Orta Güvenli",
            "🟡"
          ],

          [
            "risk",
            "Risk Alınabilir",
            "🔴"
          ]

        ];

        const coupons = [];

        const newCoupons = [];

        const newRows =
          new Map();

        for (
          const [
            type,
            name,
            icon
          ] of types
        ) {

          const coupon =
            buildCoupon(
              items,
              type,
              blocked
            );

          if (!coupon) {
            continue;
          }

          newCoupons.push(
            coupon
          );

          coupons.push(
            renderCoupon(
              coupon,
              name,
              icon
            )
          );

          coupon.matches.forEach(
            function (item) {

              const id =
                getMatchKey(
                  item.row
                );

              blocked.add(id);

              newRows.set(
                id,
                item
              );

            }
          );

        }

        /*
           Tarih bu sırada değiştiyse
           DOM'a hiçbir şey yazma.
        */

        if (
          token !==
          state.renderToken
        ) {
          return;
        }

        if (
          el("couponDate")?.value !== date
        ) {
          return;
        }

        state.currentCoupons =
          newCoupons;

        state.currentCouponRows =
          newRows;

        if (coupons.length) {

          output.innerHTML =
            coupons.join("");

          /*
             Mevcut canlı skorları
             hemen uygula.
          */

          updateCouponLiveUI();

        } else {

          state.currentCoupons = [];

          state.currentCouponRows =
            new Map();

          output.innerHTML = `

            <div class="no-coupon">

              <div class="no-coupon-title">

                2.00 ve üzeri kupon bulunamadı.

              </div>

              <div class="muted">

                Tek kupon şartı toplam
                oranın en az 2.00 olmasıdır.

              </div>

            </div>

          `;

        }

      }
    );

  }


  /* =========================================================
     SADECE SKOR YENİLE
  ========================================================= */

  function refreshCurrentCoupon() {

    const dateInput =
      el("couponDate");

    if (
      !dateInput?.value
    ) {
      return;
    }

    /*
       Burada render YOK.
       Kupon seçimi korunur.
    */

    updateCouponLiveUI();

  }


  /* =========================================================
     EVENTLER
  ========================================================= */

  [
    "score-updated",
    "scores-updated",
    "mackolik-data-updated",
    "matches-updated",
    "oran-live-scores-updated"
  ].forEach(
    function (eventName) {

      window.addEventListener(
        eventName,
        refreshCurrentCoupon
      );

    }
  );


  /* =========================================================
     DATA HAZIR
  ========================================================= */

  window.addEventListener(
    "oran-data-ready",
    function () {

      buildDateIndex();

      state.historyByDate.clear();

      state.statsByDate.clear();

      state.candidatesByDate.clear();

      /*
         Canlı skor state'ine dokunmuyoruz.
      */

      const dateInput =
        el("couponDate");

      if (
        dateInput?.value &&
        state.byDate.has(
          dateInput.value
        )
      ) {

        render(
          dateInput.value,
          true
        );

      } else {

        setup();

      }

      fetchLiveScores();

    }
  );


  /* =========================================================
     SAYFA GÖRÜNÜR
  ========================================================= */

  document.addEventListener(
    "visibilitychange",
    function () {

      if (
        document.visibilityState ===
        "visible"
      ) {

        fetchLiveScores();

      }

    }
  );


  /* =========================================================
     TARİH / SETUP
  ========================================================= */

  function setup() {

    const dateInput =
      el("couponDate");

    if (!dateInput) {
      return;
    }

    buildDateIndex();

    const dates =
      [...state.byDate.keys()]
        .sort();

    if (!dates.length) {

      dateInput.value = "";

      state.renderedDate = "";

      render("");

      return;

    }

    dateInput.min =
      dates[0];

    dateInput.max =
      dates[dates.length - 1];


    /*
       Bugünün tarihi
    */

    const today =
      new Date();

    const todayKey =
      `${today.getFullYear()}-` +
      `${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-` +
      `${String(
        today.getDate()
      ).padStart(2, "0")}`;


    /*
       Mevcut değer uygunsa onu koru.
       Böylece setup tekrar çağrıldığında
       kullanıcı seçtiği tarihten atılmaz.
    */

    const currentValue =
      dateInput.value;

    if (
      currentValue &&
      state.byDate.has(currentValue)
    ) {

      dateInput.value =
        currentValue;

    } else {

      dateInput.value =
        state.byDate.has(todayKey)
          ? todayKey
          : dates[dates.length - 1];

    }


    /*
       onchange sadece BİR KEZ atanır.
    */

    if (
      dateInput.dataset.couponBound !== "1"
    ) {

      dateInput.dataset.couponBound =
        "1";

      dateInput.addEventListener(
        "change",
        function () {

          const selectedDate =
            dateInput.value;

          if (!selectedDate) {
            return;
          }

          /*
             Eski render'ı iptal et.
          */

          state.renderToken++;

          /*
             SADECE seçilen tarihe ait
             analiz cache'lerini temizle.
             
             Canlı skor cache'ine dokunma.
          */

          state.historyByDate.delete(
            selectedDate
          );

          state.statsByDate.delete(
            selectedDate
          );

          state.candidatesByDate.delete(
            selectedDate
          );

          /*
             Eski kupon state'ini temizle.
          */

          state.currentCoupons = [];

          state.currentCouponRows =
            new Map();

          state.renderedDate = "";

          /*
             Tarih değişince kuponu hemen
             yeniden oluştur.
          */

          render(
            selectedDate,
            true
          );

          /*
             Burada ÖNEMLİ:
             fetchLiveScores BEKLENMİYOR.
             
             Canlı skor zaten state'te varsa
             yeni kuponda hemen kullanılır.
             
             Arkadan güncel veri gelir.
          */

          fetchLiveScores();

        }
      );

    }


    /*
       İlk render
    */

    render(
      dateInput.value,
      true
    );

    /*
       Canlı skor ayrıca yüklenir.
       Render'ı bekletmez.
    */

    fetchLiveScores();

  }


  /* =========================================================
     CANLI SKOR TIMER
  ========================================================= */

  let liveTimer = null;

  function startLiveTimer() {

    if (liveTimer) {

      clearInterval(
        liveTimer
      );

    }

    liveTimer =
      setInterval(
        function () {

          fetchLiveScores();

        },
        LIVE_REFRESH_MS
      );

  }


  /* =========================================================
     CSS
  ========================================================= */

  function addStyles() {

    if (
      document.getElementById(
        "fast-coupon-css"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "fast-coupon-css";

    style.textContent = `

      .coupon-card {

        margin: 14px 0;
        padding: 15px;
        border-radius: 16px;
        border: 1px solid #26354c;
        background: #0d1422;
        overflow: hidden;

      }

      .coupon-card.won {
        border-color: #258b58;
      }

      .coupon-card.lost {
        border-color: #a83d3d;
      }

      .coupon-card.pending {
        border-color: #9b7724;
      }

      .coupon-header {

        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;

      }

      .coupon-name {

        font-size: 18px;
        font-weight: 900;

      }

      .coupon-count {

        font-size: 12px;
        color: #8d99ad;
        margin-top: 3px;

      }

      .coupon-status {

        font-weight: 900;
        white-space: nowrap;

      }

      .coupon-card.won .coupon-status {
        color: #35d17a;
      }

      .coupon-card.lost .coupon-status {
        color: #ff5757;
      }

      .coupon-card.pending .coupon-status {
        color: #e4aa36;
      }

      .coupon-total {

        padding: 10px;
        border-radius: 10px;
        background: #111b2d;
        margin-bottom: 4px;

      }

      .coupon-match {

        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid #1b2738;

      }

      .match-info {
        min-width: 0;
      }

      .match-teams {

        font-weight: 700;
        line-height: 1.35;

      }

      .match-meta {

        font-size: 12px;
        color: #8996aa;
        margin-top: 4px;

      }

      .coupon-score-wrap {

        margin-top: 6px;
        min-height: 22px;

      }

      .coupon-score {

        display: inline-block;
        padding: 3px 7px;
        border-radius: 6px;
        background: #18243a;
        color: #d9e3f5;
        font-size: 12px;
        font-weight: 800;

      }

      .coupon-score.live-score {

        background: #17283d;
        color: #00e6b8;
        border: 1px solid #31506f;

      }

      .prediction {

        display: flex;
        align-items: center;
        gap: 7px;
        text-align: right;
        flex-shrink: 0;

      }

      .prediction-name {
        font-weight: 800;
      }

      .prediction-odd {
        font-weight: 900;
      }

      .prediction-rate {

        font-size: 11px;
        color: #8996aa;
        margin-top: 2px;

      }

      .result-icon {

        width: 25px;
        height: 25px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-size: 18px;
        font-weight: 900;

      }

      .result-icon.won {
        color: #35d17a;
      }

      .result-icon.lost {
        color: #ff5757;
      }

      .result-icon.pending {
        color: #e4aa36;
      }

      .loading-coupon,
      .no-coupon {

        text-align: center;
        padding: 25px 15px;
        border-radius: 15px;
        background: #111b2d;
        margin-top: 14px;

      }

      .no-coupon-title {

        font-weight: 800;
        margin-bottom: 6px;

      }

      @media (max-width: 520px) {

        .coupon-match {
          align-items: flex-start;
        }

        .prediction {
          max-width: 45%;
        }

        .prediction-name {
          font-size: 12px;
        }

        .prediction-rate {
          font-size: 10px;
        }

        .prediction-odd {
          font-size: 14px;
        }

        .coupon-status {
          font-size: 13px;
        }

      }

    `;

    document.head.appendChild(
      style
    );

  }


  /* =========================================================
     INIT
  ========================================================= */

  function init() {

    addStyles();

    setup();

    startLiveTimer();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }


  /* =========================================================
     DIŞARIDAN ERİŞİM
  ========================================================= */

  window.oranAnalizCoupon = {

    render,

    setup,

    refresh:
      refreshCurrentCoupon,

    fetchLiveScores,

    state

  };

})();
