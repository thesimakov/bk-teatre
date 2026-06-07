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

  /* ============================================================ EVENTS */
  // tabs
  const TITLES = { overview: "Обзор", prices: "Цены", analytics: "Аналитика", ledger: "Бухгалтерия" };
  $("#sideNav").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-tab]");
    if (!a) return;
    e.preventDefault();
    const tab = a.dataset.tab;
    $$("#sideNav a").forEach(x => x.classList.toggle("active", x === a));
    $$(".tab").forEach(p => (p.hidden = p.dataset.panel !== tab));
    $("#pageTitle").textContent = TITLES[tab];
    // the period status banner reflects overall sales — show on Обзор only
    $("#statusBanner").style.display = tab === "overview" ? "" : "none";
    // refresh the panel being opened so edits made elsewhere propagate
    if (tab === "overview")  renderOverview();
    if (tab === "analytics") renderAnalytics();
    if (tab === "prices")    renderPrices();
    if (tab === "ledger")    renderLedger();
  });

  // period
  $("#period").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-p]");
    if (!btn) return;
    curPeriod = btn.dataset.p;
    $$("#period button").forEach(b => b.classList.toggle("active", b === btn));
    renderOverview();
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
  renderLedger();
})();
