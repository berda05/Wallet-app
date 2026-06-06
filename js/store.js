/* store.js — podaci, localStorage, kategorije, proracuni */
(function () {
  const KEY = "novcanik.data.v1";

  const CATEGORIES = {
    expense: [
      { id: "food",      icon: "🍔", color: "#FF6B6B", labelKey: "cat.food" },
      { id: "transport", icon: "🚗", color: "#4DABF7", labelKey: "cat.transport" },
      { id: "bills",     icon: "🧾", color: "#FFA94D", labelKey: "cat.bills" },
      { id: "fun",       icon: "🎬", color: "#DA77F2", labelKey: "cat.fun" },
      { id: "shopping",  icon: "🛍️", color: "#F783AC", labelKey: "cat.shopping" },
      { id: "health",    icon: "💊", color: "#69DB7C", labelKey: "cat.health" },
      { id: "home",      icon: "🏠", color: "#3BC9DB", labelKey: "cat.home" },
      { id: "education", icon: "📚", color: "#9775FA", labelKey: "cat.education" },
      { id: "other",     icon: "📦", color: "#ADB5BD", labelKey: "cat.other" }
    ],
    income: [
      { id: "salary",     icon: "💼", color: "#51CF66", labelKey: "cat.salary" },
      { id: "freelance",  icon: "💻", color: "#20C997", labelKey: "cat.freelance" },
      { id: "gift",       icon: "🎁", color: "#FF922B", labelKey: "cat.gift" },
      { id: "investment", icon: "📈", color: "#22B8CF", labelKey: "cat.investment" },
      { id: "otherInc",   icon: "💰", color: "#94D82D", labelKey: "cat.otherInc" }
    ]
  };

  function defaultData() {
    return {
      settings: { lang: "sr", currency: "RSD", theme: "auto", rate: 117.5, convertOnSwitch: true },
      transactions: [],
      bills: [],
      goals: []
    };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      const d = defaultData();
      return {
        settings: Object.assign(d.settings, parsed.settings || {}),
        transactions: parsed.transactions || [],
        bills: parsed.bills || [],
        goals: parsed.goals || []
      };
    } catch (e) {
      console.warn("load failed", e);
      return defaultData();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.warn("save failed", e); }
  }

  /* ---------- helpers ---------- */
  function catById(type, id) {
    const list = CATEGORIES[type] || [];
    return list.find(c => c.id === id) || list[list.length - 1];
  }

  function ym(dateStr) { return dateStr.slice(0, 7); } // YYYY-MM
  function nowYM() { return new Date().toISOString().slice(0, 7); }
  function todayISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  }

  /* ---------- transactions ---------- */
  function addTx(tx) {
    tx.id = tx.id || uid();
    const idx = data.transactions.findIndex(t => t.id === tx.id);
    if (idx >= 0) data.transactions[idx] = tx; else data.transactions.push(tx);
    save();
    return tx;
  }
  function deleteTx(id) {
    // ako je ovo auto-transakcija nekog racuna, vrati racun na "neplaceno"
    const linked = data.bills.find(b => b.paidTxId === id);
    if (linked) { linked.paidTxId = null; linked.paidMonth = null; }
    data.transactions = data.transactions.filter(t => t.id !== id);
    save();
  }
  function getTx(id) { return data.transactions.find(t => t.id === id); }

  /* ---------- bills ---------- */
  function addBill(b) {
    b.id = b.id || uid();
    const idx = data.bills.findIndex(x => x.id === b.id);
    if (idx >= 0) data.bills[idx] = b; else data.bills.push(b);
    save();
    return b;
  }
  function deleteBill(id) {
    const b = getBill(id);
    // ukloni i automatsku transakciju ako je racun bio placen
    if (b && b.paidTxId) data.transactions = data.transactions.filter(t => t.id !== b.paidTxId);
    data.bills = data.bills.filter(x => x.id !== id);
    save();
  }
  function getBill(id) { return data.bills.find(b => b.id === id); }
  function toggleBillPaid(id) {
    const b = getBill(id);
    if (!b) return;
    const wasPaid = b.paidMonth === nowYM();
    if (wasPaid) {
      // ponisti placanje -> obrisi povezanu transakciju
      b.paidMonth = null;
      if (b.paidTxId) {
        data.transactions = data.transactions.filter(t => t.id !== b.paidTxId);
        b.paidTxId = null;
      }
    } else {
      // oznaci placeno -> napravi trosak koji se vidi u transakcijama
      b.paidMonth = nowYM();
      const tx = {
        id: uid(),
        type: "expense",
        amount: b.amount,
        category: b.category,
        note: b.name,
        date: todayISO(),
        billRef: b.id   // veza ka racunu (auto-transakcija)
      };
      data.transactions.push(tx);
      b.paidTxId = tx.id;
    }
    save();
  }

  /* ---------- goals ---------- */
  function addGoal(g) {
    g.id = g.id || uid();
    const idx = data.goals.findIndex(x => x.id === g.id);
    if (idx >= 0) data.goals[idx] = g; else data.goals.push(g);
    save();
    return g;
  }
  function deleteGoal(id) { data.goals = data.goals.filter(g => g.id !== id); save(); }
  function getGoal(id) { return data.goals.find(g => g.id === id); }
  function fundGoal(id, amount) {
    const g = getGoal(id);
    if (!g) return;
    g.saved = Math.max(0, (g.saved || 0) + amount);
    save();
  }

  /* ---------- calculations ---------- */
  function monthTotals(yearMonth) {
    yearMonth = yearMonth || nowYM();
    let income = 0, expense = 0;
    data.transactions.forEach(t => {
      if (ym(t.date) !== yearMonth) return;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, net: income - expense };
  }

  function totalBalance() {
    let bal = 0;
    data.transactions.forEach(t => { bal += t.type === "income" ? t.amount : -t.amount; });
    return bal;
  }

  function billsMonthlyTotal() {
    return data.bills.filter(b => b.active !== false).reduce((s, b) => s + (b.amount || 0), 0);
  }

  // procena uštede ovog meseca = prihodi - troškovi - (neplaćeni računi)
  function potentialSavings() {
    const m = monthTotals();
    const unpaidBills = data.bills
      .filter(b => b.active !== false && b.paidMonth !== nowYM())
      .reduce((s, b) => s + (b.amount || 0), 0);
    return m.income - m.expense - unpaidBills;
  }

  function expenseByCategory(yearMonth) {
    yearMonth = yearMonth || nowYM();
    const map = {};
    data.transactions.forEach(t => {
      if (t.type !== "expense") return;
      if (ym(t.date) !== yearMonth) return;
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }

  function byCategory(type, yearMonth) {
    const map = {};
    data.transactions.forEach(t => {
      if (t.type !== type) return;
      if (yearMonth && ym(t.date) !== yearMonth) return;
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }

  function last6Months() {
    const out = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const t = monthTotals(key);
      out.push({ key, month: d.getMonth(), income: t.income, expense: t.expense });
    }
    return out;
  }

  /* ---------- currency conversion ---------- */
  function convertAllAmounts(factor) {
    const r = x => Math.round(x * factor * 100) / 100;
    data.transactions.forEach(t => t.amount = r(t.amount));
    data.bills.forEach(b => b.amount = r(b.amount));
    data.goals.forEach(g => { g.target = r(g.target); g.saved = r(g.saved || 0); });
    save();
  }

  /* ---------- import / export / demo ---------- */
  function exportJSON() { return JSON.stringify(data, null, 2); }
  function importJSON(str) {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== "object") throw new Error("bad");
    const d = defaultData();
    data = {
      settings: Object.assign(d.settings, parsed.settings || {}),
      transactions: parsed.transactions || [],
      bills: parsed.bills || [],
      goals: parsed.goals || []
    };
    save();
  }
  function clearAll() {
    const keepSettings = data.settings;
    data = defaultData();
    data.settings = keepSettings;
    save();
  }

  function loadDemo() {
    const settings = data.settings;
    data = defaultData();
    data.settings = settings;
    const cur = settings.currency === "EUR" ? 1 : 117;
    const m = (n) => Math.round(n * cur);
    const d = new Date();
    const toISO = (x) => {
      const off = x.getTimezoneOffset();
      return new Date(x.getTime() - off * 60000).toISOString().slice(0, 10);
    };
    // dan u TEKUCEM mesecu, ali nikad u buducnosti
    const curDay = (day) => {
      const clamped = Math.min(day, d.getDate());
      return toISO(new Date(d.getFullYear(), d.getMonth(), Math.max(1, clamped)));
    };
    const prevMonthDay = (back, day) => toISO(new Date(d.getFullYear(), d.getMonth() - back, day));

    data.transactions = [
      { id: uid(), type: "income",  amount: m(1200), category: "salary",    note: "Plata", date: curDay(1) },
      { id: uid(), type: "income",  amount: m(300),  category: "freelance", note: "Projekat", date: curDay(1) },
      { id: uid(), type: "expense", amount: m(45),   category: "food",      note: "Market", date: curDay(1) },
      { id: uid(), type: "expense", amount: m(12),   category: "transport", note: "Gorivo", date: curDay(2) },
      { id: uid(), type: "expense", amount: m(60),   category: "fun",       note: "Bioskop + večera", date: curDay(2) },
      { id: uid(), type: "expense", amount: m(120),  category: "shopping",  note: "Patike", date: curDay(1) },
      { id: uid(), type: "expense", amount: m(30),   category: "health",    note: "Apoteka", date: curDay(2) },
      { id: uid(), type: "expense", amount: m(25),   category: "food",      note: "Restoran", date: curDay(1) },
      { id: uid(), type: "income",  amount: m(1200), category: "salary",    note: "Plata", date: prevMonthDay(1, 2) },
      { id: uid(), type: "expense", amount: m(400),  category: "home",      note: "Kirija", date: prevMonthDay(1, 5) },
      { id: uid(), type: "expense", amount: m(220),  category: "food",      note: "Namirnice", date: prevMonthDay(1, 12) },
      { id: uid(), type: "income",  amount: m(1200), category: "salary",    note: "Plata", date: prevMonthDay(2, 2) },
      { id: uid(), type: "expense", amount: m(380),  category: "home",      note: "Kirija", date: prevMonthDay(2, 5) }
    ];
    data.bills = [
      { id: uid(), name: "Kirija",   amount: m(400), category: "home",  dueDay: 5,  active: true, paidMonth: null },
      { id: uid(), name: "Struja",   amount: m(45),  category: "bills", dueDay: 15, active: true, paidMonth: null },
      { id: uid(), name: "Internet", amount: m(25),  category: "bills", dueDay: 10, active: true, paidMonth: null },
      { id: uid(), name: "Netflix",  amount: m(12),  category: "fun",   dueDay: 20, active: true, paidMonth: null }
    ];
    data.goals = [
      { id: uid(), name: "Letovanje 🏖️", target: m(1500), saved: m(600), deadline: new Date(d.getFullYear(), d.getMonth() + 5, 1).toISOString().slice(0,10) },
      { id: uid(), name: "Rezerva", target: m(3000), saved: m(1200), deadline: "" }
    ];
    save();
  }

  window.Store = {
    CATEGORIES,
    get data() { return data; },
    get settings() { return data.settings; },
    save, catById, uid, todayISO, nowYM, ym,
    addTx, deleteTx, getTx,
    addBill, deleteBill, getBill, toggleBillPaid,
    addGoal, deleteGoal, getGoal, fundGoal,
    monthTotals, totalBalance, billsMonthlyTotal, potentialSavings,
    expenseByCategory, byCategory, last6Months,
    convertAllAmounts, exportJSON, importJSON, clearAll, loadDemo
  };
})();
