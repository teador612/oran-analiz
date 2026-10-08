"use strict";

/* =========================================================
   ORAN ANALİZİ - OTOMATİK KUPON

   SKOR KAYNAĞI
   ---------------------------------------------------------
   Yeni dosya yok.

   Maçkolik1 mevcut:
   https://teador612.github.io/mackolik1/data/matches.json

   dosyasındaki skorlar kullanılır.

   - Kupon oluştur butonu yok
   - Tarih seçildiğinde otomatik çalışır
   - 60 günlük geçmiş
   - Maksimum 5 maç
   - Toplam oran >= 2.00
   - Güvenli / Orta Güvenli / Risk Alınabilir
   - Maçkolik skorları otomatik eşleştirilir
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

  /*
     BUGÜNÜN MAÇLARI MENÜSÜNDE DE KULLANILAN
     AYNI SKOR KAYNAĞI
  */
  const LIVE_JSON_URL =
    "https://teador612.github.io/mackolik1/data/matches.json";

  /*
     Skorları belirli aralıklarla tekrar kontrol et.
     Yeni dosya oluşturmaz.
  */
  const SCORE_REFRESH_MS = 30000;

  const state = {
    byDate: new Map(),
    historyByDate: new Map(),
    statsByDate: new Map(),
    candidatesByDate: new Map(),

    /*
      Maçkolik skorları burada tutulur.
    */
    liveScores: [],

    /*
      Kod -> skor
    */
    scoreByCode: new Map(),

    /*
      takım -> skor listesi
    */
    scoreByTeams: [],

    scoresLoaded: false,
    scoreLoading: false,
    renderedDate: "",
    refreshTimer: null
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

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const n = Number(
      String(value)
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

    let m =
      text.match(
        /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
      );

    if (m) {

      return (
        `${m[1]}-` +
        `${String(m[2]).padStart(2, "0")}-` +
        `${String(m[3]).padStart(2, "0")}`
      );
    }

    m =
      text.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
      );

    if (m) {

      return (
        `${m[3]}-` +
        `${String(m[2]).padStart(2, "0")}-` +
        `${String(m[1]).padStart(2, "0")}`
      );
    }

    const d =
      new Date(text);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return "";
    }

    return (
      `${d.getFullYear()}-` +
      `${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-` +
      `${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }

  /* =========================================================
     BUGÜN
  ========================================================= */

  function todayKey() {

    const d =
      new Date();

    return (
      `${d.getFullYear()}-` +
      `${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-` +
      `${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }

  /* =========================================================
     TARİHE GÜN EKLE
  ========================================================= */

  function addDays(
    key,
    amount
  ) {

    const d =
      new Date(
        `${key}T00:00:00`
      );

    d.setDate(
      d.getDate() + amount
    );

    return (
      `${d.getFullYear()}-` +
      `${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-` +
      `${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }

  /* =========================================================
     TAKIM ADI NORMALİZE
  ========================================================= */

  function cleanTeamName(value) {

    return String(value ?? "")
      .toLocaleLowerCase("tr-TR")

      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )

      .replace(
        /ı/g,
        "i"
      )

      .replace(
        /ğ/g,
        "g"
      )

      .replace(
        /ü/g,
        "u"
      )

      .replace(
        /ş/g,
        "s"
      )

      .replace(
        /ö/g,
        "o"
      )

      .replace(
        /ç/g,
        "c"
      )

      .replace(
        /\b(fc|fk|sk|sc|sp|spor|club|cf|afc)\b/g,
        " "
      )

      .replace(
        /[^a-z0-9]/g,
        ""
      )

      .trim();
  }

  /* =========================================================
     TAKIMLAR EŞLEŞİYOR MU?
  ========================================================= */

  function teamsMatch(
    a,
    b
  ) {

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

      if (
        x.includes(y) ||
        y.includes(x)
      ) {
        return true;
      }
    }

    return false;
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

    /*
      {home: 2, away: 1}
    */
    if (
      typeof value === "object" &&
      !Array.isArray(value)
    ) {

      const home =
        number(
          value.home ??
          value.homeScore ??
          value.h
        );

      const away =
        number(
          value.away ??
          value.awayScore ??
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
    }

    /*
      [2,1]
    */
    if (
      Array.isArray(value) &&
      value.length >= 2
    ) {

      const home =
        number(value[0]);

      const away =
        number(value[1]);

      if (
        home !== null &&
        away !== null
      ) {

        return {
          home,
          away
        };
      }
    }

    /*
      "2 - 1"
      "2-1"
      "2:1"
    */
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
     MAÇKOLİK SKOR OBJEKTİ
  ========================================================= */

  function parseMackolikMatch(m) {

    if (!m) {
      return null;
    }

    const ft =
      parseScore(
        m.score
      );

    if (!ft) {
      return null;
    }

    const ht =
      parseScore(
        m.scoreHT ??
        m.halfTimeScore ??
        m.htScore ??
        m.ht ??
        m.halfTime
      );

    return {
      code:
        m.code ??
        m.id ??
        m.matchId ??
        "",

      home:
        m.home ??
        "",

      away:
        m.away ??
        "",

      date:
        dateKey(
          m.date ??
          m.matchDate
        ),

      time:
        m.time ??
        "",

      ft,
      ht,

      raw: m
    };
  }

  /* =========================================================
     MAÇKOLİK SKOR VERİSİNİ YÜKLE
  ========================================================= */

  async function loadMackolikScores() {

    if (
      state.scoreLoading
    ) {
      return false;
    }

    state.scoreLoading = true;

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
          "Maçkolik JSON yüklenemedi"
        );
      }

      const data =
        await response.json();

      const matches =
        Array.isArray(data?.matches)
          ? data.matches
          : [];

      const scores = [];

      for (
        const m of matches
      ) {

        const parsed =
          parseMackolikMatch(m);

        if (!parsed) {
          continue;
        }

        scores.push(
          parsed
        );
      }

      state.liveScores =
        scores;

      state.scoreByCode.clear();

      for (
        const s of scores
      ) {

        if (
          s.code !== null &&
          s.code !== undefined &&
          String(s.code).trim()
        ) {

          state.scoreByCode.set(
            String(s.code),
            s
          );
        }
      }

      state.scoreByTeams =
        scores;

      state.scoresLoaded =
        true;

      /*
        Skorlar geldi.
        Mevcut aday/cache sonuçlarını temizle.
      */

      state.candidatesByDate.clear();

      /*
        Bugünün kuponunu yeniden çiz.
      */

      const input =
        el("couponDate");

      if (
        input?.value
      ) {

        state.renderedDate =
          "";

        render(
          input.value,
          true
        );
      }

      return true;

    } catch (error) {

      console.warn(
        "Maçkolik skorları alınamadı:",
        error
      );

      return false;

    } finally {

      state.scoreLoading =
        false;
    }
  }

  /* =========================================================
     DIŞ SKORU MAÇLA EŞLEŞTİR
  ========================================================= */

  function findExternalScore(row) {

    if (!state.scoresLoaded) {
      return null;
    }

    /*
      1. CODE / ID
    */

    const possibleCodes = [

      row?.code,
      row?.id,
      row?.matchId,
      row?.mackolikId

    ];

    for (
      const code of possibleCodes
    ) {

      if (
        code === null ||
        code === undefined ||
        String(code).trim() === ""
      ) {
        continue;
      }

      const found =
        state.scoreByCode.get(
          String(code)
        );

      if (found) {
        return found;
      }
    }

    /*
      2. EV SAHİBİ + DEPLASMAN
    */

    const home =
      row?.home ??
      row?.homeTeam ??
      "";

    const away =
      row?.away ??
      row?.awayTeam ??
      "";

    if (
      !home ||
      !away
    ) {
      return null;
    }

    /*
      Önce tarih eşleşmesi olanları ara.
    */

    const rowDate =
      dateKey(row?.date);

    let found =
      state.scoreByTeams.find(
        s => {

          if (
            rowDate &&
            s.date &&
            rowDate !== s.date
          ) {
            return false;
          }

          return (
            teamsMatch(
              s.home,
              home
            ) &&
            teamsMatch(
              s.away,
              away
            )
          );
        }
      );

    if (found) {
      return found;
    }

    /*
      Tarih eşleşmesi yoksa
      sadece takım isimleri.
    */

    found =
      state.scoreByTeams.find(
        s =>
          teamsMatch(
            s.home,
            home
          ) &&
          teamsMatch(
            s.away,
            away
          )
      );

    return found || null;
  }

  /* =========================================================
     FULL TIME SKOR
  ========================================================= */

  function getFTScore(row) {

    /*
      1. ORAN_DATA içindeki skor
    */

    const localCandidates = [

      row?.scoreFT,

      row?.fullTimeScore,

      row?.ftScore,

      row?.score?.fullTime,

      row?.score?.ft,

      /*
        score doğrudan obje ise
      */
      row?.score

    ];

    for (
      const value of localCandidates
    ) {

      const score =
        parseScore(value);

      if (score) {
        return score;
      }
    }

    /*
      2. MAÇKOLİK JSON
    */

    const external =
      findExternalScore(row);

    if (
      external?.ft
    ) {

      return external.ft;
    }

    return null;
  }

  /* =========================================================
     İLK YARI SKOR
  ========================================================= */

  function getHTScore(row) {

    const localCandidates = [

      row?.scoreHT,

      row?.halfTimeScore,

      row?.htScore,

      row?.score?.halfTime,

      row?.score?.ht,

      row?.halfTime

    ];

    for (
      const value of localCandidates
    ) {

      const score =
        parseScore(value);

      if (score) {
        return score;
      }
    }

    const external =
      findExternalScore(row);

    if (
      external?.ht
    ) {

      return external.ht;
    }

    return null;
  }

  /* =========================================================
     SKOR VAR MI?
  ========================================================= */

  function hasScore(row) {

    return Boolean(
      getFTScore(row)
    );
  }

  /* =========================================================
     MAÇ DURUMU
  ========================================================= */

  function matchStatus(row) {

    const status =
      String(
        row?.status ??
        row?.matchStatus ??
        row?.state ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      [
        "finished",
        "finished_final",
        "ft",
        "ended",
        "completed",
        "final",
        "finished-final"
      ].includes(status)
    ) {

      return "finished";
    }

    if (
      [
        "live",
        "playing",
        "inplay",
        "in-play",
        "ongoing"
      ].includes(status)
    ) {

      return "live";
    }

    if (
      [
        "not_started",
        "not-started",
        "scheduled",
        "upcoming",
        "pending"
      ].includes(status)
    ) {

      return "not_started";
    }

    /*
      Açıkça oynanmış deniyorsa.
    */

    if (
      row?.played === true
    ) {

      return "finished";
    }

    /*
      Açıkça oynanmamış deniyorsa.
    */

    if (
      row?.played === false
    ) {

      /*
        Ama Maçkolik'te skor varsa
        skor önceliklidir.
      */

      if (
        hasScore(row)
      ) {

        return "finished";
      }

      return "not_started";
    }

    /*
      Skor varsa oynanmış kabul edilir.
    */

    if (
      hasScore(row)
    ) {

      return "finished";
    }

    return "";
  }

  /* =========================================================
     OYNANMIŞ MI?
  ========================================================= */

  function played(row) {

    const status =
      matchStatus(row);

    if (
      status === "finished"
    ) {

      return true;
    }

    if (
      status === "live"
    ) {

      return false;
    }

    if (
      status === "not_started"
    ) {

      return false;
    }

    return hasScore(row);
  }

  /* =========================================================
     SONUÇ HESAPLA
  ========================================================= */

  function result(
    row,
    key
  ) {

    /*
      Hazır sonuç varsa kullan.
    */

    if (
      row?.results &&
      row.results[key] !== undefined &&
      row.results[key] !== null &&
      row.results[key] !== ""
    ) {

      return String(
        row.results[key]
      );
    }

    const ft =
      getFTScore(row);

    const ht =
      getHTScore(row);

    /*
      İY marketleri için HT zorunlu.
    */

    const needsHT =
      key === "iy1" ||
      key === "iy0" ||
      key === "iy2" ||
      key === "iyOver05" ||
      key === "iyUnder05" ||
      key === "iyOver15" ||
      key === "iyUnder15";

    if (
      needsHT &&
      !ht
    ) {

      return "";
    }

    /*
      MS marketleri için FT zorunlu.
    */

    if (
      !needsHT &&
      !ft
    ) {

      return "";
    }

    const fh =
      ht?.home ?? 0;

    const fa =
      ht?.away ?? 0;

    const x =
      ft?.home ?? 0;

    const y =
      ft?.away ?? 0;

    const firstTotal =
      fh + fa;

    const total =
      x + y;

    /* =====================================================
       MS 1 / X / 2
    ===================================================== */

    if (
      key === "ms1"
    ) {

      return x > y
        ? "1"
        : x === y
          ? "X"
          : "2";
    }

    if (
      key === "ms0"
    ) {

      return x === y
        ? "X"
        : x > y
          ? "1"
          : "2";
    }

    if (
      key === "ms2"
    ) {

      return x < y
        ? "2"
        : x === y
          ? "X"
          : "1";
    }

    /* =====================================================
       İY 1 / X / 2
    ===================================================== */

    if (
      key === "iy1"
    ) {

      return fh > fa
        ? "1"
        : fh === fa
          ? "X"
          : "2";
    }

    if (
      key === "iy0"
    ) {

      return fh === fa
        ? "X"
        : fh > fa
          ? "1"
          : "2";
    }

    if (
      key === "iy2"
    ) {

      return fh < fa
        ? "2"
        : fh === fa
          ? "X"
          : "1";
    }

    /* =====================================================
       KG VAR / YOK
    ===================================================== */

    if (
      key === "kgVar"
    ) {

      return (
        x > 0 &&
        y > 0
      )
        ? "VAR"
        : "YOK";
    }

    if (
      key === "kgYok"
    ) {

      return (
        x > 0 &&
        y > 0
      )
        ? "VAR"
        : "YOK";
    }

    /* =====================================================
       İY 0.5
    ===================================================== */

    if (
      key === "iyOver05"
    ) {

      return firstTotal > 0.5
        ? "ÜST"
        : "ALT";
    }

    if (
      key === "iyUnder05"
    ) {

      return firstTotal <= 0.5
        ? "ALT"
        : "ÜST";
    }

    /* =====================================================
       İY 1.5
    ===================================================== */

    if (
      key === "iyOver15"
    ) {

      return firstTotal > 1.5
        ? "ÜST"
        : "ALT";
    }

    if (
      key === "iyUnder15"
    ) {

      return firstTotal <= 1.5
        ? "ALT"
        : "ÜST";
    }

    /* =====================================================
       MS 1.5
    ===================================================== */

    if (
      key === "msOver15"
    ) {

      return total > 1.5
        ? "ÜST"
        : "ALT";
    }

    if (
      key === "msUnder15"
    ) {

      return total <= 1.5
        ? "ALT"
        : "ÜST";
    }

    /* =====================================================
       MS 2.5
    ===================================================== */

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

    /* =====================================================
       MS 3.5
    ===================================================== */

    if (
      key === "msOver35"
    ) {

      return total > 3.5
        ? "ÜST"
        : "ALT";
    }

    if (
      key === "msUnder35"
    ) {

      return total <= 3.5
        ? "ALT"
        : "ÜST";
    }

    /* =====================================================
       EV GOL
    ===================================================== */

    if (
      key === "evGoal"
    ) {

      return x > 0
        ? "VAR"
        : "YOK";
    }

    /* =====================================================
       DEP GOL
    ===================================================== */

    if (
      key === "depGoal"
    ) {

      return y > 0
        ? "VAR"
        : "YOK";
    }

    return "";
  }

  /* =========================================================
     MAÇ ID
  ========================================================= */

  function matchId(row) {

    return String(
      row?.code ??
      row?.id ??
      row?.matchId ??
      row?.mackolikId ??
      (
        `${row?.home ?? ""}|` +
        `${row?.away ?? ""}|` +
        `${dateKey(row?.date)}|` +
        `${row?.time ?? ""}`
      )
    );
  }

  /* =========================================================
     SKOR YAZISI
  ========================================================= */

  function scoreText(row) {

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
        ${ft.home}-${ft.away}
      </span>
    `;
  }

  /* =========================================================
     TARİH İNDEKSİ
  ========================================================= */

  function buildDateIndex() {

    state.byDate.clear();

    const data =
      Array.isArray(
        window.ORAN_DATA
      )
        ? window.ORAN_DATA
        : [];

    for (
      const row of data
    ) {

      const key =
        dateKey(row?.date);

      if (!key) {
        continue;
      }

      if (
        !state.byDate.has(key)
      ) {

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
     GEÇMİŞ
  ========================================================= */

  function getHistory(
    targetDate
  ) {

    if (
      state.historyByDate.has(
        targetDate
      )
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

    const history = [];

    for (
      const row of (
        Array.isArray(
          window.ORAN_DATA
        )
          ? window.ORAN_DATA
          : []
      )
    ) {

      const d =
        dateKey(row?.date);

      if (!d) {
        continue;
      }

      if (
        d >= targetDate
      ) {
        continue;
      }

      if (
        d < minDate
      ) {
        continue;
      }

      if (
        !played(row)
      ) {
        continue;
      }

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
     CACHE
  ========================================================= */

  function trimCache(map) {

    while (
      map.size >
      CACHE_LIMIT
    ) {

      const first =
        map.keys()
          .next()
          .value;

      map.delete(first);
    }
  }

  /* =========================================================
     ORAN BUL
  ========================================================= */

  function getOdd(
    row,
    market
  ) {

    const direct =
      number(
        row?.odds?.[
          market.key
        ]
      );

    if (
      direct !== null
    ) {

      return direct;
    }

    const containers = [

      row?.openingOdds,
      row?.opening_odds,
      row?.opening,
      row?.odds,
      row?.Odds

    ];

    for (
      const container of containers
    ) {

      const n =
        number(
          container?.[
            market.key
          ]
        );

      if (
        n !== null
      ) {

        return n;
      }
    }

    return null;
  }

  /* =========================================================
     MARKETLERİ AL
  ========================================================= */

  function getMarkets() {

    const source =
      Array.isArray(
        window.ORAN_MARKETS
      ) &&
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
          Object.prototype
            .hasOwnProperty.call(
              RESULT_KEYS,
              key
            )
      )
      .map(
        ([key, label]) => ({
          key,
          label,
          result:
            RESULT_KEYS[key]
        })
      );
  }

  /* =========================================================
     İSTATİSTİK
  ========================================================= */

  function buildStats(
    targetDate
  ) {

    if (
      state.statsByDate.has(
        targetDate
      )
    ) {

      return state.statsByDate.get(
        targetDate
      );
    }

    const history =
      getHistory(
        targetDate
      );

    const maps =
      new Map();

    for (
      const market of getMarkets()
    ) {

      const oddsMap =
        new Map();

      for (
        const row of history
      ) {

        const odd =
          getOdd(
            row,
            market
          );

        if (
          odd === null
        ) {
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

  function candidates(
    targetDate
  ) {

    if (
      state.candidatesByDate.has(
        targetDate
      )
    ) {

      return state.candidatesByDate.get(
        targetDate
      );
    }

    buildDateIndex();

    const rows =
      state.byDate.get(
        targetDate
      ) || [];

    const stats =
      buildStats(
        targetDate
      );

    const markets =
      getMarkets();

    const output = [];

    for (
      const row of rows
    ) {

      /*
        Maç skorlandıysa artık
        aday kupona girmez.
      */

      if (
        played(row)
      ) {

        continue;
      }

      const predictions = [];

      for (
        const market of markets
      ) {

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
            .get(
              market.key
            )
            ?.get(
              odd.toFixed(2)
            );

        const sample =
          bucket?.sample ||
          0;

        const wins =
          bucket?.wins ||
          0;

        const percentage =
          sample
            ? (
                wins /
                sample
              ) * 100
            : 0;

        predictions.push({

          market:
            market.key,

          name:
            market.label,

          result:
            market.result,

          odd,

          sample,

          wins,

          percentage
        });
      }

      if (
        !predictions.length
      ) {

        continue;
      }

      predictions.sort(
        (a, b) =>
          b.percentage -
            a.percentage ||

          b.sample -
            a.sample ||

          b.odd -
            a.odd
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

  function score(
    prediction,
    type
  ) {

    if (
      type === "safe"
    ) {

      return (
        prediction.percentage +
        Math.min(
          prediction.sample,
          30
        ) * 0.35 -
        prediction.odd * 0.02
      );
    }

    if (
      type === "medium"
    ) {

      return (
        prediction.percentage *
          0.70 +

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
      prediction.percentage *
        0.35 +
      Math.min(
        prediction.sample,
        20
      ) * 0.1
    );
  }

  /* =========================================================
     KATEGORİ
  ========================================================= */

  function category(
    prediction,
    type
  ) {

    if (
      type === "safe"
    ) {

      return (
        prediction.percentage >=
        80
      );
    }

    if (
      type === "medium"
    ) {

      return (
        prediction.percentage >=
          65 &&
        prediction.percentage <
          80
      );
    }

    return (
      prediction.percentage <
      65
    );
  }

  /* =========================================================
     MAÇIN EN İYİ TAHMİNİ
  ========================================================= */

  function bestForMatch(
    item,
    type
  ) {

    const list =
      item.predictions.filter(
        prediction =>
          category(
            prediction,
            type
          )
      );

    if (!list.length) {
      return null;
    }

    list.sort(
      (a, b) =>
        score(b, type) -
        score(a, type)
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

    for (
      const item of items
    ) {

      const id =
        matchId(
          item.row
        );

      if (
        blocked.has(id)
      ) {

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

        row:
          item.row,

        prediction
      });
    }

    if (!list.length) {
      return null;
    }

    list.sort(
      (a, b) => {

        const pa =
          a.prediction;

        const pb =
          b.prediction;

        return (
          score(pb, type) -
            score(pa, type) ||

          pb.odd -
            pa.odd
        );
      }
    );

    const selected = [];

    let total = 1;

    for (
      const item of list
    ) {

      if (
        selected.length >=
        MAX_MATCHES
      ) {

        break;
      }

      selected.push(
        item
      );

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

      matches:
        selected,

      totalOdds:
        total
    };
  }

  /* =========================================================
     KUPON DURUMU
  ========================================================= */

  function statusForCoupon(
    coupon
  ) {

    let pending =
      false;

    let lost =
      false;

    for (
      const item of coupon.matches
    ) {

      const row =
        item.row;

      const status =
        matchStatus(row);

      /*
        Canlı / başlamamış
      */

      if (
        status === "live" ||
        status === "not_started"
      ) {

        pending = true;

        continue;
      }

      /*
        Skor yok
      */

      const ft =
        getFTScore(row);

      if (!ft) {

        pending = true;

        continue;
      }

      /*
        Sonuç hesapla
      */

      const actual =
        result(
          row,
          item.prediction.market
        );

      if (!actual) {

        pending = true;

        continue;
      }

      if (
        actual !==
        item.prediction.result
      ) {

        lost = true;
      }
    }

    if (lost) {

      return [
        "lost",
        "Kaybetti"
      ];
    }

    if (pending) {

      return [
        "pending",
        "Bekliyor"
      ];
    }

    return [
      "won",
      "Kazandı"
    ];
  }

  /* =========================================================
     MAÇ SATIRI
  ========================================================= */

  function renderPrediction(
    item
  ) {

    const prediction =
      item.prediction;

    const row =
      item.row;

    let stateClass =
      "pending";

    let icon =
      "•";

    const ft =
      getFTScore(row);

    if (ft) {

      const actual =
        result(
          row,
          prediction.market
        );

      if (
        actual ===
        prediction.result
      ) {

        stateClass =
          "won";

        icon =
          "✓";

      } else if (actual) {

        stateClass =
          "lost";

        icon =
          "✕";
      }
    }

    return `

      <div class="coupon-match">

        <div class="match-info">

          <div class="match-teams">

            ${escape(
              row?.home ||
              "-"
            )}

            -

            ${escape(
              row?.away ||
              "-"
            )}

          </div>

          <div class="match-meta">

            ${escape(
              row?.time ||
              ""
            )}

            ${
              row?.league
                ? ` · ${escape(
                    row.league
                  )}`
                : ""
            }

          </div>

          ${
            scoreText(row)
              ? `
                <div class="coupon-score-wrap">
                  ${scoreText(row)}
                </div>
              `
              : ""
          }

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

    const [
      statusClass,
      statusText
    ] =
      statusForCoupon(
        coupon
      );

    return `

      <div
        class="coupon-card ${statusClass}"
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

            ${statusText}

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
            .map(
              renderPrediction
            )
            .join("")
        }

      </div>
    `;
  }

  /* =========================================================
     EKRANA BAS
  ========================================================= */

  function render(
    date,
    force
  ) {

    const output =
      el(
        "couponResults"
      );

    if (!output) {
      return;
    }

    if (!date) {

      output.innerHTML = `

        <div class="card empty">

          Kupon tarihi seçin.

        </div>

      `;

      return;
    }

    if (
      !force &&
      state.renderedDate ===
        date &&
      output.innerHTML
    ) {

      return;
    }

    state.renderedDate =
      date;

    output.innerHTML = `

      <div class="loading-coupon">

        Kuponlar hazırlanıyor…

      </div>

    `;

    requestAnimationFrame(
      function () {

        const items =
          candidates(date);

        if (!items.length) {

          output.innerHTML = `

            <div class="no-coupon">

              <div class="no-coupon-title">

                Bu tarih için kupon
                oluşturulamadı.

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

          coupons.push(
            renderCoupon(
              coupon,
              name,
              icon
            )
          );

          coupon.matches.forEach(
            function (item) {

              blocked.add(
                matchId(
                  item.row
                )
              );

            }
          );
        }

        if (
          coupons.length
        ) {

          output.innerHTML =
            coupons.join("");

        } else {

          output.innerHTML = `

            <div class="no-coupon">

              <div class="no-coupon-title">

                2.00 ve üzeri kupon
                bulunamadı.

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
     SKORLARI YENİLE
  ========================================================= */

  async function refreshScores() {

    await loadMackolikScores();

    /*
      Skor geldikten sonra
      geçmiş cache'lerini de temizle.
    */

    state.candidatesByDate.clear();

    /*
      Sadece bugünün skor değişimi için
      ekranı tekrar çiz.
    */

    const input =
      el("couponDate");

    if (
      input?.value
    ) {

      state.renderedDate =
        "";

      render(
        input.value,
        true
      );
    }
  }

  /* =========================================================
     EVENTLER
  ========================================================= */

  [
    "oran-data-ready",
    "score-updated",
    "scores-updated",
    "mackolik-data-updated",
    "matches-updated"
  ].forEach(
    function (eventName) {

      window.addEventListener(
        eventName,
        function () {

          buildDateIndex();

          state.historyByDate.clear();
          state.statsByDate.clear();
          state.candidatesByDate.clear();

          refreshScores();

        }
      );

    }
  );

  /* =========================================================
     SAYFA GERİ GELDİĞİNDE
  ========================================================= */

  document.addEventListener(
    "visibilitychange",
    function () {

      if (
        document.visibilityState ===
        "visible"
      ) {

        refreshScores();

      }

    }
  );

  window.addEventListener(
    "focus",
    function () {

      refreshScores();

    }
  );

  /* =========================================================
     KURULUM
  ========================================================= */

  function setup() {

    const dateInput =
      el("couponDate");

    if (!dateInput) {
      return;
    }

    buildDateIndex();

    const dates =
      [
        ...state.byDate.keys()
      ].sort();

    if (!dates.length) {

      dateInput.value =
        "";

      render("");

      return;
    }

    dateInput.min =
      dates[0];

    dateInput.max =
      dates[
        dates.length - 1
      ];

    const today =
      todayKey();

    dateInput.value =
      state.byDate.has(today)
        ? today
        : dates[
            dates.length - 1
          ];

    dateInput.onchange =
      function () {

        state.renderedDate =
          "";

        state.candidatesByDate.delete(
          dateInput.value
        );

        render(
          dateInput.value,
          true
        );
      };

    render(
      dateInput.value,
      true
    );

    /*
      İlk skor çekimi
    */

    refreshScores();

    /*
      30 saniyede bir skor kontrolü.
      Yeni dosya oluşturulmaz.
    */

    if (
      !state.refreshTimer
    ) {

      state.refreshTimer =
        setInterval(
          function () {

            /*
              Sadece sayfa görünürken
              çalışsın.
            */

            if (
              document.visibilityState !==
              "visible"
            ) {
              return;
            }

            refreshScores();

          },
          SCORE_REFRESH_MS
        );
    }
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

      .coupon-date-box {
        margin-top: 14px;
      }

      .coupon-date-box label {
        display: block;
        font-size: 12px;
        color: #9ba6bf;
        margin-bottom: 6px;
      }

      .coupon-date-box input {
        max-width: 260px;
      }

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
        gap: 10px;
        align-items: center;
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
        font-weight: 800;
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
        width: 23px;
        height: 23px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
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

      .no-coupon,
      .loading-coupon {
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

      .muted {
        color: #8996aa;
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

      }

    `;

    document.head.appendChild(
      style
    );
  }

  /* =========================================================
     BAŞLAT
  ========================================================= */

  function init() {

    addStyles();

    setup();

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
      refreshScores,

    loadScores:
      loadMackolikScores,

    state

  };

})();
