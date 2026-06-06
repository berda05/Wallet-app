/* app.js — UI logika, prikazi, ruteri, modali */
(function () {
  const T = (k) => I18n.t(k);
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  let currentView = "dashboard";

  /* ---------------- formatiranje ---------------- */
  function fmtMoney(v, opts) {
    opts = opts || {};
    const cur = Store.settings.currency;
    const sign = v < 0 ? "-" : (opts.plus && v > 0 ? "+" : "");
    const abs = Math.abs(v);
    const locale = I18n.lang === "sr" ? "sr-RS" : "en-US";
    let num;
    if (cur === "EUR") {
      num = abs.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${sign}${num} €`;
    } else {
      num = Math.round(abs).toLocaleString(locale);
      return `${sign}${num} RSD`;
    }
  }

  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    const months = I18n.months();
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function catLabel(type, id) {
    const c = Store.catById(type, id);
    return T(c.labelKey);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, m =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.classList.add("hidden"), 250);
    }, 1900);
  }

  /* ---------------- tema ---------------- */
  function applyTheme() {
    const t = Store.settings.theme;
    let dark;
    if (t === "dark") dark = true;
    else if (t === "light") dark = false;
    else dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    $("#themeToggle").textContent = dark ? "☀️" : "🌙";
  }

  function cycleTheme() {
    const order = ["auto", "light", "dark"];
    const i = order.indexOf(Store.settings.theme);
    Store.settings.theme = order[(i + 1) % order.length];
    Store.save();
    applyTheme();
  }

  /* ---------------- ruteri ---------------- */
  const TITLES = {
    dashboard: "title.dashboard",
    transactions: "title.transactions",
    bills: "title.bills",
    goals: "title.goals",
    stats: "title.stats"
  };

  function switchView(view) {
    currentView = view;
    $$(".view").forEach(v => v.classList.add("hidden"));
    $("#view-" + view).classList.remove("hidden");
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
    $("#viewTitle").textContent = T(TITLES[view] || "title.dashboard");
    $("#main").scrollTop = 0;
    render();
  }

  /* ---------------- render po prikazu ---------------- */
  function render() {
    applyI18nStatic();
    if (currentView === "dashboard") renderDashboard();
    else if (currentView === "transactions") renderTransactions();
    else if (currentView === "bills") renderBills();
    else if (currentView === "goals") renderGoals();
    else if (currentView === "stats") renderStats();
  }

  function applyI18nStatic() {
    $$("[data-i18n]").forEach(e => { e.textContent = T(e.dataset.i18n); });
    $("#viewTitle").textContent = T(TITLES[currentView] || "title.dashboard");
    document.documentElement.lang = I18n.lang;
  }

  /* ===================================================== DASHBOARD */
  function renderDashboard() {
    const root = $("#view-dashboard");
    const m = Store.monthTotals();
    const balance = Store.totalBalance();
    const canSave = Store.potentialSavings();
    const savingsRate = m.income > 0 ? Math.round((canSave / m.income) * 100) : 0;

    const expCats = Store.expenseByCategory();
    const slices = Object.keys(expCats).map(id => {
      const c = Store.catById("expense", id);
      return { label: catLabel("expense", id), value: expCats[id], color: c.color, icon: c.icon, id };
    }).sort((a, b) => b.value - a.value);

    const hasAny = Store.data.transactions.length > 0;

    root.innerHTML = "";

    // HERO balance card
    const hero = document.createElement("div");
    hero.className = "hero-card";
    hero.innerHTML = `
      <div class="hero-label">${T("dash.balance")}</div>
      <div class="hero-balance">${fmtMoney(balance)}</div>
      <div class="hero-split">
        <div class="hero-stat">
          <span class="hs-ico up">↑</span>
          <div><div class="hs-val">${fmtMoney(m.income)}</div><div class="hs-lbl">${T("dash.income")} · ${T("dash.thisMonth")}</div></div>
        </div>
        <div class="hero-stat">
          <span class="hs-ico down">↓</span>
          <div><div class="hs-val">${fmtMoney(m.expense)}</div><div class="hs-lbl">${T("dash.expense")} · ${T("dash.thisMonth")}</div></div>
        </div>
      </div>`;
    root.appendChild(hero);

    // CAN SAVE card
    const save = document.createElement("div");
    save.className = "card save-card";
    const rateColor = canSave >= 0 ? "var(--green)" : "var(--red)";
    save.innerHTML = `
      <div class="save-top">
        <div>
          <div class="card-sub">${T("dash.canSave")}</div>
          <div class="save-amount" style="color:${rateColor}">${fmtMoney(canSave)}</div>
          <div class="card-hint">${T("dash.canSaveSub")}</div>
        </div>
        <div class="ring" style="--p:${Math.max(0, Math.min(100, savingsRate))}">
          <div class="ring-inner">${savingsRate}%</div>
        </div>
      </div>
      <div class="save-rate-lbl">${T("dash.savingsRate")}</div>`;
    root.appendChild(save);

    if (!hasAny) {
      const empty = emptyState(T("dash.noData"), "💸");
      root.appendChild(empty);
      return;
    }

    // SPENDING by category donut
    if (slices.length) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="card-title">${T("dash.byCategory")}</div>`;
      const flex = document.createElement("div");
      flex.className = "donut-flex";
      const totalExp = slices.reduce((s, x) => s + x.value, 0);
      flex.appendChild(Charts.donut(slices, {
        centerTop: T("dash.expense"),
        centerMain: fmtMoney(totalExp)
      }));
      const legend = document.createElement("div");
      legend.className = "legend";
      slices.slice(0, 6).forEach(s => {
        const pct = totalExp ? Math.round((s.value / totalExp) * 100) : 0;
        const row = document.createElement("div");
        row.className = "legend-row";
        row.innerHTML = `
          <span class="dot" style="background:${s.color}"></span>
          <span class="legend-name">${s.icon} ${escapeHtml(s.label)}</span>
          <span class="legend-val">${fmtMoney(s.value)} <small>${pct}%</small></span>`;
        legend.appendChild(row);
      });
      flex.appendChild(legend);
      card.appendChild(flex);
      root.appendChild(card);
    }

    // 6-month trend
    const months = Store.last6Months();
    if (months.some(x => x.income || x.expense)) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="card-title">${T("dash.trend")}</div>`;
      const groups = months.map(x => ({
        label: I18n.months()[x.month],
        values: [
          { value: x.income, color: "var(--green)" },
          { value: x.expense, color: "var(--red)" }
        ]
      }));
      card.appendChild(Charts.bars(groups, { height: 150 }));
      card.appendChild(legendInline([
        { c: "var(--green)", t: T("dash.income") },
        { c: "var(--red)", t: T("dash.expense") }
      ]));
      root.appendChild(card);
    }

    // upcoming bills
    const unpaid = Store.data.bills
      .filter(b => b.active !== false && b.paidMonth !== Store.nowYM())
      .sort((a, b) => a.dueDay - b.dueDay).slice(0, 3);
    if (unpaid.length) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="card-title-row"><span class="card-title">${T("dash.upcoming")}</span>
        <button class="link-btn" data-goto="bills">${T("dash.seeAll")}</button></div>`;
      unpaid.forEach(b => card.appendChild(billRow(b, true)));
      root.appendChild(card);
    }

    // recent transactions
    const recent = Store.data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    if (recent.length) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="card-title-row"><span class="card-title">${T("dash.recent")}</span>
        <button class="link-btn" data-goto="transactions">${T("dash.seeAll")}</button></div>`;
      recent.forEach(t => card.appendChild(txRow(t)));
      root.appendChild(card);
    }
  }

  function legendInline(items) {
    const d = document.createElement("div");
    d.className = "legend-inline";
    d.innerHTML = items.map(i => `<span><span class="dot" style="background:${i.c}"></span>${i.t}</span>`).join("");
    return d;
  }

  function emptyState(msg, icon) {
    const d = document.createElement("div");
    d.className = "empty-state";
    d.innerHTML = `<div class="empty-ico">${icon || "📭"}</div><div class="empty-msg">${escapeHtml(msg)}</div>`;
    return d;
  }

  /* ---------- row builders ---------- */
  function txRow(t) {
    const c = Store.catById(t.type, t.category);
    const row = document.createElement("div");
    row.className = "list-row tx-row";
    row.innerHTML = `
      <span class="row-ico" style="background:${c.color}22;color:${c.color}">${c.icon}</span>
      <div class="row-mid">
        <div class="row-title">${escapeHtml(t.note || catLabel(t.type, t.category))} ${t.billRef ? `<span class="badge bill">🧾 ${T("tab.bills")}</span>` : ""}</div>
        <div class="row-sub">${catLabel(t.type, t.category)} · ${fmtDate(t.date)}</div>
      </div>
      <div class="row-amt ${t.type}">${fmtMoney(t.type === "income" ? t.amount : -t.amount, { plus: true })}</div>`;
    row.addEventListener("click", () => openTxForm(t));
    return row;
  }

  function billRow(b, compact) {
    const c = Store.catById("expense", b.category);
    const paid = b.paidMonth === Store.nowYM();
    const today = new Date().getDate();
    let status = "", statusCls = "";
    if (!paid) {
      if (b.dueDay < today) { status = T("bills.overdue"); statusCls = "overdue"; }
      else if (b.dueDay - today <= 3) { status = T("bills.dueSoon"); statusCls = "soon"; }
    }
    const row = document.createElement("div");
    row.className = "list-row bill-row" + (paid ? " is-paid" : "");
    row.innerHTML = `
      <span class="row-ico" style="background:${c.color}22;color:${c.color}">${c.icon}</span>
      <div class="row-mid">
        <div class="row-title">${escapeHtml(b.name)} ${status ? `<span class="badge ${statusCls}">${status}</span>` : ""}</div>
        <div class="row-sub">${T("bills.due")}: ${b.dueDay}. ${status === "" && paid ? `· <span class="badge paid">${T("bills.paid")}</span>` : ""}</div>
      </div>
      <div class="row-right">
        <div class="row-amt expense">${fmtMoney(b.amount)}</div>
        ${compact ? "" : `<button class="mini-btn ${paid ? "ghost" : "solid"}" data-pay="${b.id}">${paid ? T("bills.markUnpaid") : T("bills.markPaid")}</button>`}
      </div>`;
    if (compact) {
      row.addEventListener("click", () => switchView("bills"));
    } else {
      row.querySelector(".row-mid").addEventListener("click", () => openBillForm(b));
      row.querySelector(".row-ico").addEventListener("click", () => openBillForm(b));
      const payBtn = row.querySelector("[data-pay]");
      if (payBtn) payBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        Store.toggleBillPaid(b.id);
        toast(T("toast.paid"));
        render();
      });
    }
    return row;
  }

  /* ===================================================== TRANSACTIONS */
  let txFilter = "all";
  let txSearch = "";
  function renderTransactions() {
    const root = $("#view-transactions");
    root.innerHTML = "";

    const controls = document.createElement("div");
    controls.className = "controls";
    controls.innerHTML = `
      <div class="seg">
        <button data-f="all" class="${txFilter === "all" ? "on" : ""}">${T("tx.all")}</button>
        <button data-f="income" class="${txFilter === "income" ? "on" : ""}">${T("tx.income")}</button>
        <button data-f="expense" class="${txFilter === "expense" ? "on" : ""}">${T("tx.expense")}</button>
      </div>
      <input class="search" type="search" placeholder="${T("tx.search")}" value="${escapeHtml(txSearch)}" />`;
    root.appendChild(controls);
    controls.querySelectorAll("[data-f]").forEach(b =>
      b.addEventListener("click", () => { txFilter = b.dataset.f; renderTransactions(); }));
    const search = controls.querySelector(".search");
    search.addEventListener("input", () => { txSearch = search.value; renderTransactionList(root); });

    renderTransactionList(root);
  }

  function renderTransactionList(root) {
    let list = root.querySelector(".tx-list");
    if (list) list.remove();
    list = document.createElement("div");
    list.className = "tx-list";

    let txs = Store.data.transactions.slice();
    if (txFilter !== "all") txs = txs.filter(t => t.type === txFilter);
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      txs = txs.filter(t => (t.note || "").toLowerCase().includes(q) ||
        catLabel(t.type, t.category).toLowerCase().includes(q));
    }
    txs.sort((a, b) => b.date.localeCompare(a.date));

    if (!txs.length) { list.appendChild(emptyState(T("tx.empty"), "💳")); root.appendChild(list); return; }

    // group by date
    const groups = {};
    txs.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
      const dayTotal = groups[date].reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      const head = document.createElement("div");
      head.className = "date-head";
      head.innerHTML = `<span>${fmtDate(date)}</span><span class="${dayTotal >= 0 ? "income" : "expense"}">${fmtMoney(dayTotal, { plus: true })}</span>`;
      list.appendChild(head);
      const card = document.createElement("div");
      card.className = "card list-card";
      groups[date].forEach(t => card.appendChild(txRow(t)));
      list.appendChild(card);
    });
    root.appendChild(list);
  }

  /* ===================================================== BILLS */
  function renderBills() {
    const root = $("#view-bills");
    root.innerHTML = "";
    const total = Store.billsMonthlyTotal();

    const summary = document.createElement("div");
    summary.className = "hero-card compact";
    summary.innerHTML = `<div class="hero-label">${T("bills.monthlyTotal")}</div>
      <div class="hero-balance">${fmtMoney(total)}</div>`;
    root.appendChild(summary);

    const bills = Store.data.bills.slice().sort((a, b) => a.dueDay - b.dueDay);
    if (!bills.length) { root.appendChild(emptyState(T("bills.empty"), "🧾")); return; }

    const card = document.createElement("div");
    card.className = "card list-card";
    bills.forEach(b => card.appendChild(billRow(b, false)));
    root.appendChild(card);
  }

  /* ===================================================== GOALS */
  function renderGoals() {
    const root = $("#view-goals");
    root.innerHTML = "";
    const goals = Store.data.goals.slice();
    if (!goals.length) { root.appendChild(emptyState(T("goals.empty"), "🎯")); return; }

    goals.forEach(g => {
      const saved = g.saved || 0;
      const pct = g.target > 0 ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
      const remaining = Math.max(0, g.target - saved);
      const done = saved >= g.target && g.target > 0;

      let perMonth = "";
      if (g.deadline && remaining > 0) {
        const now = new Date();
        const dl = new Date(g.deadline + "T00:00:00");
        const months = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth()));
        perMonth = `<div class="goal-permonth">${fmtMoney(remaining / months)} ${T("goals.perMonth")}</div>`;
      }

      const card = document.createElement("div");
      card.className = "card goal-card";
      card.innerHTML = `
        <div class="goal-head">
          <div class="goal-name">${escapeHtml(g.name)}</div>
          <button class="icon-btn sm" data-edit-goal="${g.id}">✏️</button>
        </div>
        <div class="goal-amounts">
          <span class="goal-saved">${fmtMoney(saved)}</span>
          <span class="goal-target">/ ${fmtMoney(g.target)}</span>
        </div>
        <div class="progress"><div class="progress-fill ${done ? "done" : ""}" style="width:${pct}%"></div></div>
        <div class="goal-foot">
          <span>${done ? T("goals.done") : `${T("goals.remaining")}: ${fmtMoney(remaining)}`}</span>
          <span class="goal-pct">${pct}%</span>
        </div>
        ${perMonth}
        ${g.deadline ? `<div class="goal-deadline">${T("goals.deadline")}: ${fmtDate(g.deadline)}</div>` : ""}
        <button class="btn-secondary full" data-fund="${g.id}">+ ${T("goals.addFunds")}</button>`;
      root.appendChild(card);

      card.querySelector("[data-edit-goal]").addEventListener("click", () => openGoalForm(g));
      card.querySelector("[data-fund]").addEventListener("click", () => openFundForm(g));
    });
  }

  /* ===================================================== STATS */
  function renderStats() {
    const root = $("#view-stats");
    root.innerHTML = "";
    // (Stats reachable via dashboard; kept for completeness)
    const expCats = Store.byCategory("expense", Store.nowYM());
    const slices = Object.keys(expCats).map(id => {
      const c = Store.catById("expense", id);
      return { label: catLabel("expense", id), value: expCats[id], color: c.color, icon: c.icon };
    }).sort((a, b) => b.value - a.value);
    if (slices.length) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="card-title">${T("stats.expenseByCat")}</div>`;
      card.appendChild(Charts.donut(slices, { centerMain: fmtMoney(slices.reduce((s, x) => s + x.value, 0)) }));
      root.appendChild(card);
    } else {
      root.appendChild(emptyState(T("dash.noData"), "📊"));
    }
  }

  /* ===================================================== MODAL CORE */
  function openModal(html) {
    const sheet = $("#modalSheet");
    sheet.innerHTML = html;
    // dugme za zatvaranje (X)
    const close = document.createElement("button");
    close.className = "sheet-close";
    close.setAttribute("aria-label", "Zatvori");
    close.innerHTML = "&times;";
    close.addEventListener("click", closeModal);
    sheet.appendChild(close);
    // reset eventualnih inline stilova od prethodnog prevlacenja
    sheet.style.transition = "";
    sheet.style.transform = "";
    sheet.scrollTop = 0;
    $("#modalBackdrop").classList.remove("hidden");
    requestAnimationFrame(() => {
      $("#modalBackdrop").classList.add("show");
      sheet.classList.add("show");
    });
    attachSheetDrag(sheet);
    return sheet;
  }

  function closeModal() {
    const sheet = $("#modalSheet");
    sheet.style.transition = "";
    sheet.style.transform = "";
    sheet.classList.remove("show");
    $("#modalBackdrop").classList.remove("show");
    setTimeout(() => { $("#modalBackdrop").classList.add("hidden"); sheet.innerHTML = ""; }, 280);
  }

  // Prevlacenje panela na dole za zatvaranje (samo sa gornje "ручке"/naslova)
  function attachSheetDrag(sheet) {
    let startY = 0, dy = 0, dragging = false;
    function onStart(e) {
      if (!e.target.closest(".sheet-handle, .sheet-title")) return;
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      dragging = true; dy = 0;
      sheet.style.transition = "none";
    }
    function onMove(e) {
      if (!dragging) return;
      const y = (e.touches ? e.touches[0].clientY : e.clientY);
      dy = Math.max(0, y - startY);
      if (dy > 0) {
        if (e.cancelable) e.preventDefault();
        sheet.style.transform = "translateY(" + dy + "px)";
      }
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = "";
      if (dy > 90) { closeModal(); }
      else { sheet.style.transform = ""; }
    }
    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("mousedown", onStart);
    sheet.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
  }

  /* ---------- chooser when pressing + ---------- */
  function openAddChooser() {
    const html = `
      <div class="sheet-handle"></div>
      <div class="sheet-title">${T("form.chooseAddType")}</div>
      <div class="chooser">
        <button class="chooser-btn" data-add="tx"><span class="chooser-ico">💳</span><span>${T("form.newTx")}</span></button>
        <button class="chooser-btn" data-add="bill"><span class="chooser-ico">🧾</span><span>${T("form.newBill")}</span></button>
        <button class="chooser-btn" data-add="goal"><span class="chooser-ico">🎯</span><span>${T("form.newGoal")}</span></button>
      </div>`;
    const sheet = openModal(html);
    sheet.querySelector('[data-add="tx"]').addEventListener("click", () => openTxForm());
    sheet.querySelector('[data-add="bill"]').addEventListener("click", () => openBillForm());
    sheet.querySelector('[data-add="goal"]').addEventListener("click", () => openGoalForm());
  }

  /* ---------- transaction form ---------- */
  function openTxForm(tx) {
    const editing = !!tx;
    let type = tx ? tx.type : "expense";
    let category = tx ? tx.category : "food";

    function catGrid() {
      return Store.CATEGORIES[type].map(c =>
        `<button type="button" class="cat-chip ${c.id === category ? "on" : ""}" data-cat="${c.id}" style="--cc:${c.color}">
          <span class="cat-chip-ico">${c.icon}</span><span>${T(c.labelKey)}</span>
        </button>`).join("");
    }

    const html = `
      <div class="sheet-handle"></div>
      <div class="sheet-title">${editing ? T("form.editTx") : T("form.addTx")}</div>
      <div class="type-toggle">
        <button type="button" class="tt expense ${type === "expense" ? "on" : ""}" data-type="expense">${T("form.expense")}</button>
        <button type="button" class="tt income ${type === "income" ? "on" : ""}" data-type="income">${T("form.income")}</button>
      </div>
      <form id="txForm">
        <label class="field">
          <span class="field-lbl">${T("form.amount")}</span>
          <div class="amount-input">
            <input id="txAmount" type="number" inputmode="decimal" step="0.01" min="0" required value="${tx ? tx.amount : ""}" placeholder="0" />
            <span class="cur-tag">${Store.settings.currency === "EUR" ? "€" : "RSD"}</span>
          </div>
        </label>
        <div class="field">
          <span class="field-lbl">${T("form.category")}</span>
          <div class="cat-grid" id="catGrid">${catGrid()}</div>
        </div>
        <label class="field">
          <span class="field-lbl">${T("form.note")}</span>
          <input id="txNote" type="text" maxlength="60" value="${tx ? escapeHtml(tx.note || "") : ""}" placeholder="${T("form.note")}" />
        </label>
        <label class="field">
          <span class="field-lbl">${T("form.date")}</span>
          <input id="txDate" type="date" required value="${tx ? tx.date : Store.todayISO()}" />
        </label>
        <div class="form-actions">
          ${editing ? `<button type="button" class="btn-danger" id="txDelete">${T("form.delete")}</button>` : ""}
          <button type="submit" class="btn-primary">${T("form.save")}</button>
        </div>
      </form>`;
    const sheet = openModal(html);

    function refreshCats() { sheet.querySelector("#catGrid").innerHTML = catGrid(); bindCats(); }
    function bindCats() {
      sheet.querySelectorAll("[data-cat]").forEach(b => b.addEventListener("click", () => {
        category = b.dataset.cat; refreshCats();
      }));
    }
    bindCats();

    sheet.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => {
      type = b.dataset.type;
      category = Store.CATEGORIES[type][0].id;
      sheet.querySelectorAll(".tt").forEach(x => x.classList.toggle("on", x.dataset.type === type));
      refreshCats();
    }));

    sheet.querySelector("#txForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = parseFloat(sheet.querySelector("#txAmount").value);
      if (!(amount > 0)) return;
      Store.addTx({
        id: tx ? tx.id : undefined,
        type, category, amount,
        note: sheet.querySelector("#txNote").value.trim(),
        date: sheet.querySelector("#txDate").value
      });
      closeModal();
      toast(T("toast.saved"));
      render();
    });
    if (editing) sheet.querySelector("#txDelete").addEventListener("click", () => {
      if (confirm(T("confirm.deleteTx"))) { Store.deleteTx(tx.id); closeModal(); toast(T("toast.deleted")); render(); }
    });
  }

  /* ---------- bill form ---------- */
  function openBillForm(bill) {
    const editing = !!bill;
    let category = bill ? bill.category : "bills";
    function catGrid() {
      return Store.CATEGORIES.expense.map(c =>
        `<button type="button" class="cat-chip ${c.id === category ? "on" : ""}" data-cat="${c.id}" style="--cc:${c.color}">
          <span class="cat-chip-ico">${c.icon}</span><span>${T(c.labelKey)}</span></button>`).join("");
    }
    const html = `
      <div class="sheet-handle"></div>
      <div class="sheet-title">${editing ? T("form.editBill") : T("form.addBill")}</div>
      <form id="billForm">
        <label class="field"><span class="field-lbl">${T("form.billName")}</span>
          <input id="bName" type="text" required maxlength="40" value="${bill ? escapeHtml(bill.name) : ""}" placeholder="${T("form.billName")}" /></label>
        <label class="field"><span class="field-lbl">${T("form.amount")}</span>
          <div class="amount-input"><input id="bAmount" type="number" inputmode="decimal" step="0.01" min="0" required value="${bill ? bill.amount : ""}" placeholder="0" />
          <span class="cur-tag">${Store.settings.currency === "EUR" ? "€" : "RSD"}</span></div></label>
        <label class="field"><span class="field-lbl">${T("bills.dueDay")} (1–31)</span>
          <input id="bDay" type="number" min="1" max="31" required value="${bill ? bill.dueDay : 1}" /></label>
        <div class="field"><span class="field-lbl">${T("form.category")}</span>
          <div class="cat-grid" id="catGrid">${catGrid()}</div></div>
        <div class="form-actions">
          ${editing ? `<button type="button" class="btn-danger" id="bDelete">${T("form.delete")}</button>` : ""}
          <button type="submit" class="btn-primary">${T("form.save")}</button>
        </div>
      </form>`;
    const sheet = openModal(html);
    function bindCats() {
      sheet.querySelectorAll("[data-cat]").forEach(b => b.addEventListener("click", () => {
        category = b.dataset.cat; sheet.querySelector("#catGrid").innerHTML = catGrid(); bindCats();
      }));
    }
    bindCats();
    sheet.querySelector("#billForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = parseFloat(sheet.querySelector("#bAmount").value);
      const day = Math.min(31, Math.max(1, parseInt(sheet.querySelector("#bDay").value, 10) || 1));
      if (!(amount > 0)) return;
      Store.addBill({
        id: bill ? bill.id : undefined,
        name: sheet.querySelector("#bName").value.trim(),
        amount, dueDay: day, category, active: true,
        paidMonth: bill ? bill.paidMonth : null
      });
      closeModal(); toast(T("toast.saved")); render();
    });
    if (editing) sheet.querySelector("#bDelete").addEventListener("click", () => {
      if (confirm(T("confirm.deleteBill"))) { Store.deleteBill(bill.id); closeModal(); toast(T("toast.deleted")); render(); }
    });
  }

  /* ---------- goal form ---------- */
  function openGoalForm(goal) {
    const editing = !!goal;
    const html = `
      <div class="sheet-handle"></div>
      <div class="sheet-title">${editing ? T("form.editGoal") : T("form.addGoal")}</div>
      <form id="goalForm">
        <label class="field"><span class="field-lbl">${T("form.goalName")}</span>
          <input id="gName" type="text" required maxlength="40" value="${goal ? escapeHtml(goal.name) : ""}" placeholder="${T("form.goalName")}" /></label>
        <label class="field"><span class="field-lbl">${T("form.targetAmount")}</span>
          <div class="amount-input"><input id="gTarget" type="number" inputmode="decimal" step="0.01" min="0" required value="${goal ? goal.target : ""}" placeholder="0" />
          <span class="cur-tag">${Store.settings.currency === "EUR" ? "€" : "RSD"}</span></div></label>
        <label class="field"><span class="field-lbl">${T("form.initialSaved")}</span>
          <div class="amount-input"><input id="gSaved" type="number" inputmode="decimal" step="0.01" min="0" value="${goal ? (goal.saved || 0) : ""}" placeholder="0" />
          <span class="cur-tag">${Store.settings.currency === "EUR" ? "€" : "RSD"}</span></div></label>
        <label class="field"><span class="field-lbl">${T("form.deadlineOpt")}</span>
          <input id="gDeadline" type="date" value="${goal && goal.deadline ? goal.deadline : ""}" /></label>
        <div class="form-actions">
          ${editing ? `<button type="button" class="btn-danger" id="gDelete">${T("form.delete")}</button>` : ""}
          <button type="submit" class="btn-primary">${T("form.save")}</button>
        </div>
      </form>`;
    const sheet = openModal(html);
    sheet.querySelector("#goalForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const target = parseFloat(sheet.querySelector("#gTarget").value);
      if (!(target > 0)) return;
      Store.addGoal({
        id: goal ? goal.id : undefined,
        name: sheet.querySelector("#gName").value.trim(),
        target,
        saved: parseFloat(sheet.querySelector("#gSaved").value) || 0,
        deadline: sheet.querySelector("#gDeadline").value || ""
      });
      closeModal(); toast(T("toast.saved")); render();
    });
    if (editing) sheet.querySelector("#gDelete").addEventListener("click", () => {
      if (confirm(T("confirm.deleteGoal"))) { Store.deleteGoal(goal.id); closeModal(); toast(T("toast.deleted")); render(); }
    });
  }

  function openFundForm(goal) {
    const html = `
      <div class="sheet-handle"></div>
      <div class="sheet-title">${T("goals.addFunds")} · ${escapeHtml(goal.name)}</div>
      <form id="fundForm">
        <label class="field"><span class="field-lbl">${T("form.fundsAmount")}</span>
          <div class="amount-input"><input id="fAmount" type="number" inputmode="decimal" step="0.01" required autofocus placeholder="0" />
          <span class="cur-tag">${Store.settings.currency === "EUR" ? "€" : "RSD"}</span></div></label>
        <div class="form-actions"><button type="submit" class="btn-primary">${T("form.save")}</button></div>
      </form>`;
    const sheet = openModal(html);
    sheet.querySelector("#fundForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = parseFloat(sheet.querySelector("#fAmount").value);
      if (!amount) return;
      Store.fundGoal(goal.id, amount);
      closeModal(); toast(T("toast.funded")); render();
    });
  }

  /* ---------- settings ---------- */
  function openSettings() {
    const s = Store.settings;
    const html = `
      <div class="sheet-handle"></div>
      <div class="sheet-title">${T("title.settings")}</div>
      <div class="settings">
        <div class="set-group">
          <div class="set-label">${T("set.language")}</div>
          <div class="seg full">
            <button data-lang="sr" class="${s.lang === "sr" ? "on" : ""}">Srpski</button>
            <button data-lang="en" class="${s.lang === "en" ? "on" : ""}">English</button>
          </div>
        </div>
        <div class="set-group">
          <div class="set-label">${T("set.currency")}</div>
          <div class="seg full">
            <button data-cur="RSD" class="${s.currency === "RSD" ? "on" : ""}">RSD (дин)</button>
            <button data-cur="EUR" class="${s.currency === "EUR" ? "on" : ""}">EUR (€)</button>
          </div>
        </div>
        <label class="set-row">
          <span>${T("set.rate")}</span>
          <input id="setRate" type="number" step="0.01" min="0.01" value="${s.rate}" class="set-input" />
        </label>
        <label class="set-row toggle-row">
          <span>${T("set.convert")}</span>
          <input id="setConvert" type="checkbox" ${s.convertOnSwitch ? "checked" : ""} />
        </label>
        <div class="set-group">
          <div class="set-label">${T("set.theme")}</div>
          <div class="seg full">
            <button data-theme="auto" class="${s.theme === "auto" ? "on" : ""}">${T("set.theme.auto")}</button>
            <button data-theme="light" class="${s.theme === "light" ? "on" : ""}">${T("set.theme.light")}</button>
            <button data-theme="dark" class="${s.theme === "dark" ? "on" : ""}">${T("set.theme.dark")}</button>
          </div>
        </div>
        <div class="set-group">
          <div class="set-label">${T("set.data")}</div>
          <button class="set-action" id="setDemo">✨ ${T("set.demo")}</button>
          <button class="set-action" id="setExport">⬇️ ${T("set.export")}</button>
          <button class="set-action" id="setImport">⬆️ ${T("set.import")}</button>
          <button class="set-action danger" id="setClear">🗑️ ${T("set.clear")}</button>
        </div>
        <div class="set-about">${T("set.about")} · v1.0</div>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden />`;
    const sheet = openModal(html);

    sheet.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => {
      Store.settings.lang = b.dataset.lang; I18n.setLang(b.dataset.lang); Store.save();
      closeModal(); render(); setTimeout(openSettings, 260);
    }));

    sheet.querySelectorAll("[data-cur]").forEach(b => b.addEventListener("click", () => {
      const newCur = b.dataset.cur;
      const old = Store.settings.currency;
      if (newCur === old) return;
      if (Store.settings.convertOnSwitch) {
        const rate = Store.settings.rate || 117.5;
        const factor = (old === "RSD" && newCur === "EUR") ? (1 / rate) : (old === "EUR" && newCur === "RSD") ? rate : 1;
        Store.convertAllAmounts(factor);
        toast(T("toast.currencyConverted"));
      }
      Store.settings.currency = newCur; Store.save();
      closeModal(); render(); setTimeout(openSettings, 260);
    }));

    sheet.querySelectorAll("[data-theme]").forEach(b => b.addEventListener("click", () => {
      Store.settings.theme = b.dataset.theme; Store.save(); applyTheme();
      sheet.querySelectorAll("[data-theme]").forEach(x => x.classList.toggle("on", x.dataset.theme === b.dataset.theme));
    }));

    sheet.querySelector("#setRate").addEventListener("change", (e) => {
      const v = parseFloat(e.target.value); if (v > 0) { Store.settings.rate = v; Store.save(); }
    });
    sheet.querySelector("#setConvert").addEventListener("change", (e) => {
      Store.settings.convertOnSwitch = e.target.checked; Store.save();
    });

    sheet.querySelector("#setDemo").addEventListener("click", () => {
      Store.loadDemo(); closeModal(); toast(T("toast.demo")); render();
    });
    sheet.querySelector("#setExport").addEventListener("click", exportData);
    sheet.querySelector("#setImport").addEventListener("click", () => sheet.querySelector("#importFile").click());
    sheet.querySelector("#importFile").addEventListener("change", (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { Store.importJSON(reader.result); I18n.setLang(Store.settings.lang); applyTheme(); closeModal(); toast(T("toast.imported")); render(); }
        catch (err) { alert("Import error"); }
      };
      reader.readAsText(file);
    });
    sheet.querySelector("#setClear").addEventListener("click", () => {
      if (confirm(T("set.clearConfirm"))) { Store.clearAll(); closeModal(); toast(T("toast.cleared")); render(); }
    });
  }

  function exportData() {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "novcanik-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ===================================================== INIT */
  function init() {
    I18n.setLang(Store.settings.lang);
    applyTheme();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (Store.settings.theme === "auto") applyTheme();
    });

    $$(".tab").forEach(t => t.addEventListener("click", () => switchView(t.dataset.view)));
    $("#fab").addEventListener("click", openAddChooser);
    $("#settingsBtn").addEventListener("click", openSettings);
    $("#themeToggle").addEventListener("click", cycleTheme);

    $("#modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    // delegated "see all" links
    document.addEventListener("click", (e) => {
      const goto = e.target.closest("[data-goto]");
      if (goto) switchView(goto.dataset.goto);
    });

    switchView("dashboard");

    // service worker (only over http/https)
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
