"use strict";

/* =========================================================
   ORAN ANALİZİ - OTOMATİK KUPON
   ---------------------------------------------------------
   - Yeni skor dosyası YOK
   - Maçkolik matches.json kullanılır
   - Skorlar tek seferde indekslenir
   - Tarih değişiminde donma yok
   - 60 günlük geçmiş
   - Maksimum 5 maç
   - Toplam oran >= 2.00
========================================================= */

(function () {

  "use strict";

  /* =======================================================
     AYARLAR
  ======================================================= */

  const HISTORY_DAYS = 60;
  const MIN_TOTAL_ODDS = 2.00;
  const MAX_MATCHES = 5;

  const SCORE_URL =
    "https://teador612.github.io/mackolik1/data/matches.json";

  const SCORE_REFRESH_MS = 30000;

  /* =======================================================
     DURUM
  ======================================================= */

  const state = {

    byDate: new Map(),

    historyByDate: new Map(),

    statsByDate: new Map(),

    candidatesByDate: new Map(),

    /*
      Maçkolik skor indeksleri
    */
    scoreById: new Map(),

    scoreByTeamKey: new Map(),

    scoresLoaded: false,

    scoreLoading: false,

    renderedDate: "",

    timer: null

  };

  /* =======================================================
     SONUÇLAR
  ======================================================= */

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

  /* =======================================================
     MARKETLER
  ======================================================= */

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

  /* =======================================================
     ELEMENT
  ======================================================= */

  function el(id) {
    return document.getElementById(id);
  }

  /* =======================================================
     ESCAPE
  ======================================================= */

  function esc(value) {

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

  /* =======================================================
     NUMBER
  ======================================================= */

  function num(value) {

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

  /* =======================================================
     DATE
  ======================================================= */

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
        m[1] + "-" +
        String(m[2]).padStart(2, "0") + "-" +
        String(m[3]).padStart(2, "0")
      );
    }

    m = text.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    );

    if (m) {
      return (
        m[3] + "-" +
        String(m[2]).padStart(2, "0") + "-" +
        String(m[1]).padStart(2, "0")
      );
    }

    const d = new Date(text);

    if (Number.isNaN(d.getTime())) {
      return "";
    }

    return (
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  /* =======================================================
     TODAY
  ======================================================= */

  function today() {

    const d = new Date();

    return (
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  /* =======================================================
     ADD DAYS
  ======================================================= */

  function addDays(key, amount) {

    const d =
      new Date(key + "T00:00:00");

    d.setDate(
      d.getDate() + amount
    );

    return (
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  /* =======================================================
     TEAM NORMALIZE
  ======================================================= */

  function teamKey(value) {

    return String(value ?? "")
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(
        /\b(fc|fk|sk|sc|sp|spor|club|cf|afc)\b/g,
        " "
      )
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  /* =======================================================
     SCORE PARSE
  ======================================================= */

  function parseScore(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (
      typeof value === "object" &&
      !Array.isArray(value)
    ) {

      const h = num(
        value.home ??
        value.homeScore ??
        value.h
      );

      const a = num(
        value.away ??
        value.awayScore ??
        value.a
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

    if (
      Array.isArray(value) &&
      value.length >= 2
    ) {

      const h = num(value[0]);
      const a = num(value[1]);

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

    const m =
      String(value)
        .trim()
        .match(
          /(\d+)\s*[-:]\s*(\d+)/
        );

    if (!m) {
      return null;
    }

    return {
      home: Number(m[1]),
      away: Number(m[2])
    };
  }

  /* =======================================================
     SCORE FROM MACKOLIK RECORD
  ======================================================= */

  function parseExternalMatch(m) {

    if (!m) {
      return null;
    }

    const ft =
      parseScore(m.score);

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

    const id =
      String(
        m.code ??
        m.id ??
        m.matchId ??
        ""
      ).trim();

    const home =
      String(
        m.home ??
        m.homeTeam ??
        ""
      ).trim();

    const away =
      String(
        m.away ??
        m.awayTeam ??
        ""
      ).trim();

    return {
      id,
      home,
      away,
      date: dateKey(
        m.date ??
        m.matchDate
      ),
      time: m.time ?? "",
      ft,
      ht
    };
  }

  /* =======================================================
     SKOR İNDEKSİ
  ======================================================= */

  function buildScoreIndex(matches) {

    state.scoreById.clear();
    state.scoreByTeamKey.clear();

    for (
      const raw of matches
    ) {

      const item =
        parseExternalMatch(raw);

      if (!item) {
        continue;
      }

      /*
        ID index
      */

      if (item.id) {

        state.scoreById.set(
          item.id,
          item
        );
      }

      /*
        Takım index
      */

      const h =
        teamKey(item.home);

      const a =
        teamKey(item.away);

      if (
        h &&
        a
      ) {

        const key =
          h + "|" + a;

        /*
          Aynı isimde farklı tarihler
          olabilir. Liste tutuyoruz.
        */

        if (
          !state.scoreByTeamKey.has(key)
        ) {

          state.scoreByTeamKey.set(
            key,
            []
          );
        }

        state.scoreByTeamKey
          .get(key)
          .push(item);
      }
    }

    state.scoresLoaded = true;
  }

  /* =======================================================
     SKOR JSON YÜKLE
  ======================================================= */

  async function loadScores() {

    if (state.scoreLoading) {
      return;
    }

    state.scoreLoading = true;

    try {

      const response =
        await fetch(
          SCORE_URL +
          "?v=" +
          Date.now(),
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          "Skor verisi alınamadı"
        );
      }

      const json =
        await response.json();

      const matches =
        Array.isArray(json?.matches)
          ? json.matches
          : [];

      /*
        ÖNEMLİ:
        Sadece bir kez index oluşturuyoruz.
      */

      buildScoreIndex(matches);

      /*
        Skorlar değiştiğinde
        sadece mevcut kuponu yenile.
      */

      refreshVisibleCoupon();

    } catch (error) {

      console.warn(
        "Kupon skorları:",
        error
      );

    } finally {

      state.scoreLoading = false;
    }
  }

  /* =======================================================
     EXTERNAL SCORE BUL
     -------------------------------------------------------
     BURASI ARTIK AĞIR DEĞİL.
     Önceden hazırlanmış Map kullanıyor.
  ======================================================= */

  function externalScore(row) {

    if (!state.scoresLoaded) {
      return null;
    }

    /*
      Önce ID
    */

    const ids = [

      row?.code,
      row?.id,
      row?.matchId,
      row?.mackolikId

    ];

    for (
      const id of ids
    ) {

      if (
        id === null ||
        id === undefined
      ) {
        continue;
      }

      const key =
        String(id).trim();

      if (!key) {
        continue;
      }

      const found =
        state.scoreById.get(key);

      if (found) {
        return found;
      }
    }

    /*
      Sonra takım adı
    */

    const h =
      teamKey(
        row?.home ??
        row?.homeTeam
      );

    const a =
      teamKey(
        row?.away ??
        row?.awayTeam
      );

    if (
      !h ||
      !a
    ) {
      return null;
    }

    const list =
      state.scoreByTeamKey.get(
        h + "|" + a
      );

    if (!list?.length) {
      return null;
    }

    const d =
      dateKey(row?.date);

    /*
      Tarih eşleşmesi öncelikli.
    */

    const exact =
      list.find(
        x =>
          !d ||
          !x.date ||
          x.date === d
      );

    return exact || list[0];
  }

  /* =======================================================
     FT
  ======================================================= */

  function getFT(row) {

    /*
      Önce ORAN_DATA
    */

    const local = [

      row?.scoreFT,
      row?.fullTimeScore,
      row?.ftScore,
      row?.score?.fullTime,
      row?.score?.ft,
      row?.score

    ];

    for (
      const value of local
    ) {

      const s =
        parseScore(value);

      if (s) {
        return s;
      }
    }

    /*
      Sonra indekslenmiş Maçkolik.
    */

    const ext =
      externalScore(row);

    return ext?.ft || null;
  }

  /* =======================================================
     HT
  ======================================================= */

  function getHT(row) {

    const local = [

      row?.scoreHT,
      row?.halfTimeScore,
      row?.htScore,
      row?.score?.halfTime,
      row?.score?.ht,
      row?.halfTime

    ];

    for (
      const value of local
    ) {

      const s =
        parseScore(value);

      if (s) {
        return s;
      }
    }

    const ext =
      externalScore(row);

    return ext?.ht || null;
  }

  /* =======================================================
     OYNANMIŞ
  ======================================================= */

  function played(row) {

    /*
      Skor varsa skor önceliklidir.
      Böylece 0-0 da oynanmış kabul edilir.
    */

    if (getFT(row)) {
      return true;
    }

    if (row?.played === true) {
      return true;
    }

    return false;
  }

  /* =======================================================
     ORAN
  ======================================================= */

  function getOdd(row, market) {

    const direct =
      num(
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

    for (
      const c of containers
    ) {

      const n =
        num(
          c?.[market.key]
        );

      if (n !== null) {
        return n;
      }
    }

    return null;
  }

  /* =======================================================
     MARKETLER
  ======================================================= */

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
        x =>
          Object.prototype.hasOwnProperty.call(
            RESULT_KEYS,
            x[0]
          )
      )
      .map(
        x => ({
          key: x[0],
          label: x[1],
          result:
            RESULT_KEYS[x[0]]
        })
      );
  }

  /* =======================================================
     SONUÇ
  ======================================================= */

  function result(row, key) {

    if (
      row?.results &&
      row.results[key] !== undefined &&
      row.results[key] !== ""
    ) {

      return String(
        row.results[key]
      );
    }

    const ft =
      getFT(row);

    const ht =
      getHT(row);

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

    if (
      !needsHT &&
      !ft
    ) {
      return "";
    }

    const fh = ht?.home ?? 0;
    const fa = ht?.away ?? 0;

    const x = ft?.home ?? 0;
    const y = ft?.away ?? 0;

    const htTotal =
      fh + fa;

    const ftTotal =
      x + y;

    /* MS */

    if (key === "ms1") {
      return x > y ? "1" : x === y ? "X" : "2";
    }

    if (key === "ms0") {
      return x === y ? "X" : x > y ? "1" : "2";
    }

    if (key === "ms2") {
      return x < y ? "2" : x === y ? "X" : "1";
    }

    /* İY */

    if (key === "iy1") {
      return fh > fa ? "1" : fh === fa ? "X" : "2";
    }

    if (key === "iy0") {
      return fh === fa ? "X" : fh > fa ? "1" : "2";
    }

    if (key === "iy2") {
      return fh < fa ? "2" : fh === fa ? "X" : "1";
    }

    /* KG */

    if (key === "kgVar") {
      return x > 0 && y > 0 ? "VAR" : "YOK";
    }

    if (key === "kgYok") {
      return x > 0 && y > 0 ? "VAR" : "YOK";
    }

    /* İY 0.5 */

    if (key === "iyOver05") {
      return htTotal > 0.5 ? "ÜST" : "ALT";
    }

    if (key === "iyUnder05") {
      return htTotal <= 0.5 ? "ALT" : "ÜST";
    }

    /* İY 1.5 */

    if (key === "iyOver15") {
      return htTotal > 1.5 ? "ÜST" : "ALT";
    }

    if (key === "iyUnder15") {
      return htTotal <= 1.5 ? "ALT" : "ÜST";
    }

    /* MS 1.5 */

    if (key === "msOver15") {
      return ftTotal > 1.5 ? "ÜST" : "ALT";
    }

    if (key === "msUnder15") {
      return ftTotal <= 1.5 ? "ALT" : "ÜST";
    }

    /* MS 2.5 */

    if (
      key === "over25" ||
      key === "msOver25"
    ) {
      return ftTotal > 2.5 ? "ÜST" : "ALT";
    }

    if (
      key === "under25" ||
      key === "msUnder25"
    ) {
      return ftTotal <= 2.5 ? "ALT" : "ÜST";
    }

    /* MS 3.5 */

    if (key === "msOver35") {
      return ftTotal > 3.5 ? "ÜST" : "ALT";
    }

    if (key === "msUnder35") {
      return ftTotal <= 3.5 ? "ALT" : "ÜST";
    }

    /* GOL */

    if (key === "evGoal") {
      return x > 0 ? "VAR" : "YOK";
    }

    if (key === "depGoal") {
      return y > 0 ? "VAR" : "YOK";
    }

    return "";
  }

  /* =======================================================
     ID
  ======================================================= */

  function matchId(row) {

    return String(
      row?.code ??
      row?.id ??
      row?.matchId ??
      row?.mackolikId ??
      (
        String(row?.home ?? "") +
        "|" +
        String(row?.away ?? "") +
        "|" +
        dateKey(row?.date) +
        "|" +
        String(row?.time ?? "")
      )
    );
  }

  /* =======================================================
     DATE INDEX
  ======================================================= */

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

      const d =
        dateKey(row?.date);

      if (!d) {
        continue;
      }

      if (
        !state.byDate.has(d)
      ) {
        state.byDate.set(
          d,
          []
        );
      }

      state.byDate
        .get(d)
        .push(row);
    }
  }

  /* =======================================================
     HISTORY
  ======================================================= */

  function getHistory(targetDate) {

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

    const data =
      Array.isArray(
        window.ORAN_DATA
      )
        ? window.ORAN_DATA
        : [];

    const history = [];

    for (
      const row of data
    ) {

      const d =
        dateKey(row?.date);

      if (!d) {
        continue;
      }

      if (
        d >= targetDate ||
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

    return history;
  }

  /* =======================================================
     STATS
  ======================================================= */

  function buildStats(targetDate) {

    if (
      state.statsByDate.has(
        targetDate
      )
    ) {
      return state.statsByDate.get(
        targetDate
      );
    }

    const stats =
      new Map();

    const history =
      getHistory(
        targetDate
      );

    for (
      const market of getMarkets()
    ) {

      const odds =
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
          odds.get(key);

        if (!item) {

          item = {
            odd,
            sample: 0,
            wins: 0
          };

          odds.set(
            key,
            item
          );
        }

        const r =
          result(
            row,
            market.key
          );

        if (!r) {
          continue;
        }

        item.sample++;

        if (
          r ===
          market.result
        ) {
          item.wins++;
        }
      }

      stats.set(
        market.key,
        odds
      );
    }

    state.statsByDate.set(
      targetDate,
      stats
    );

    return stats;
  }

  /* =======================================================
     CANDIDATES
  ======================================================= */

  function candidates(targetDate) {

    if (
      state.candidatesByDate.has(
        targetDate
      )
    ) {
      return state.candidatesByDate.get(
        targetDate
      );
    }

    const rows =
      state.byDate.get(
        targetDate
      ) || [];

    const stats =
      buildStats(
        targetDate
      );

    const output = [];

    for (
      const row of rows
    ) {

      if (
        played(row)
      ) {
        continue;
      }

      const predictions = [];

      for (
        const market of getMarkets()
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
            ? wins / sample * 100
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

    return output;
  }

  /* =======================================================
     SCORE
  ======================================================= */

  function predictionScore(
    p,
    type
  ) {

    if (type === "safe") {

      return (
        p.percentage +
        Math.min(
          p.sample,
          30
        ) * 0.35 -
        p.odd * 0.02
      );
    }

    if (type === "medium") {

      return (
        p.percentage * 0.70 +
        Math.min(p.odd, 3) * 10 +
        Math.min(p.sample, 20) * 0.15
      );
    }

    return (
      p.odd * 12 +
      p.percentage * 0.35 +
      Math.min(p.sample, 20) * 0.1
    );
  }

  /* =======================================================
     CATEGORY
  ======================================================= */

  function allowed(
    p,
    type
  ) {

    if (type === "safe") {
      return p.percentage >= 80;
    }

    if (type === "medium") {
      return (
        p.percentage >= 65 &&
        p.percentage < 80
      );
    }

    return p.percentage < 65;
  }

  /* =======================================================
     BEST
  ======================================================= */

  function bestForMatch(
    item,
    type
  ) {

    const list =
      item.predictions.filter(
        p =>
          allowed(
            p,
            type
          )
      );

    if (!list.length) {
      return null;
    }

    list.sort(
      (a, b) =>
        predictionScore(b, type) -
        predictionScore(a, type)
    );

    return list[0];
  }

  /* =======================================================
     COUPON
  ======================================================= */

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
        row: item.row,
        prediction
      });
    }

    list.sort(
      (a, b) =>
        predictionScore(
          b.prediction,
          type
        ) -
        predictionScore(
          a.prediction,
          type
        ) ||
        b.prediction.odd -
        a.prediction.odd
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
      matches: selected,
      totalOdds: total
    };
  }

  /* =======================================================
     STATUS
  ======================================================= */

  function couponStatus(coupon) {

    let pending = false;
    let lost = false;

    for (
      const item of coupon.matches
    ) {

      const ft =
        getFT(
          item.row
        );

      if (!ft) {

        pending = true;

        continue;
      }

      const actual =
        result(
          item.row,
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
      return ["lost", "Kaybetti"];
    }

    if (pending) {
      return ["pending", "Bekliyor"];
    }

    return ["won", "Kazandı"];
  }

  /* =======================================================
     SCORE TEXT
  ======================================================= */

  function scoreText(row) {

    const ft =
      getFT(row);

    const ht =
      getHT(row);

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

  /* =======================================================
     PREDICTION HTML
  ======================================================= */

  function renderPrediction(item) {

    const p =
      item.prediction;

    const row =
      item.row;

    const ft =
      getFT(row);

    let cls =
      "pending";

    let icon =
      "•";

    if (ft) {

      const actual =
        result(
          row,
          p.market
        );

      if (
        actual ===
        p.result
      ) {

        cls = "won";
        icon = "✓";

      } else if (actual) {

        cls = "lost";
        icon = "✕";
      }
    }

    return `

      <div class="coupon-match">

        <div class="match-info">

          <div class="match-teams">
            ${esc(row?.home || "-")}
            -
            ${esc(row?.away || "-")}
          </div>

          <div class="match-meta">

            ${esc(row?.time || "")}

            ${
              row?.league
                ? " · " +
                  esc(row.league)
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

          <span class="result-icon ${cls}">
            ${icon}
          </span>

          <div>

            <div class="prediction-name">
              ${esc(p.name)}
            </div>

            <div class="prediction-odd">
              ${p.odd.toFixed(2)}
            </div>

            <div class="prediction-rate">

              ${
                p.sample
                  ? "%" +
                    p.percentage.toFixed(1) +
                    " · " +
                    p.wins +
                    "/" +
                    p.sample
                  : "Geçmiş eşleşme yok"
              }

            </div>

          </div>

        </div>

      </div>
    `;
  }

  /* =======================================================
     COUPON HTML
  ======================================================= */

  function renderCoupon(
    coupon,
    title,
    icon
  ) {

    const [
      statusClass,
      statusText
    ] =
      couponStatus(
        coupon
      );

    return `

      <div class="coupon-card ${statusClass}">

        <div class="coupon-header">

          <div>

            <div class="coupon-name">
              ${icon} ${title}
            </div>

            <div class="coupon-count">
              ${coupon.matches.length} maç
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

        ${coupon.matches
          .map(renderPrediction)
          .join("")}

      </div>
    `;
  }

  /* =======================================================
     RENDER
  ======================================================= */

  function render(
    date,
    force
  ) {

    const output =
      el("couponResults");

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

    /*
      Aynı tarihi gereksiz yere
      tekrar hesaplama.
    */

    if (
      !force &&
      state.renderedDate === date
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

    /*
      Tarayıcıya ekranı çizmesi için
      fırsat ver.
    */

    setTimeout(
      function () {

        try {

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

          const html = [];

          for (
            const [
              type,
              title,
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

            html.push(
              renderCoupon(
                coupon,
                title,
                icon
              )
            );

            for (
              const item of
              coupon.matches
            ) {

              blocked.add(
                matchId(
                  item.row
                )
              );
            }
          }

          output.innerHTML =
            html.length
              ? html.join("")
              : `
                <div class="no-coupon">
                  2.00 ve üzeri kupon bulunamadı.
                </div>
              `;

        } catch (error) {

          console.error(
            "Kupon oluşturma hatası:",
            error
          );

          output.innerHTML = `
            <div class="no-coupon">
              Kupon oluşturulurken hata oluştu.
            </div>
          `;
        }

      },
      0
    );
  }

  /* =======================================================
     SADECE SKOR DURUMUNU YENİLE
  ======================================================= */

  function refreshVisibleCoupon() {

    const input =
      el("couponDate");

    if (!input?.value) {
      return;
    }

    /*
      Skor geldiğinde adaylar yeniden
      hesaplanmalı çünkü oynanan maç
      artık aday olmamalı.
    */

    state.candidatesByDate.delete(
      input.value
    );

    state.renderedDate = "";

    render(
      input.value,
      true
    );
  }

  /* =======================================================
     TARİH DEĞİŞTİR
  ======================================================= */

  function changeDate(date) {

    /*
      SADECE SEÇİLEN TARİHİ TEMİZLE.
      60 günlük tüm cache'i temizleme.
    */

    state.candidatesByDate.delete(
      date
    );

    state.statsByDate.delete(
      date
    );

    state.historyByDate.delete(
      date
    );

    state.renderedDate = "";

    render(
      date,
      true
    );
  }

  /* =======================================================
     SETUP
  ======================================================= */

  function setup() {

    const input =
      el("couponDate");

    if (!input) {
      return;
    }

    buildDateIndex();

    const dates =
      Array.from(
        state.byDate.keys()
      ).sort();

    if (!dates.length) {

      input.value = "";

      render("");

      return;
    }

    input.min =
      dates[0];

    input.max =
      dates[
        dates.length - 1
      ];

    const t =
      today();

    input.value =
      state.byDate.has(t)
        ? t
        : dates[
            dates.length - 1
          ];

    /*
      Eski onchange'i
      tekrar tekrar oluşturmamak için
      bir kez bağla.
    */

    if (
      !input.dataset.couponBound
    ) {

      input.dataset.couponBound =
        "1";

      input.addEventListener(
        "change",
        function () {

          changeDate(
            input.value
          );

        }
      );
    }

    render(
      input.value,
      true
    );

    /*
      Skorları arka planda yükle.
    */

    loadScores();

    /*
      Tek interval.
    */

    if (!state.timer) {

      state.timer =
        setInterval(
          function () {

            if (
              document.visibilityState ===
              "visible"
            ) {

              loadScores();

            }

          },
          SCORE_REFRESH_MS
        );
    }
  }

  /* =======================================================
     EVENT
  ======================================================= */

  window.addEventListener(
    "oran-data-ready",
    function () {

      /*
        ORAN_DATA değiştiyse
        tarih indeksini yenile.
      */

      state.byDate.clear();

      state.historyByDate.clear();

      state.statsByDate.clear();

      state.candidatesByDate.clear();

      state.renderedDate = "";

      setup();

    }
  );

  document.addEventListener(
    "visibilitychange",
    function () {

      if (
        document.visibilityState ===
        "visible"
      ) {

        loadScores();

      }

    }
  );

  /* =======================================================
     CSS
  ======================================================= */

  function addStyles() {

    if (
      el("fast-coupon-css")
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

  /* =======================================================
     INIT
  ======================================================= */

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

  /* =======================================================
     DIŞARIDAN ERİŞİM
  ======================================================= */

  window.oranAnalizCoupon = {

    render,

    setup,

    refresh:
      loadScores,

    loadScores,

    changeDate,

    state

  };

})();
