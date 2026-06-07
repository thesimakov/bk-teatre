/* ============================================================
   ТБДТ · Кабинет администратора (demo) — interaction logic
   Pure-JS dashboard: KPIs, finance status, SVG charts,
   live price editor, analytics bars and a ledger.
   All data is illustrative (demo).
   ============================================================ */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rub  = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽";
  const kop  = (n) => (n / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " тыс ₽";
  const pct  = (n) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";

  /* ============================================================ DATA */
  const PERIODS = {
    week: {
      title: "Неделя",
      labels: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
      revenue: [86, 74, 92, 110, 168, 214, 196].map(v => v * 1000),
      avg:     [2100, 1980, 2240, 2310, 2480, 2620, 2550],
      tickets: 612, ticketsPrev: 548,
      occ: 0.79,
    },
    month: {
      title: "Месяц",
      labels: ["1 нед", "2 нед", "3 нед", "4 нед"],
      revenue: [640, 712, 690, 884].map(v => v * 1000),
      avg:     [2180, 2260, 2240, 2410],
      tickets: 2480, ticketsPrev: 2310,
      occ: 0.83,
    },
    season: {
      title: "Сезон",
      labels: ["Окт", "Ноя", "Дек", "Янв", "Фев", "Мар", "Апр", "Май"],
      revenue: [1.9, 2.4, 3.6, 2.1, 2.7, 3.1, 2.9, 3.4].map(v => v * 1e6),
      avg:     [2050, 2120, 2480, 2090, 2240, 2360, 2300, 2520],
      tickets: 9120, ticketsPrev: 8430,
      occ: 0.81,
    },
  };

  const ZONES_OCC = [
    { name: "Партер",    pct: 0.90 },
    { name: "Амфитеатр", pct: 0.78 },
    { name: "Балкон",    pct: 0.58 },
    { name: "Ложи",      pct: 0.83 },
  ];

  const CHANNELS = [
    { name: "Сайт театра", val: 0.52 },
    { name: "Касса",       val: 0.24 },
    { name: "Агрегаторы",  val: 0.17 },
    { name: "Промо/пресса",val: 0.07 },
  ];

  // статистика по спектаклям репертуара (demo)
  const PLAY_STATS = [
    { title: "Прощальные гастроли", shows: 6, tickets: 3120, revenue: 7_480_000, occ: 0.92 },
    { title: "Гамлет",              shows: 4, tickets: 1840, revenue: 4_120_000, occ: 0.81 },
    { title: "Чайка",               shows: 3, tickets: 1290, revenue: 2_640_000, occ: 0.74 },
    { title: "Вишнёвый сад",        shows: 3, tickets: 1110, revenue: 2_180_000, occ: 0.69 },
    { title: "Ревизор",             shows: 2, tickets: 560,  revenue: 980_000,   occ: 0.63 },
    { title: "Щелкунчик",           shows: 2, tickets: 720,  revenue: 1_260_000, occ: 0.88 },
  ];
  let ovMode = "general"; // режим Обзора: general | plays

  // editable price tiers
  let TIERS = [
    { zone: "Партер",    color: "#e0533f", seats: 166, sold: 150, price: 3500 },
    { zone: "Амфитеатр", color: "#46c35a", seats: 300, sold: 220, price: 2200 },
    { zone: "Балкон",    color: "#3f8fe0", seats: 120, sold: 70,  price: 1200 },
    { zone: "Ложа",      color: "#e04f8c", seats: 24,  sold: 20,  price: 5000 },
  ];
  const PLAN = 1_150_000; // план выручки на сезон, ₽
  const EXTRA_PALETTE = ["#8ce05f", "#e9943f", "#46d6e0", "#b7e05f", "#e8c63f"];

  let LEDGER = [
    { date: "01.06", op: "Продажа билетов · онлайн",   cat: "Касса",     amount: 318_400, type: "income" },
    { date: "02.06", op: "Аренда сцены · репетиции",   cat: "Постановка",amount: -64_000, type: "expense" },
    { date: "03.06", op: "Продажа билетов · касса",    cat: "Касса",     amount: 142_900, type: "income" },
    { date: "03.06", op: "Гонорары артистов",          cat: "Зарплата",  amount: -210_000,type: "expense" },
    { date: "04.06", op: "Реклама · соцсети",          cat: "Маркетинг", amount: -38_500, type: "expense" },
    { date: "05.06", op: "Продажа билетов · агрегаторы",cat: "Партнёры", amount: 96_700,  type: "income" },
    { date: "06.06", op: "Костюмы и реквизит",         cat: "Постановка",amount: -52_300, type: "expense" },
    { date: "07.06", op: "Продажа билетов · онлайн",   cat: "Касса",     amount: 274_100, type: "income" },
  ];
  const EXPENSE_POOL = [
    { op: "Свет и звук · подрядчик", cat: "Техника",   amount: -47_800 },
    { op: "Типография · программки", cat: "Маркетинг", amount: -18_200 },
    { op: "Транспорт декораций",     cat: "Логистика", amount: -29_400 },
    { op: "Клининг зала",            cat: "Сервис",    amount: -12_600 },
  ];
  let expenseIdx = 0;

  let curPeriod = "month";

  /* repertoire: theatre performances catalogue (demo) */
  const STATUS_LABEL = { sale: "В продаже", soon: "Скоро", archive: "Архив" };
  let EVENTS = [
    { title: "Гамлет",        genre: "Трагедия", date: "2026-06-12", hall: "Большой зал", age: "16+", status: "sale" },
    { title: "Чайка",         genre: "Комедия",  date: "2026-06-18", hall: "Большой зал", age: "12+", status: "soon" },
    { title: "Вишнёвый сад",  genre: "Драма",    date: "2026-06-25", hall: "Большой зал", age: "12+", status: "sale" },
    { title: "Щелкунчик",     genre: "Балет",    date: "2026-07-03", hall: "Большой зал", age: "0+",  status: "soon" },
  ];
  const EVENT_HUES = [["#2c2e5c", "#5b5fae"], ["#a8810f", "#f5cd33"], ["#7a2f4f", "#e04f8c"], ["#1f5a4c", "#46c35a"], ["#7a3a1f", "#e9943f"]];

  /* troupe: theatre ensemble — salary, per-show fee, repertoire load (demo) */
  const ACTOR_MAX_LOAD = 12; // спектаклей = 100% занятости
  let ACTORS = [
    { name: "Аркадий Светлов",   role: "Ведущий мастер сцены", salary: 118000, fee: 12000, shows: 11 },
    { name: "Вера Кольцова",     role: "Ведущий мастер сцены", salary: 112000, fee: 11000, shows: 10 },
    { name: "Михаил Дорохов",    role: "Артист драмы",         salary: 86000,  fee: 8000,  shows: 9  },
    { name: "Ольга Закревская",  role: "Артистка драмы",       salary: 84000,  fee: 7500,  shows: 8  },
    { name: "Игорь Бельский",    role: "Характерный актёр",    salary: 78000,  fee: 7000,  shows: 7  },
    { name: "Наталья Гордеева",  role: "Артистка драмы",       salary: 72000,  fee: 6500,  shows: 6  },
    { name: "Павел Ермаков",     role: "Артист драмы",         salary: 68000,  fee: 6000,  shows: 5  },
    { name: "Лидия Воронцова",   role: "Артистка драмы",       salary: 64000,  fee: 5500,  shows: 6  },
    { name: "Семён Рябинин",     role: "Характерный актёр",    salary: 62000,  fee: 5000,  shows: 4  },
    { name: "Анна Левитина",     role: "Артистка драмы",       salary: 58000,  fee: 4800,  shows: 3  },
    { name: "Тимур Аскаров",     role: "Артист вспом. состава",salary: 46000,  fee: 3500,  shows: 3  },
    { name: "Дарья Соловьёва",   role: "Артист вспом. состава",salary: 44000,  fee: 3200,  shows: 2  },
  ];

  /* hall rental: guest tours & commercial bookings on a Gantt timeline (demo) */
  const RENTAL_MONTH = { label: "июнь 2026", days: 30 };
  const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const RENTAL_MONTH_IDX = 5; // июнь
  const RENTAL_TYPE = { own: "Свой спектакль", tour: "Гастроли", rent: "Аренда" };
  const RENTAL_STATUS = { confirmed: "Подтверждено", option: "Бронь", request: "Запрос" };
  // единый график занятости залов: свои спектакли + гастроли + коммерческая аренда.
  // пустые промежутки = свободные даты, куда можно поставить аренду.
  let RENTALS = [
    // ── свои спектакли театра ──
    { org: "ТБДТ · свой репертуар",           title: "Прощальные гастроли",  hall: "Большой зал", start: 8,  days: 1, type: "own",  amount: 0,      status: "confirmed" },
    { org: "ТБДТ · свой репертуар",           title: "Гамлет",               hall: "Большой зал", start: 14, days: 1, type: "own",  amount: 0,      status: "confirmed" },
    { org: "ТБДТ · свой репертуар",           title: "Чайка",                hall: "Большой зал", start: 26, days: 1, type: "own",  amount: 0,      status: "confirmed" },
    { org: "ТБДТ · свой репертуар",           title: "Ревизор",              hall: "Малая сцена", start: 5,  days: 1, type: "own",  amount: 0,      status: "confirmed" },
    { org: "ТБДТ · свой репертуар",           title: "Вишнёвый сад",         hall: "Малая сцена", start: 14, days: 1, type: "own",  amount: 0,      status: "confirmed" },
    { org: "ТБДТ · свой репертуар",           title: "Щелкунчик",            hall: "Малая сцена", start: 27, days: 1, type: "own",  amount: 0,      status: "confirmed" },
    // ── гастроли других театров ──
    { org: "Малый театр (Москва)",            title: "«Горе от ума»",        hall: "Большой зал", start: 3,  days: 2, type: "tour", amount: 420000, status: "confirmed" },
    { org: "Коляда-Театр (Екатеринбург)",     title: "«Ревизор»",            hall: "Большой зал", start: 10, days: 3, type: "tour", amount: 510000, status: "confirmed" },
    { org: "БДТ им. Товстоногова (СПб)",       title: "Гастроли · «Гроза»",   hall: "Большой зал", start: 19, days: 4, type: "tour", amount: 680000, status: "option" },
    // ── коммерческая аренда / мероприятия ──
    { org: "ПАО «СибурТюмень»",               title: "Корпоративный вечер",  hall: "Большой зал", start: 16, days: 1, type: "rent", amount: 280000, status: "confirmed" },
    { org: "Студия «Новая сцена»",            title: "Фестиваль моноспектаклей", hall: "Малая сцена", start: 10, days: 2, type: "rent", amount: 120000, status: "confirmed" },
    { org: "Тюменский гос. университет",       title: "Вручение дипломов",    hall: "Малая сцена", start: 19, days: 1, type: "rent", amount: 90000,  status: "option" },
    { org: "Школа танца «Ритм»",              title: "Отчётный концерт",     hall: "Малая сцена", start: 23, days: 1, type: "rent", amount: 70000,  status: "request" },
    { org: "Тюменская филармония",            title: "Симфонический вечер",  hall: "Большой зал", start: 28, days: 1, type: "rent", amount: 160000, status: "confirmed" },
  ];

  /* halls: each cell holds a tier index, or -1 for unassigned */
  function seedCells(rows, cols, plan) {
    const cells = new Array(rows * cols).fill(-1);
    if (plan) for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) cells[r * cols + c] = plan(r, c, rows, cols);
    return cells;
  }
  const HALLS = [
    {
      name: "Большой зал", rows: 9, cols: 18,
      cells: seedCells(9, 18, (r, c, rows, cols) => {
        const centre = 1 - Math.abs(c - (cols - 1) / 2) / ((cols - 1) / 2);
        if (r < 2) return 0;                 // первые ряды — Партер (дорогой)
        if (r < 5) return centre > .5 ? 1 : 2;
        return 3;                            // дальние ряды — Балкон
      }),
    },
    {
      name: "Малая сцена", rows: 6, cols: 12,
      cells: seedCells(6, 12, (r) => (r < 2 ? 0 : r < 4 ? 1 : 3)),
    },
  ];
  let curHall = 0;
  let activeTier = 0;        // index into TIERS, or -1 = eraser
  let painting = false;

  /* ============================================================ SVG CHART */
  function lineChart(values, labels, color, fmtY) {
    const W = 660, H = 250, pL = 52, pR = 14, pT = 18, pB = 30;
    const plotW = W - pL - pR, plotH = H - pT - pB;
    const max = Math.max(...values) * 1.12 || 1;
    const n = values.length;
    const X = (i) => pL + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
    const Y = (v) => pT + plotH * (1 - v / max);

    let grid = "", yLab = "", xLab = "";
    for (let g = 0; g <= 4; g++) {
      const gy = pT + (plotH * g) / 4;
      const gv = max * (1 - g / 4);
      grid += `<line class="grid" x1="${pL}" y1="${gy.toFixed(1)}" x2="${W - pR}" y2="${gy.toFixed(1)}"/>`;
      yLab += `<text class="axis" x="${pL - 8}" y="${(gy + 3).toFixed(1)}" text-anchor="end">${fmtY(gv)}</text>`;
    }
    labels.forEach((l, i) => {
      xLab += `<text class="axis" x="${X(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${l}</text>`;
    });

    const pts = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const area = `M ${pL},${pT + plotH} L ${values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L ")} L ${W - pR},${pT + plotH} Z`;
    const maxI = values.indexOf(Math.max(...values));
    const dots = values.map((v, i) =>
      `<circle class="${i === maxI ? "dot-hi" : "dot"}" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === maxI ? 5 : 3.4}"/>`
    ).join("");

    return `<svg viewBox="0 0 ${W} ${H}" role="img">
      <defs>
        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".26"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}${yLab}
      <path class="area-fill" d="${area}"/>
      <polyline class="line" points="${pts}" style="stroke:${color}"/>
      ${dots}${xLab}
    </svg>`;
  }

  function gauge(p) {
    const r = 66, c = 2 * Math.PI * r, off = c * (1 - p);
    return `<svg viewBox="0 0 170 170">
      <defs><linearGradient id="gradGauge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f5cd33"/><stop offset="100%" stop-color="#a8810f"/>
      </linearGradient></defs>
      <g transform="rotate(-90 85 85)">
        <circle class="g-track" cx="85" cy="85" r="${r}"/>
        <circle class="g-fill" cx="85" cy="85" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </g>
      <text class="g-val" x="85" y="84" text-anchor="middle" font-size="32">${Math.round(p * 100)}%</text>
      <text class="g-cap" x="85" y="104" text-anchor="middle">заполнено</text>
    </svg>`;
  }

  /* ============================================================ RENDER: OVERVIEW */
  function renderOverview() {
    const d = PERIODS[curPeriod];
    const total = d.revenue.reduce((a, b) => a + b, 0);
    // synthesise a previous-period total (~ from tickets ratio) for deltas
    const prevTotal = total * (d.ticketsPrev / d.tickets);
    const revDelta = ((total - prevTotal) / prevTotal) * 100;
    const tickDelta = ((d.tickets - d.ticketsPrev) / d.ticketsPrev) * 100;
    const avgCheck = total / d.tickets;
    const avgPrev = prevTotal / d.ticketsPrev;
    const avgDelta = ((avgCheck - avgPrev) / avgPrev) * 100;
    const occDelta = (d.occ - 0.76) * 100; // vs baseline 76%

    const kpis = [
      { label: "Выручка",        val: kop(total),        delta: revDelta },
      { label: "Продано билетов", val: d.tickets.toLocaleString("ru-RU"), delta: tickDelta },
      { label: "Средний чек",    val: rub(avgCheck),     delta: avgDelta },
      { label: "Заполняемость",  val: Math.round(d.occ * 100) + "%", delta: occDelta },
    ];
    $("#kpis").innerHTML = kpis.map(k => {
      const up = k.delta >= 0;
      return `<div class="kpi">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${k.val}</div>
        <span class="kpi-delta ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${pct(k.delta)}</span>
      </div>`;
    }).join("");

    // status banner (driven by revenue delta)
    setBanner(revDelta);

    // revenue chart
    $("#revTotal").textContent = kop(total);
    $("#revChart").innerHTML = lineChart(d.revenue, d.labels, "#2c2e5c", kop);

    // occupancy
    $("#occGauge").innerHTML = gauge(d.occ);
    $("#occList").innerHTML = ZONES_OCC.map(z =>
      `<li>${z.name} <b>${Math.round(z.pct * 100)}%</b></li>`).join("");
  }

  function setBanner(delta) {
    const up = delta >= 0;
    const b = $("#statusBanner");
    b.dataset.state = up ? "up" : "down";
    $("#sbMark").textContent = up ? "▲" : "▼";
    $("#sbTitle").textContent = up ? "Продажи растут" : "Просадка продаж";
    $("#sbDesc").textContent = up
      ? "Выручка выше прошлого периода — спектакль уверенно собирает зал."
      : "Выручка ниже прошлого периода — стоит усилить промо и пересмотреть цены.";
    $("#sbValue").textContent = pct(delta);
  }

  /* ============================================================ RENDER: OVERVIEW · BY PLAY */
  function renderPlays() {
    const totalRev   = PLAY_STATS.reduce((a, p) => a + p.revenue, 0);
    const totalTick  = PLAY_STATS.reduce((a, p) => a + p.tickets, 0);
    const totalShows = PLAY_STATS.reduce((a, p) => a + p.shows, 0);
    const avgOcc     = PLAY_STATS.reduce((a, p) => a + p.occ, 0) / (PLAY_STATS.length || 1);

    const kpis = [
      { label: "Спектаклей",   val: PLAY_STATS.length },
      { label: "Показов",      val: totalShows },
      { label: "Билетов",      val: totalTick.toLocaleString("ru-RU") },
      { label: "Сборы",        val: kop(totalRev) },
    ];
    $("#playKpis").innerHTML = kpis.map(k => `
      <div class="kpi">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${k.val}</div>
      </div>`).join("");

    $("#playsTotal").textContent = `${PLAY_STATS.length} спект. · ${kop(totalRev)}`;

    const maxRev = Math.max(...PLAY_STATS.map(p => p.revenue)) || 1;
    const sorted = [...PLAY_STATS].sort((a, b) => b.revenue - a.revenue);
    $("#playsBody").innerHTML = sorted.map(p => {
      const avg = p.tickets ? p.revenue / p.tickets : 0;
      const occCls = p.occ >= 0.8 ? "income" : p.occ >= 0.6 ? "soon" : "expense";
      return `<tr>
        <td><span class="play-name"><span class="play-dot" style="width:${Math.max(8, p.revenue / maxRev * 100).toFixed(0)}%"></span>${p.title}</span></td>
        <td class="num">${p.shows}</td>
        <td class="num">${p.tickets.toLocaleString("ru-RU")}</td>
        <td class="num">${rub(p.revenue)}</td>
        <td class="num">${rub(avg)}</td>
        <td>
          <div class="load-cell">
            <span class="load-track"><span class="load-fill" style="width:${Math.round(p.occ * 100)}%"></span></span>
            <span class="load-meta"><b>${Math.round(p.occ * 100)}%</b> · <em class="load-badge ${occCls}">${p.occ >= 0.8 ? "высокая" : p.occ >= 0.6 ? "средняя" : "низкая"}</em></span>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  // render the active sub-view of the Обзор tab
  function renderOverviewTab() {
    if (ovMode === "plays") renderPlays();
    else renderOverview();
  }

  /* ============================================================ RENDER: ANALYTICS */
  function renderAnalytics() {
    const d = PERIODS[curPeriod];
    const avgNow = d.avg[d.avg.length - 1];
    $("#avgTotal").textContent = rub(avgNow);
    $("#avgChart").innerHTML = lineChart(d.avg, d.labels, "#a8810f", rub);

    // revenue by zone (from current tiers)
    const zoneRev = TIERS.map(t => ({ name: t.zone, val: t.price * t.sold, color: t.color }));
    const maxZ = Math.max(...zoneRev.map(z => z.val)) || 1;
    $("#zoneBars").innerHTML = zoneRev.map(z =>
      `<li>
        <span class="zb-name">${z.name}</span>
        <span class="zb-track"><span class="zb-fill" style="width:${(z.val / maxZ * 100).toFixed(1)}%;background:linear-gradient(90deg,${z.color},${z.color})"></span></span>
        <span class="zb-val">${kop(z.val)}</span>
      </li>`).join("");

    $("#channelBars").innerHTML = CHANNELS.map(c =>
      `<li>
        <span class="zb-name">${c.name}</span>
        <span class="zb-track"><span class="zb-fill" style="width:${(c.val * 100).toFixed(0)}%"></span></span>
        <span class="zb-val">${Math.round(c.val * 100)}%</span>
      </li>`).join("");
  }

  /* ============================================================ RENDER: PRICES */
  function renderPrices() {
    $("#priceBody").innerHTML = TIERS.map((t, i) => `
      <tr data-i="${i}">
        <td><span class="zone-name"><span class="zone-dot" style="background:${t.color}"></span>${t.zone}</span></td>
        <td><span class="zone-dot" style="background:${t.color};display:inline-block"></span></td>
        <td class="num">${t.seats}</td>
        <td class="num">${t.sold}</td>
        <td class="num"><input class="price-input" type="number" min="0" step="100" value="${t.price}" data-i="${i}" aria-label="Цена ${t.zone}"/></td>
        <td class="num cell-sum">${rub(t.price * t.sold)}</td>
        <td class="num"><button class="row-rm" data-i="${i}" aria-label="Удалить тариф" title="Удалить">✕</button></td>
      </tr>`).join("");

    const projected = TIERS.reduce((a, t) => a + t.price * t.sold, 0);
    $("#projRevenue").textContent = rub(projected);
    $("#planRevenue").textContent = rub(PLAN);

    const delta = ((projected - PLAN) / PLAN) * 100;
    const up = projected >= PLAN;
    const st = $("#priceStatus");
    st.dataset.state = up ? "up" : "down";
    $("#priceStatusText").textContent = up
      ? `Успех · прогноз выше плана на ${pct(delta).replace("+", "")}`
      : `Просадка · прогноз ниже плана на ${pct(delta).replace("-", "")}`;

    // keep analytics zone-revenue in sync
    renderAnalytics();
  }

  /* ============================================================ RENDER: LEDGER */
  function renderLedger() {
    const income = LEDGER.filter(e => e.type === "income").reduce((a, e) => a + e.amount, 0);
    const expense = LEDGER.filter(e => e.type === "expense").reduce((a, e) => a + e.amount, 0);
    const profit = income + expense;

    $("#ledgerSum").innerHTML = `
      <div class="ls-card income"><span>Доходы</span><b>${rub(income)}</b></div>
      <div class="ls-card expense"><span>Расходы</span><b>${rub(expense)}</b></div>
      <div class="ls-card profit"><span>Прибыль</span><b>${rub(profit)}</b></div>`;

    $("#ledgerBody").innerHTML = LEDGER.map(e => `
      <tr>
        <td>${e.date}</td>
        <td style="color:var(--ink);font-weight:600">${e.op}</td>
        <td>${e.cat}</td>
        <td class="num ${e.amount >= 0 ? "amount-pos" : "amount-neg"}">${e.amount >= 0 ? "+" : "−"} ${rub(Math.abs(e.amount))}</td>
        <td><span class="badge ${e.type}">${e.type === "income" ? "Доход" : "Расход"}</span></td>
      </tr>`).join("");
  }

  /* ============================================================ RENDER: HALLS */
  const tierAt = (i) => (i >= 0 && i < TIERS.length ? TIERS[i] : null);

  function renderPalette() {
    const chips = TIERS.map((t, i) =>
      `<button class="pal-chip${i === activeTier ? " active" : ""}" data-t="${i}">
         <span class="pc-sw" style="background:${t.color}"></span>${t.zone} · ${rub(t.price)}
       </button>`).join("");
    const eraser =
      `<button class="pal-chip eraser${activeTier === -1 ? " active" : ""}" data-t="-1">
         <span class="pc-sw"></span>Ластик</button>`;
    $("#palette").innerHTML = chips + eraser;
  }

  function renderHallSelect() {
    $("#hallSelect").innerHTML = HALLS.map((h, i) =>
      `<option value="${i}"${i === curHall ? " selected" : ""}>${h.name} · ${h.rows}×${h.cols}</option>`).join("");
  }

  function renderGrid() {
    const h = HALLS[curHall];
    let html = "";
    for (let r = 0; r < h.rows; r++) {
      let row = `<div class="sg-row"><span class="sg-rlabel">${r + 1}</span>`;
      for (let c = 0; c < h.cols; c++) {
        const idx = r * h.cols + c;
        const t = tierAt(h.cells[idx]);
        const style = t ? `background:${t.color}` : "";
        const title = t ? `${t.zone} · ${rub(t.price)}` : "не назначено";
        row += `<button class="sg-cell${t ? " set" : ""}" data-i="${idx}" style="${style}" title="${title}" aria-label="ряд ${r + 1}, место ${c + 1}"></button>`;
      }
      html += row + `</div>`;
    }
    $("#seatGrid").innerHTML = html;
  }

  function renderHallSummary() {
    const h = HALLS[curHall];
    const counts = {};
    h.cells.forEach((ti) => { if (ti >= 0) counts[ti] = (counts[ti] || 0) + 1; });
    const used = Object.keys(counts).map(Number).sort((a, b) => a - b);
    const assigned = used.reduce((a, k) => a + counts[k], 0);
    const potential = used.reduce((a, k) => a + (tierAt(k)?.price || 0) * counts[k], 0);

    const list = used.length
      ? used.map(k => {
          const t = tierAt(k); if (!t) return "";
          return `<li><span class="hs-sw" style="background:${t.color}"></span>
            <span class="hs-name">${t.zone}</span><span class="hs-cnt">${counts[k]} × ${rub(t.price)}</span></li>`;
        }).join("")
      : `<p class="hs-empty">Места ещё не размечены. Выберите тариф и кликайте по сетке.</p>`;

    $("#hallSummary").innerHTML = `
      <h3>${h.name}</h3>
      <p class="hs-meta">${h.rows} рядов · ${h.cols} мест · вместимость ${h.rows * h.cols}</p>
      <ul class="hs-list">${list}</ul>
      <div class="hs-tot">
        <div class="hr"><span>Размечено мест</span><b>${assigned} / ${h.rows * h.cols}</b></div>
        <div class="hr grand"><span>Потенциал зала</span><b>${rub(potential)}</b></div>
      </div>`;
  }

  function renderHalls() {
    renderHallSelect();
    renderPalette();
    renderGrid();
    renderHallSummary();
  }

  function paintCell(cellEl) {
    const idx = +cellEl.dataset.i;
    const h = HALLS[curHall];
    if (h.cells[idx] === activeTier) return;
    h.cells[idx] = activeTier;
    const t = tierAt(activeTier);
    cellEl.style.background = t ? t.color : "";
    cellEl.classList.toggle("set", !!t);
    cellEl.title = t ? `${t.zone} · ${rub(t.price)}` : "не назначено";
    renderHallSummary();
  }

  /* ============================================================ RENDER: RENTAL */
  function rentalHallSelect() {
    const sel = $("#rentalHallSelect");
    if (!sel) return;
    sel.innerHTML = HALLS.map(h => `<option value="${h.name}">${h.name}</option>`).join("");
  }
  function rentalDates(r) {
    const end = r.start + r.days - 1;
    const m = MONTHS_GEN[RENTAL_MONTH_IDX];
    return r.days > 1 ? `${r.start}–${end} ${m}` : `${r.start} ${m}`;
  }

  function renderRental() {
    rentalHallSelect();
    const D = RENTAL_MONTH.days;
    $("#rentalMonth").textContent = RENTAL_MONTH.label;

    // summary
    const total = RENTALS.length;
    const income = RENTALS
      .filter(r => r.status === "confirmed" && r.type !== "own")
      .reduce((a, r) => a + r.amount, 0);
    const primary = HALLS[0] ? HALLS[0].name : "Большой зал";
    const busyPrimary = new Set();
    RENTALS.forEach(r => { if (r.hall === primary) for (let d = r.start; d < r.start + r.days; d++) busyPrimary.add(d); });
    const freePrimary = D - busyPrimary.size;
    $("#rentalSum").innerHTML = `
      <div class="ls-card"><span>Событий в графике</span><b>${total}</b></div>
      <div class="ls-card profit"><span>Доход от аренды</span><b>${rub(income)}</b></div>
      <div class="ls-card"><span>Свободно · ${primary}</span><b>${freePrimary} из ${D} дн</b></div>`;

    // gantt header (day scale)
    let head = `<div class="g-corner">Зал · событие</div><div class="gh-days" style="--d:${D}">`;
    for (let d = 1; d <= D; d++) {
      const wknd = ((d - 1) % 7 === 5 || (d - 1) % 7 === 6); // demo weekend tint
      head += `<div class="gh-day${wknd ? " wknd" : ""}">${d}</div>`;
    }
    head += `</div>`;

    const rowHtml = (r) => {
      const pending = r.status !== "confirmed";
      const cls = `g-bar ${r.type}${pending ? " pending" : ""}`;
      const label = r.title || r.org;
      const tip = `${label} · ${r.hall} · ${rentalDates(r)} · ${RENTAL_TYPE[r.type]} · ${RENTAL_STATUS[r.status]}${r.amount ? " · " + rub(r.amount) : ""}`;
      return `<div class="gantt-row">
        <div class="g-rlabel"><b>${label}</b><small>${RENTAL_TYPE[r.type]} · ${rentalDates(r)}</small></div>
        <div class="g-track" style="--d:${D}">
          <div class="${cls}" style="grid-column:${r.start} / span ${r.days}" title="${tip}">
            <span class="gb-text">${label}</span>
          </div>
        </div>
      </div>`;
    };

    // gantt body grouped by hall — same day in different halls shows as parallel rows
    const hallOrder = HALLS.map(h => h.name);
    RENTALS.forEach(r => { if (!hallOrder.includes(r.hall)) hallOrder.push(r.hall); });
    let body = "";
    hallOrder.forEach(hallName => {
      const items = RENTALS.filter(r => r.hall === hallName).sort((a, b) => a.start - b.start);
      if (!items.length) return;
      body += `<div class="g-group">▦ ${hallName} · ${items.length}</div>`;
      body += items.map(rowHtml).join("");
    });

    $("#rentalGantt").innerHTML = `<div class="gantt-head">${head}</div>${body}`;

    // table
    $("#rentalBody").innerHTML = RENTALS.map((r, i) => `
      <tr data-i="${i}">
        <td style="color:var(--ink);font-weight:600">${r.org}</td>
        <td>${r.title || "—"}</td>
        <td>${r.hall}</td>
        <td>${rentalDates(r)}</td>
        <td><span class="badge ${r.type}">${RENTAL_TYPE[r.type]}</span></td>
        <td class="num">${r.amount ? rub(r.amount) : "—"}</td>
        <td><span class="rstatus" data-state="${r.status}">${RENTAL_STATUS[r.status]}</span></td>
        <td class="num"><button class="row-rm" data-i="${i}" aria-label="Удалить событие" title="Удалить">✕</button></td>
      </tr>`).join("");
  }

  /* ============================================================ RENDER: ACTORS */
  function actorInitials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("");
  }
  function loadLevel(pct) {
    if (pct >= 0.7) return { label: "Высокая", cls: "income" };
    if (pct >= 0.34) return { label: "Средняя", cls: "soon" };
    return { label: "Низкая", cls: "expense" };
  }

  function renderActors() {
    const count = ACTORS.length;
    const payroll = ACTORS.reduce((a, x) => a + x.salary, 0);
    const avgLoad = count ? ACTORS.reduce((a, x) => a + x.shows, 0) / count / ACTOR_MAX_LOAD : 0;

    $("#actorSum").innerHTML = `
      <div class="ls-card"><span>Артистов в труппе</span><b>${count}</b></div>
      <div class="ls-card expense"><span>Фонд окладов · мес</span><b>${rub(payroll)}</b></div>
      <div class="ls-card profit"><span>Средняя занятость</span><b>${Math.round(avgLoad * 100)}%</b></div>`;

    $("#actorBody").innerHTML = ACTORS.map((a, i) => {
      const pct = Math.min(1, a.shows / ACTOR_MAX_LOAD);
      const lvl = loadLevel(pct);
      return `<tr data-i="${i}">
        <td><span class="actor-name"><span class="actor-ava">${actorInitials(a.name)}</span>${a.name}</span></td>
        <td>${a.role}</td>
        <td class="num">${rub(a.salary)}</td>
        <td class="num">${rub(a.fee)}</td>
        <td>
          <div class="load-cell">
            <span class="load-track"><span class="load-fill" style="width:${(pct * 100).toFixed(0)}%"></span></span>
            <span class="load-meta"><b>${a.shows}</b> спект. · <em class="load-badge ${lvl.cls}">${lvl.label}</em></span>
          </div>
        </td>
        <td class="num"><button class="row-rm" data-i="${i}" aria-label="Удалить актёра" title="Удалить">✕</button></td>
      </tr>`;
    }).join("");
  }

  /* ============================================================ RENDER: EVENTS */
  const MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  function fmtEventDate(iso) {
    if (!iso) return "дата уточняется";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return `${d} ${MONTHS_RU[m - 1]} ${y}`;
  }

  function renderEventHallSelect() {
    const sel = $("#eventHallSelect");
    if (!sel) return;
    sel.innerHTML = HALLS.map(h => `<option value="${h.name}">${h.name}</option>`).join("");
  }

  function renderEvents() {
    renderEventHallSelect();
    if (!EVENTS.length) {
      $("#eventsGrid").innerHTML = `<p class="ev-empty">Афиша пуста. Нажмите «Добавить спектакль», чтобы создать первый показ.</p>`;
      return;
    }
    $("#eventsGrid").innerHTML = EVENTS.map((ev, i) => {
      const [c1, c2] = EVENT_HUES[i % EVENT_HUES.length];
      const initial = (ev.title || "?").trim().charAt(0).toUpperCase();
      const st = ev.status || "sale";
      return `<article class="event-card" data-i="${i}">
        <div class="ev-poster" style="background:linear-gradient(135deg,${c1},${c2})">
          <span class="ev-poster-mark" aria-hidden="true">${initial}</span>
          <span class="ev-badge age">${ev.age || "0+"}</span>
          <button class="ev-rm" data-i="${i}" aria-label="Удалить спектакль" title="Удалить">✕</button>
        </div>
        <div class="ev-body">
          <span class="ev-genre">${ev.genre || "Спектакль"}</span>
          <h3 class="ev-title">${ev.title}</h3>
          <dl class="ev-meta">
            <div><dt>Дата</dt><dd>${fmtEventDate(ev.date)}</dd></div>
            <div><dt>Зал</dt><dd>${ev.hall || "—"}</dd></div>
          </dl>
          <span class="ev-status" data-state="${st}"><span class="evs-dot"></span>${STATUS_LABEL[st] || "—"}</span>
        </div>
      </article>`;
    }).join("");
  }

  /* ============================================================ EVENTS */
  // tabs
  const TITLES = { overview: "Обзор", prices: "Цены", halls: "Залы", events: "События", actors: "Актёры", rental: "Аренда зала", analytics: "Аналитика", ledger: "Бухгалтерия" };
  const TAB_RENDER = {
    overview: renderOverviewTab, analytics: renderAnalytics, prices: renderPrices,
    halls: renderHalls, events: renderEvents, actors: renderActors,
    rental: renderRental, ledger: renderLedger,
  };

  // Обзор: переключатель «Общая статистика / По спектаклям»
  $("#ovFilter").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-ov]");
    if (!btn) return;
    ovMode = btn.dataset.ov;
    $$("#ovFilter button").forEach(b => b.classList.toggle("active", b === btn));
    $$('.ov-view').forEach(v => (v.hidden = v.dataset.ov !== ovMode));
    renderOverviewTab();
  });

  /* ---- path-based routing: each section is a direct link like /halls ---- */
  // base directory of the admin page, e.g. "/" or "/bk/"
  const ROUTE_BASE = location.pathname.replace(/[^/]*$/, "");
  const isTab = (t) => !!TITLES[t];
  // last path segment → tab name (e.g. "/bk/halls" → "halls"); admin.html/"" → overview
  function tabFromPath() {
    const seg = decodeURIComponent(location.pathname.split("/").pop() || "");
    return isTab(seg) ? seg : "overview";
  }

  function activateTab(tab) {
    if (!isTab(tab)) tab = "overview";
    $$("#sideNav a").forEach(x => x.classList.toggle("active", x.dataset.tab === tab));
    $$(".tab").forEach(p => (p.hidden = p.dataset.panel !== tab));
    $("#pageTitle").textContent = TITLES[tab];
    // the period status banner reflects overall sales — show on Обзор only
    $("#statusBanner").style.display = tab === "overview" ? "" : "none";
    // refresh the panel being opened so edits made elsewhere propagate
    TAB_RENDER[tab]?.();
  }

  // navigate: push a clean path (/halls) and switch the tab. Falls back to a
  // plain tab switch where the History API is unavailable (e.g. file://).
  function goToTab(tab, replace = false) {
    activateTab(tab);
    try {
      const url = ROUTE_BASE + tab;
      if (replace) history.replaceState({ tab }, "", url);
      else history.pushState({ tab }, "", url);
    } catch (_) { /* file:// — keep working without URL change */ }
  }

  $("#sideNav").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-tab]");
    if (!a) return;
    e.preventDefault();
    goToTab(a.dataset.tab);
  });

  // browser back/forward
  window.addEventListener("popstate", () => activateTab(tabFromPath()));

  // period
  $("#period").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-p]");
    if (!btn) return;
    curPeriod = btn.dataset.p;
    $$("#period button").forEach(b => b.classList.toggle("active", b === btn));
    renderOverviewTab();
    renderAnalytics();
  });

  // price editing (live)
  $("#priceBody").addEventListener("input", (e) => {
    const inp = e.target.closest(".price-input");
    if (!inp) return;
    const i = +inp.dataset.i;
    TIERS[i].price = Math.max(0, +inp.value || 0);
    // update only the row sum + footer without full re-render (keep focus)
    inp.closest("tr").querySelector(".cell-sum").textContent = rub(TIERS[i].price * TIERS[i].sold);
    const projected = TIERS.reduce((a, t) => a + t.price * t.sold, 0);
    $("#projRevenue").textContent = rub(projected);
    const up = projected >= PLAN;
    const delta = ((projected - PLAN) / PLAN) * 100;
    const st = $("#priceStatus");
    st.dataset.state = up ? "up" : "down";
    $("#priceStatusText").textContent = up
      ? `Успех · прогноз выше плана на ${pct(delta).replace("+", "")}`
      : `Просадка · прогноз ниже плана на ${pct(delta).replace("-", "")}`;
  });

  // remove tier
  $("#priceBody").addEventListener("click", (e) => {
    const rm = e.target.closest(".row-rm");
    if (!rm) return;
    if (TIERS.length <= 1) { toast("Нужен хотя бы один тариф"); return; }
    TIERS.splice(+rm.dataset.i, 1);
    renderPrices();
    toast("Тариф удалён");
  });

  // add tier
  $("#addTier").addEventListener("click", () => {
    const n = TIERS.length;
    TIERS.push({
      zone: "Новая зона " + n,
      color: EXTRA_PALETTE[(n - 4 + EXTRA_PALETTE.length) % EXTRA_PALETTE.length] || "#8ce05f",
      seats: 60, sold: 30, price: 2000,
    });
    renderPrices();
    toast("Добавлен новый тариф — задайте цену");
    $("#priceBody tr:last-child .price-input")?.focus();
  });

  // add expense
  $("#addExpense").addEventListener("click", () => {
    const tpl = EXPENSE_POOL[expenseIdx % EXPENSE_POOL.length];
    expenseIdx++;
    const day = 8 + expenseIdx;
    LEDGER.push({ date: `${String(day).padStart(2, "0")}.06`, op: tpl.op, cat: tpl.cat, amount: tpl.amount, type: "expense" });
    renderLedger();
    toast("Расход добавлен в книгу операций");
  });

  // build report — открывает образец PDF-отчёта (книга операций)
  $("#buildReport").addEventListener("click", () => {
    toast("Открываю отчёт (образец PDF)…");
    window.open(ROUTE_BASE + "docs/otchet-buhgalteriya-shablon.pdf", "_blank");
  });

  /* ---- halls: palette select ---- */
  $("#palette").addEventListener("click", (e) => {
    const chip = e.target.closest(".pal-chip");
    if (!chip) return;
    activeTier = +chip.dataset.t;
    $$("#palette .pal-chip").forEach(c => c.classList.toggle("active", c === chip));
  });

  /* ---- halls: paint by click & drag (pointer events: mouse + touch) ---- */
  const grid = $("#seatGrid");
  grid.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest(".sg-cell");
    if (!cell) return;
    painting = true;
    paintCell(cell);
    e.preventDefault();
  });
  grid.addEventListener("pointermove", (e) => {
    if (!painting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest(".sg-cell");
    if (cell) paintCell(cell);
  });
  document.addEventListener("pointerup", () => { painting = false; });
  grid.addEventListener("contextmenu", (e) => e.preventDefault());

  /* ---- halls: switch hall ---- */
  $("#hallSelect").addEventListener("change", (e) => {
    curHall = +e.target.value;
    renderGrid();
    renderHallSummary();
  });

  /* ---- halls: add-hall form ---- */
  $("#newHallBtn").addEventListener("click", () => {
    const f = $("#newHallForm");
    f.hidden = !f.hidden;
    if (!f.hidden) f.name.focus();
  });
  $("#cancelHall").addEventListener("click", () => { $("#newHallForm").hidden = true; });
  $("#newHallForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim() || "Новый зал";
    const rows = Math.max(1, Math.min(24, +f.rows.value || 8));
    const cols = Math.max(1, Math.min(36, +f.cols.value || 16));
    HALLS.push({ name, rows, cols, cells: seedCells(rows, cols) });
    curHall = HALLS.length - 1;
    f.reset(); f.hidden = true;
    renderHalls();
    toast(`Зал «${name}» создан — разметьте тарифы`);
  });

  /* ---- events: toggle add form ---- */
  $("#newEventBtn").addEventListener("click", () => {
    const f = $("#newEventForm");
    renderEventHallSelect();
    f.hidden = !f.hidden;
    if (!f.hidden) f.title.focus();
  });
  $("#cancelEvent").addEventListener("click", () => { $("#newEventForm").hidden = true; });
  $("#newEventForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const title = f.title.value.trim();
    if (!title) { toast("Укажите название спектакля"); return; }
    EVENTS.push({
      title,
      genre: f.genre.value.trim() || "Спектакль",
      date: f.date.value || "",
      hall: f.hall.value || (HALLS[0] && HALLS[0].name) || "—",
      age: f.age.value,
      status: f.status.value,
    });
    f.reset(); f.hidden = true;
    renderEvents();
    toast(`Спектакль «${title}» добавлен в афишу`);
  });

  /* ---- events: remove card ---- */
  $("#eventsGrid").addEventListener("click", (e) => {
    const rm = e.target.closest(".ev-rm");
    if (!rm) return;
    const removed = EVENTS.splice(+rm.dataset.i, 1)[0];
    renderEvents();
    toast(removed ? `Спектакль «${removed.title}» удалён` : "Спектакль удалён");
  });

  /* ---- rental: toggle add form ---- */
  $("#newRentalBtn").addEventListener("click", () => {
    const f = $("#newRentalForm");
    rentalHallSelect();
    f.hidden = !f.hidden;
    if (!f.hidden) f.org.focus();
  });
  $("#cancelRental").addEventListener("click", () => { $("#newRentalForm").hidden = true; });
  $("#newRentalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const org = f.org.value.trim();
    if (!org) { toast("Укажите арендатора"); return; }
    const D = RENTAL_MONTH.days;
    const start = Math.max(1, Math.min(D, +f.start.value || 1));
    RENTALS.push({
      org,
      title: f.title.value.trim(),
      hall: f.hall.value || (HALLS[0] && HALLS[0].name) || "—",
      start,
      days: Math.max(1, Math.min(D - start + 1, +f.days.value || 1)),
      type: f.type.value,
      amount: Math.max(0, +f.amount.value || 0),
      status: f.status.value,
    });
    f.reset(); f.hidden = true;
    renderRental();
    toast(`Бронь «${org}» добавлена в график`);
  });

  /* ---- rental: remove row ---- */
  $("#rentalBody").addEventListener("click", (e) => {
    const rm = e.target.closest(".row-rm");
    if (!rm) return;
    const removed = RENTALS.splice(+rm.dataset.i, 1)[0];
    renderRental();
    toast(removed ? `Бронь «${removed.org}» удалена` : "Бронь удалена");
  });

  /* ---- actors: toggle add form ---- */
  $("#newActorBtn").addEventListener("click", () => {
    const f = $("#newActorForm");
    f.hidden = !f.hidden;
    if (!f.hidden) f.name.focus();
  });
  $("#cancelActor").addEventListener("click", () => { $("#newActorForm").hidden = true; });
  $("#newActorForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    if (!name) { toast("Укажите имя актёра"); return; }
    ACTORS.push({
      name,
      role: f.role.value,
      salary: Math.max(0, +f.salary.value || 0),
      fee: Math.max(0, +f.fee.value || 0),
      shows: Math.max(0, Math.min(20, +f.shows.value || 0)),
    });
    f.reset(); f.hidden = true;
    renderActors();
    toast(`Актёр «${name}» добавлен в труппу`);
  });

  /* ---- actors: remove row ---- */
  $("#actorBody").addEventListener("click", (e) => {
    const rm = e.target.closest(".row-rm");
    if (!rm) return;
    const removed = ACTORS.splice(+rm.dataset.i, 1)[0];
    renderActors();
    toast(removed ? `Актёр «${removed.name}» удалён из труппы` : "Актёр удалён");
  });

  /* ---- toast ---- */
  let tT;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(tT);
    tT = setTimeout(() => el.classList.remove("show"), 2400);
  }

  /* ============================================================ INIT */
  renderOverview();
  renderAnalytics();
  renderPrices();
  renderHalls();
  renderEvents();
  renderActors();
  renderRental();
  renderLedger();

  // open the tab named in the URL (e.g. /rental), default to Обзор, and
  // normalise the address bar to the clean section path
  goToTab(tabFromPath(), true);
})();
