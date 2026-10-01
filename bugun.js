/* =========================================================
   BUGÜNÜN MAÇLARI
   Seçilen tarihteki TÜM maçları gösterir.
   Geçmiş maçlarda skorları gösterir.
   Gelecek/oynanmamış maçlarda "Oynanmadı" gösterir.
========================================================= */

(function () {
  'use strict';

  const MACKOLIK_URL =
    'https://teador612.github.io/mackolik1/data/matches.json';

  const START = '2026-01-01';

  let selectedDate = '';

  /* =========================================================
     YARDIMCI FONKSİYONLAR
  ========================================================= */

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function score(v) {
    if (v === null || v === undefined) return '';

    const s = String(v).trim();

    if (!s) return '';

    if (
      s === '-' ||
      s.toLowerCase() === 'null' ||
      s.toLowerCase() === 'undefined'
    ) {
      return '';
    }

    const m = s.match(/(\d+)\s*[-:]\s*(\d+)/);

    if (!m) return '';

    return m[1] + ' - ' + m[2];
  }

  function normalizeTeam(v) {
    return String(v || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '');
  }

  function getData() {
    if (
      typeof DATA !== 'undefined' &&
      Array.isArray(DATA)
    ) {
      return DATA;
    }

    if (
      window.ORAN_DATA &&
      Array.isArray(window.ORAN_DATA)
    ) {
      return window.ORAN_DATA;
    }

    return [];
  }

  function getToday() {
    const d = new Date();

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return y + '-' + m + '-' + day;
  }

  function isFinished(x) {
    return !!score(x.scoreFT);
  }

  /* =========================================================
     MACKOLIK VERİSİNİ DATA.JS İLE EŞLEŞTİR
  ========================================================= */

  function findMackolikMatch(row, matches) {
    if (!Array.isArray(matches)) return null;

    /* Önce code */
    if (row.code) {
      const byCode = matches.find(function (m) {
        return String(m.code || '') === String(row.code);
      });

      if (byCode) return byCode;
    }

    const home = normalizeTeam(row.home);
    const away = normalizeTeam(row.away);
    const date = String(row.date || '');

    let found = matches.find(function (m) {
      return (
        String(m.date || '') === date &&
        normalizeTeam(m.home) === home &&
        normalizeTeam(m.away) === away
      );
    });

    if (found) return found;

    /* Tarih tutmuyorsa takım adıyla dene */
    found = matches.find(function (m) {
      return (
        normalizeTeam(m.home) === home &&
        normalizeTeam(m.away) === away
      );
    });

    return found || null;
  }

  /* =========================================================
     MACKOLIK'TEN SKORLARI ÇEK
  ========================================================= */

  async function fetchMackolik() {
    try {
      const url =
        MACKOLIK_URL +
        '?t=' +
        Date.now();

      const response = await fetch(url, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Mackolik verisi alınamadı');
      }

      const json = await response.json();

      return Array.isArray(json.matches)
        ? json.matches
        : [];

    } catch (e) {
      console.warn(
        'Mackolik skorları alınamadı:',
        e
      );

      return [];
    }
  }

  /* =========================================================
     MAÇI HAZIRLA
  ========================================================= */

  function prepareMatch(x, mackolikMatches) {

    const mk = findMackolikMatch(
      x,
      mackolikMatches
    );

    let ft = score(x.scoreFT);

    let ht = score(x.scoreHT);

    /*
      Eğer data.js skor içermiyorsa
      Mackolik'ten al.
    */

    if (!ft && mk) {
      ft = score(
        mk.score ||
        (
          mk.score &&
          mk.score.home !== undefined
            ? mk.score.home + ' - ' + mk.score.away
            : ''
        )
      );
    }

    if (!ht && mk) {
      if (
        mk.halfTimeScore &&
        typeof mk.halfTimeScore === 'object'
      ) {
        ht =
          String(
            mk.halfTimeScore.home ?? ''
          ) +
          ' - ' +
          String(
            mk.halfTimeScore.away ?? ''
          );
      }
    }

    return {
      original: x,
      date: x.date || '',
      day: x.day || '',
      time: x.time || '',
      league: x.league || '',
      home: x.home || '',
      away: x.away || '',
      code: x.code || (mk && mk.code) || '',
      ft: ft,
      ht: ht,
      played: !!ft,
      odds: x.odds || {}
    };
  }

  /* =========================================================
     TARİH LİSTESİ
  ========================================================= */

  function buildDateList(data) {

    const select =
      document.getElementById('tdDate');

    if (!select) return;

    const dates = Array.from(
      new Set(
        data
          .map(function (x) {
            return String(x.date || '');
          })
          .filter(function (d) {
            return (
              d &&
              d >= START
            );
          })
      )
    ).sort();

    const oldValue =
      select.value;

    select.innerHTML = '';

    dates.forEach(function (date) {

      const option =
        document.createElement('option');

      option.value = date;

      option.textContent =
        formatDate(date);

      select.appendChild(option);
    });

    if (
      oldValue &&
      dates.includes(oldValue)
    ) {
      select.value = oldValue;
    } else if (
      dates.includes(getToday())
    ) {
      select.value = getToday();
    } else if (dates.length) {
      select.value = dates[dates.length - 1];
    }

    selectedDate = select.value;
  }

  function formatDate(date) {

    const p =
      String(date).split('-');

    if (p.length !== 3) {
      return date;
    }

    return (
      p[2] +
      '.' +
      p[1] +
      '.' +
      p[0]
    );
  }

  /* =========================================================
     CSS
  ========================================================= */

  function addCSS() {

    if (
      document.getElementById(
        'bugun-css'
      )
    ) return;

    const style =
      document.createElement('style');

    style.id =
      'bugun-css';

    style.textContent = `
      #todaySection {
        padding: 10px;
      }

      .td-controls {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }

      .td-controls select,
      .td-controls input {
        width: 100%;
        box-sizing: border-box;
        padding: 11px;
        border-radius: 10px;
        border: 1px solid #ccc;
        background: #fff;
        font-size: 14px;
      }

      .td-count {
        margin: 8px 0 12px;
        font-size: 13px;
        opacity: .75;
      }

      .td-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .td-match {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 12px;
        padding: 10px;
        box-shadow: 0 1px 4px rgba(0,0,0,.06);
      }

      .td-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #777;
        margin-bottom: 7px;
      }

      .td-league {
        font-weight: 600;
      }

      .td-time {
        white-space: nowrap;
      }

      .td-teams {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 8px;
      }

      .td-team {
        font-weight: 700;
        font-size: 14px;
        line-height: 1.25;
      }

      .td-team.away {
        text-align: right;
      }

      .td-score {
        min-width: 55px;
        text-align: center;
        font-weight: 800;
        font-size: 16px;
      }

      .td-unplayed {
        color: #888;
        font-size: 11px;
        font-weight: 600;
      }

      .td-ht {
        text-align: center;
        margin-top: 6px;
        font-size: 11px;
        color: #888;
      }

      .td-empty {
        padding: 20px 10px;
        text-align: center;
        border: 1px dashed #ccc;
        border-radius: 10px;
        color: #777;
      }

      @media (min-width: 600px) {
        .td-controls {
          grid-template-columns: 220px 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     HTML
  ========================================================= */

  function createSection() {

    let section =
      document.getElementById(
        'todaySection'
      );

    if (section) return section;

    section =
      document.createElement('section');

    section.id =
      'todaySection';

    section.innerHTML = `
      <div class="td-controls">

        <select id="tdDate">
          <option value="">
            Tarih seç
          </option>
        </select>

        <input
          id="tdSearch"
          type="search"
          placeholder="Takım veya lig ara..."
        >

      </div>

      <div
        id="tdCount"
        class="td-count"
      ></div>

      <div
        id="tdList"
        class="td-list"
      ></div>
    `;

    const main =
      document.querySelector('main') ||
      document.body;

    main.appendChild(section);

    return section;
  }

  /* =========================================================
     MAÇ KARTI
  ========================================================= */

  function renderMatch(match) {

    const scoreText =
      match.ft
        ? match.ft
        : '<span class="td-unplayed">Oynanmadı</span>';

    let html = `
      <div class="td-match">

        <div class="td-top">
          <span class="td-league">
            ${esc(match.league)}
          </span>

          <span class="td-time">
            ${esc(match.time)}
          </span>
        </div>

        <div class="td-teams">

          <div class="td-team">
            ${esc(match.home)}
          </div>

          <div class="td-score">
            ${scoreText}
          </div>

          <div class="td-team away">
            ${esc(match.away)}
          </div>

        </div>
    `;

    if (match.ht) {
      html += `
        <div class="td-ht">
          İY: ${esc(match.ht)}
        </div>
      `;
    }

    html += `
      </div>
    `;

    return html;
  }

  /* =========================================================
     LİSTEYİ GÖSTER
  ========================================================= */

  async function render() {

    const data =
      getData();

    const list =
      document.getElementById(
        'tdList'
      );

    const count =
      document.getElementById(
        'tdCount'
      );

    const select =
      document.getElementById(
        'tdDate'
      );

    const search =
      document.getElementById(
        'tdSearch'
      );

    if (!list || !select) return;

    const date =
      select.value;

    selectedDate =
      date;

    const query =
      String(
        search
          ? search.value
          : ''
      )
      .toLocaleLowerCase(
        'tr-TR'
      )
      .trim();

    const mackolik =
      await fetchMackolik();

    /*
      ÖNEMLİ:
      Artık !played filtresi YOK.

      Seçilen tarihteki bütün maçlar geliyor.
    */

    let matches =
      data
        .filter(function (x) {

          return (
            String(x.date || '') ===
            String(date)
          );

        })
        .map(function (x) {

          return prepareMatch(
            x,
            mackolik
          );

        });

    /* Arama */
    if (query) {

      matches =
        matches.filter(function (m) {

          const text =
            (
              m.home +
              ' ' +
              m.away +
              ' ' +
              m.league
            )
            .toLocaleLowerCase(
              'tr-TR'
            );

          return text.includes(
            query
          );
        });
    }

    /* Saat sıralaması */
    matches.sort(function (a, b) {

      return String(a.time || '')
        .localeCompare(
          String(b.time || '')
        );
    });

    count.textContent =
      date
        ? (
            formatDate(date) +
            ' — ' +
            matches.length +
            ' maç'
          )
        : '';

    if (!matches.length) {

      list.innerHTML = `
        <div class="td-empty">
          ${date
            ? formatDate(date) +
              ' tarihinde maç bulunamadı.'
            : 'Tarih seçin.'}
        </div>
      `;

      return;
    }

    list.innerHTML =
      matches
        .map(renderMatch)
        .join('');
  }

  /* =========================================================
     BAŞLAT
  ========================================================= */

  async function init() {

    addCSS();

    createSection();

    const data =
      getData();

    if (!data.length) {

      const list =
        document.getElementById(
          'tdList'
        );

      if (list) {
        list.innerHTML = `
          <div class="td-empty">
            Veri yükleniyor...
          </div>
        `;
      }

      setTimeout(
        init,
        1000
      );

      return;
    }

    buildDateList(data);

    const select =
      document.getElementById(
        'tdDate'
      );

    const search =
      document.getElementById(
        'tdSearch'
      );

    if (select) {
      select.addEventListener(
        'change',
        render
      );
    }

    if (search) {
      search.addEventListener(
        'input',
        render
      );
    }

    await render();
  }

  /* =========================================================
     SAYFA HAZIR OLUNCA ÇALIŞTIR
  ========================================================= */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init
    );

  } else {

    init();

  }

})();
