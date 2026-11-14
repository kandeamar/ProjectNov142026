(() => {
  "use strict";

  const STORE_KEY = "pennywise-v1";
  const categories = [
    { name: "Food & dining", icon: "☕", color: "#77a982", type: "expense" },
    { name: "Rent & home", icon: "⌂", color: "#e5ad61", type: "expense" },
    { name: "Transport", icon: "↗", color: "#7fa7c5", type: "expense" },
    { name: "Shopping", icon: "◇", color: "#c796b9", type: "expense" },
    { name: "Bills", icon: "ϟ", color: "#e08368", type: "expense" },
    { name: "Health", icon: "✚", color: "#82b7a9", type: "expense" },
    { name: "Entertainment", icon: "♫", color: "#9b8bc5", type: "expense" },
    { name: "Travel", icon: "✈", color: "#75a9a8", type: "expense" },
    { name: "Personal care", icon: "✿", color: "#d28f9d", type: "expense" },
    { name: "Education", icon: "▤", color: "#8297c0", type: "expense" },
    { name: "Subscriptions", icon: "◉", color: "#a99a6e", type: "expense" },
    { name: "Gifts & donations", icon: "♡", color: "#d48e8e", type: "expense" },
    { name: "Salary", icon: "↙", color: "#72a67e", type: "income" },
    { name: "Freelance", icon: "⌘", color: "#7d9e8a", type: "income" },
    { name: "Other income", icon: "＋", color: "#8eb695", type: "income" }
  ];
  const palette = ["#77a982", "#e5ad61", "#7fa7c5", "#c796b9", "#e08368", "#82b7a9", "#9b8bc5", "#75a9a8"];
  const seededTransactions = [
    { id: "seed-1", name: "Monthly salary", category: "Salary", type: "income", amount: 85000, date: dateThisMonth(2), account: "Everyday account", note: "Acme Studio" },
    { id: "seed-2", name: "Apartment rent", category: "Rent & home", type: "expense", amount: 22000, date: dateThisMonth(3), account: "Everyday account", note: "Monthly rent" },
    { id: "seed-3", name: "Groceries at Nature's Basket", category: "Food & dining", type: "expense", amount: 1840, date: dateThisMonth(5), account: "Credit card", note: "Weekly groceries" },
    { id: "seed-4", name: "Metro card recharge", category: "Transport", type: "expense", amount: 600, date: dateThisMonth(6), account: "Everyday account", note: "" },
    { id: "seed-5", name: "Electricity bill", category: "Bills", type: "expense", amount: 1450, date: dateThisMonth(8), account: "Everyday account", note: "Monthly bill" },
    { id: "seed-6", name: "Dinner with friends", category: "Food & dining", type: "expense", amount: 1250, date: dateThisMonth(10), account: "Credit card", note: "Friday dinner" },
    { id: "seed-7", name: "Running shoes", category: "Shopping", type: "expense", amount: 3299, date: dateThisMonth(12), account: "Credit card", note: "New trainers" },
    { id: "seed-8", name: "Pharmacy", category: "Health", type: "expense", amount: 720, date: dateThisMonth(14), account: "Cash", note: "" }
  ];

  function dateThisMonth(day) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function localDateString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function defaultState() {
    return {
      transactions: seededTransactions,
      budgets: { "Overall": 65000, "Food & dining": 9000, "Transport": 5000, "Shopping": 7000, "Bills": 6500, "Health": 4000 },
      lastCategory: "Food & dining"
    };
  }
  function loadState() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (!saved) return defaultState();
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.transactions) || !parsed.budgets) throw new Error("Saved finance data is invalid.");
      return { transactions: parsed.transactions, budgets: parsed.budgets, lastCategory: parsed.lastCategory || "Food & dining" };
    } catch (error) {
      console.error("Could not load saved finance data.", error);
      setTimeout(() => showToast("Saved data could not be loaded. Starting with sample data."), 0);
      return defaultState();
    }
  }
  let toastTimer;
  let editingTransactionId = null;
  let state = loadState();
  let selectedType = "expense";
  let selectedMonth = monthString(new Date());
  let pendingImport = null;
  let importHeaders = [];
  let importRows = [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const fmt = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.abs(Number(value) || 0));
  function monthString(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (error) { console.error("Could not save finance data.", error); showToast("Could not save changes in this browser."); }
  }
  function categoryInfo(name) {
    const known = categories.find((item) => item.name === name);
    if (known) return known;
    return { name, icon: "◈", color: palette[name.length % palette.length], type: "expense" };
  }
  function dateLabel(date) {
    const value = new Date(`${date}T12:00:00`);
    return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function monthTransactions(month = selectedMonth) {
    return state.transactions.filter((item) => String(item.date).slice(0, 7) === month);
  }
  function sum(items, type) {
    return items.filter((item) => item.type === type).reduce((total, item) => total + Number(item.amount || 0), 0);
  }
  function expenseByCategory(items) {
    const totals = {};
    items.filter((item) => item.type === "expense").forEach((item) => { totals[item.category] = (totals[item.category] || 0) + Number(item.amount || 0); });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }
  function statusFor(spent, limit) {
    if (!limit || limit <= 0) return { text: "No limit", className: "" };
    const ratio = spent / limit;
    if (ratio > 1) return { text: "Over budget", className: "over" };
    if (ratio >= .8) return { text: "Getting close", className: "warning" };
    return { text: "On track", className: "" };
  }
  function setDonut(chart, entries, totalNode, legendNode, topNode) {
    const total = entries.reduce((acc, entry) => acc + entry[1], 0);
    totalNode.textContent = fmt(total);
    let cursor = 0;
    const stops = entries.slice(0, 6).map(([name, value], index) => {
      const start = cursor;
      cursor += total ? value / total * 360 : 0;
      return `${categoryInfo(name).color || palette[index % palette.length]} ${start}deg ${cursor}deg`;
    });
    chart.style.background = total ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#e9ede8 0deg 360deg)";
    legendNode.innerHTML = entries.slice(0, 5).map(([name, value]) => `<div class="legend-item"><span class="legend-dot" style="background:${categoryInfo(name).color}"></span><span class="legend-name">${escapeHtml(name)}</span><span class="legend-value">${fmt(value)}</span></div>`).join("") || '<div class="legend-item"><span class="legend-name">No expenses yet</span></div>';
    if (topNode) topNode.textContent = entries[0] ? entries[0][0] : "—";
  }
  function transactionMarkup(item) {
    const category = categoryInfo(item.category);
    const isIncome = item.type === "income";
    return `<tr><td><div class="transaction-name"><span class="transaction-symbol">${category.icon}</span><span>${escapeHtml(item.name || item.category)}${item.note ? `<span class="transaction-note">${escapeHtml(item.note)}</span>` : ""}</span></div></td><td><span class="category-tag"><span>${category.icon}</span>${escapeHtml(item.category)}</span></td><td>${dateLabel(item.date)}</td><td>${escapeHtml(item.account || "Everyday account")}</td><td class="amount-cell ${isIncome ? "amount-income" : ""}">${isIncome ? "+" : "−"}${fmt(item.amount)}</td><td class="row-actions"><button class="row-edit" data-edit-transaction="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.name || item.category)}">✎</button><button class="row-delete" data-delete="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name || item.category)}">×</button></td></tr>`;
  }
  function renderTransactions() {
    const recent = [...monthTransactions()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    $("#recent-transactions").innerHTML = recent.map(transactionMarkup).join("");
    $("#recent-empty").classList.toggle("hidden", recent.length > 0);
    const query = ($("#transaction-search")?.value || "").trim().toLowerCase();
    const type = $("#type-filter")?.value || "all";
    const category = $("#category-filter")?.value || "all";
    const filtered = [...state.transactions].filter((item) => {
      const searchable = `${item.name} ${item.note || ""} ${item.category} ${item.account || ""}`.toLowerCase();
      return (!query || searchable.includes(query)) && (type === "all" || item.type === type) && (category === "all" || item.category === category);
    }).sort((a, b) => b.date.localeCompare(a.date));
    $("#all-transactions").innerHTML = filtered.map(transactionMarkup).join("");
    $("#transactions-empty").classList.toggle("hidden", filtered.length > 0);
  }
  function budgetRow(name, limit, spent, full) {
    const ratio = limit ? spent / limit : 0;
    const status = statusFor(spent, limit);
    const width = Math.min(ratio * 100, 100);
    return `<div class="budget-row"><div class="budget-row-head"><div class="budget-name-wrap"><span class="category-symbol">${categoryInfo(name).icon}</span><span class="budget-name">${escapeHtml(name)}</span></div><div class="budget-row-actions">${full ? `<button class="mini-action" data-edit-budget="${escapeHtml(name)}" aria-label="Edit ${escapeHtml(name)} budget">✎</button><button class="mini-action delete" data-delete-budget="${escapeHtml(name)}" aria-label="Delete ${escapeHtml(name)} budget">×</button>` : ""}<span class="budget-amount"><strong>${fmt(spent)}</strong> / ${fmt(limit)}</span></div></div><div class="progress-track ${status.className}"><span style="width:${width}%"></span></div><div class="budget-row-foot"><span>${fmt(Math.max(0, limit - spent))} left</span><span class="status-label ${status.className}">${status.text}</span></div></div>`;
  }
  function renderBudgets() {
    const expenses = monthTransactions().filter((item) => item.type === "expense");
    const overallLimit = Number(state.budgets.Overall || 0);
    const overallSpent = sum(expenses, "expense");
    const overallStatus = statusFor(overallSpent, overallLimit);
    $("#overall-budget-label").textContent = overallLimit ? `${fmt(overallLimit)} limit` : "No budget set";
    $("#overall-spent-label").textContent = `${fmt(overallSpent)} spent`;
    $("#overall-left-label").textContent = overallLimit ? `${fmt(Math.max(0, overallLimit - overallSpent))} left` : "Set a monthly budget";
    $("#overall-progress").style.width = `${Math.min(overallLimit ? overallSpent / overallLimit * 100 : 0, 100)}%`;
    $("#overall-progress").parentElement.className = `progress-track overall-track ${overallStatus.className}`;
    $("#budget-summary-value").textContent = overallLimit ? fmt(overallLimit) : "Not set";
    $("#budget-summary-copy").textContent = overallLimit ? `${Math.round(overallSpent / overallLimit * 100)}% of limit used` : "Set a budget to get started";
    const categoryBudgets = Object.entries(state.budgets).filter(([name]) => name !== "Overall");
    const spentMap = Object.fromEntries(expenseByCategory(expenses));
    $("#budget-preview").innerHTML = categoryBudgets.slice(0, 3).map(([name, limit]) => budgetRow(name, Number(limit), spentMap[name] || 0, false)).join("") || '<p class="panel-subtitle">Add a category budget to see your progress.</p>';
    const monthName = new Date(`${selectedMonth}-02T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    $("#budgets-month-label").textContent = `Your spending limits for ${monthName}`;
    const categoryBudgetTotal = Object.entries(state.budgets).filter(([name]) => name !== "Overall").reduce((total, [, limit]) => total + Number(limit || 0), 0);
    const totalLimit = Number(state.budgets.Overall || categoryBudgetTotal);
    $("#budget-summary-strip").innerHTML = `<div class="strip-card"><span>Total budget</span><strong>${fmt(totalLimit)}</strong></div><div class="strip-card"><span>Spent so far</span><strong>${fmt(overallSpent)}</strong></div><div class="strip-card"><span>Remaining</span><strong>${fmt(Math.max(0, totalLimit - overallSpent))}</strong></div>`;
    $("#budgets-full-list").innerHTML = Object.entries(state.budgets).map(([name, limit]) => budgetRow(name, Number(limit), name === "Overall" ? overallSpent : (spentMap[name] || 0), true)).join("");
  }
  function renderReports() {
    const entries = expenseByCategory(monthTransactions());
    setDonut($("#report-donut-chart"), entries, $("#report-donut-total"), $("#report-category-legend"));
    const current = monthTransactions();
    $(".report-summary").innerHTML = [
      ["Income this month", fmt(sum(current, "income")), "Money received"],
      ["Expenses this month", fmt(sum(current, "expense")), "Money spent"],
      ["Net savings", fmt(sum(current, "income") - sum(current, "expense")), "Income minus expenses"],
      ["Top category", entries[0] ? entries[0][0] : "—", entries[0] ? fmt(entries[0][1]) + " spent" : "No spending yet"]
    ].map(([label, amount, hint], index) => `<article class="summary-card"><div class="card-topline"><span>${label}</span><span class="card-icon ${index === 0 ? "income-icon" : index === 1 ? "expense-icon" : "budget-icon"}">${index === 0 ? "↓" : index === 1 ? "↑" : "◷"}</span></div><div class="summary-value">${amount}</div><div class="card-foot"><span class="muted">${hint}</span></div></article>`).join("");
    const months = [];
    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - offset);
      const key = monthString(date);
      const items = state.transactions.filter((item) => String(item.date).slice(0, 7) === key);
      months.push({ label: date.toLocaleDateString("en-IN", { month: "short" }), income: sum(items, "income"), expense: sum(items, "expense") });
    }
    const max = Math.max(1, ...months.flatMap((item) => [item.income, item.expense]));
    $("#trend-chart").innerHTML = `<div class="bar-chart">${months.map((item) => `<div class="bar-group"><div class="bars"><span class="bar" title="Income ${fmt(item.income)}" style="height:${Math.max(2, item.income / max * 100)}%"></span><span class="bar expense" title="Expenses ${fmt(item.expense)}" style="height:${Math.max(2, item.expense / max * 100)}%"></span></div><span class="bar-label">${item.label}</span></div>`).join("")}</div><div class="chart-key"><span>Income</span><span class="expense-key">Expenses</span></div>`;
    $("#top-categories-list").innerHTML = entries.slice(0, 6).map(([name, amount]) => `<div class="top-category-card"><span class="category-symbol">${categoryInfo(name).icon}</span><div class="top-category-copy"><strong>${escapeHtml(name)}</strong><span>${fmt(amount)} this month</span></div></div>`).join("") || '<p class="panel-subtitle">Your category insights will show up after you add expenses.</p>';
  }
  function render() {
    const monthItems = monthTransactions();
    const income = sum(monthItems, "income");
    const expense = sum(monthItems, "expense");
    $("#income-value").textContent = fmt(income);
    $("#expense-value").textContent = fmt(expense);
    $("#balance-value").textContent = fmt(income - expense);
    $("#month-picker").value = selectedMonth;
    $("#budget-month-picker").value = selectedMonth;
    const monthName = new Date(`${selectedMonth}-02T12:00:00`).toLocaleDateString("en-IN", { month: "long" });
    $("#breakdown-month-label").innerHTML = `${monthName} <span>⌄</span>`;
    const entries = expenseByCategory(monthItems);
    setDonut($("#donut-chart"), entries, $("#donut-total"), $("#category-legend"), $("#top-category"));
    renderTransactions();
    renderBudgets();
    renderReports();
    updateCategoryFilters();
  }
  function updateCategoryFilters() {
    const names = Array.from(new Set([...categories.map((item) => item.name), ...state.transactions.map((item) => item.category)])).sort();
    const categoryFilter = $("#category-filter");
    const selected = categoryFilter.value;
    categoryFilter.innerHTML = `<option value="all">All categories</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
    categoryFilter.value = names.includes(selected) ? selected : "all";
  }
  function populateCategorySelect(select, type) {
    const existing = select.value;
    const names = categories.filter((item) => item.type === type).map((item) => item.name);
    const custom = state.transactions.map((item) => item.category).filter((name) => !categories.some((cat) => cat.name === name));
    select.innerHTML = Array.from(new Set([...names, ...custom])).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    if (Array.from(select.options).some((option) => option.value === existing)) select.value = existing;
  }
  function populateBudgetSelect() {
    populateCategorySelect($("#budget-category"), "expense");
    const overallOption = document.createElement("option");
    overallOption.value = "Overall";
    overallOption.textContent = "Overall monthly budget";
    $("#budget-category").prepend(overallOption);
  }
  function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    const focusable = modal.querySelector("[autofocus]") || modal.querySelector("input:not([type=file]), select, button");
    if (focusable) setTimeout(() => focusable.focus(), 30);
  }
  function closeModals() {
    $$(".modal-backdrop").forEach((modal) => modal.classList.add("hidden"));
    document.body.style.overflow = "";
  }
  function openTransactionModal() {
    const form = $("#transaction-form");
    form.reset();
    form.elements.date.value = localDateString();
    editingTransactionId = null;
    selectedType = "expense";
    $$(".type-option").forEach((button) => button.classList.toggle("active", button.dataset.type === selectedType));
    populateCategorySelect($("#transaction-category"), selectedType);
    $("#transaction-category").value = Array.from($("#transaction-category").options).some((option) => option.value === state.lastCategory) ? state.lastCategory : "Food & dining";
    $("#transaction-modal-title").textContent = "Add a transaction";
    openModal("transaction-modal");
  }
  function editTransaction(id) {
    const item = state.transactions.find((transaction) => String(transaction.id) === String(id));
    if (!item) return;
    editingTransactionId = item.id;
    selectedType = item.type;
    const form = $("#transaction-form");
    form.elements.amount.value = item.amount;
    form.elements.date.value = item.date;
    form.elements.note.value = item.note || "";
    form.elements.account.value = item.account || "Everyday account";
    $$(".type-option").forEach((button) => button.classList.toggle("active", button.dataset.type === selectedType));
    populateCategorySelect($("#transaction-category"), selectedType);
    if (!Array.from($("#transaction-category").options).some((option) => option.value === item.category)) {
      $("#transaction-category").add(new Option(item.category, item.category));
    }
    $("#transaction-category").value = item.category;
    $("#transaction-modal-title").textContent = "Edit transaction";
    openModal("transaction-modal");
  }
  function showToast(message, action) {
    const toast = $("#toast");
    toast.replaceChildren(document.createTextNode(message));
    if (action) {
      const button = document.createElement("button");
      button.textContent = action.label;
      button.addEventListener("click", () => { action.run(); toast.classList.remove("show"); });
      toast.appendChild(button);
    }
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
  }
  function switchView(name) {
    $$(".view-panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== `${name}-view`));
    $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
    const titles = { overview: "Overview", transactions: "Transactions", budgets: "Budgets", reports: "Reports" };
    $("#page-title").textContent = titles[name] || "Overview";
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function addTransaction(item) {
    let budgetAlert = "";
    if (item.type === "expense" && String(item.date).slice(0, 7) === selectedMonth) {
      const beforeOverall = sum(monthTransactions(), "expense");
      const thresholds = [
        ["Overall", Number(state.budgets.Overall || 0), beforeOverall],
        [item.category, Number(state.budgets[item.category] || 0), expenseByCategory(monthTransactions()).find(([name]) => name === item.category)?.[1] || 0]
      ];
      for (const [name, limit, before] of thresholds) {
        const ratioBefore = before / limit;
        const ratioAfter = (before + item.amount) / limit;
        if (limit > 0 && ratioBefore <= 1 && ratioAfter > 1) {
          budgetAlert = `You’ve exceeded your ${name === "Overall" ? "overall" : name} budget.`;
          break;
        }
        if (limit > 0 && ratioBefore < .8 && ratioAfter >= .8) {
          budgetAlert = `You’ve reached 80% of your ${name === "Overall" ? "overall" : name} budget.`;
        }
      }
    }
    state.transactions.push(item);
    state.lastCategory = item.category;
    save();
    render();
    return budgetAlert;
  }
  function deleteTransaction(id) {
    const index = state.transactions.findIndex((item) => String(item.id) === String(id));
    if (index < 0) return;
    const [removed] = state.transactions.splice(index, 1);
    save();
    render();
    showToast("Transaction deleted.", { label: "Undo", run: () => { state.transactions.splice(index, 0, removed); save(); render(); } });
  }
  function exportCsv(transactions = state.transactions, filename = "pennywise-transactions.csv") {
    const headers = ["date", "amount", "type", "category", "account", "note"];
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...transactions.map((item) => [item.date, item.amount, item.type, item.category, item.account, item.note].map(quote).join(","))].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`${transactions.length} transaction${transactions.length === 1 ? "" : "s"} exported.`);
  }
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[index + 1] === "\n") index++;
        row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
        row = []; cell = "";
      } else cell += char;
    }
    if (quoted) throw new Error("This CSV has an unfinished quoted field.");
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
  }
  function normalizedHeader(header) { return header.toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function openImport() {
    pendingImport = null; importHeaders = []; importRows = [];
    $("#csv-file").value = "";
    $("#import-step-upload").classList.remove("hidden");
    $("#import-step-preview").classList.add("hidden");
    openModal("import-modal");
  }
  function renderImportPreview(rows) {
    const body = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));
    importHeaders = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
    importRows = body;
    const fields = [
      ["date", "Date", ["date", "transactiondate", "time"]],
      ["amount", "Amount", ["amount", "value", "total"]],
      ["type", "Type", ["type", "transactiontype", "direction"]],
      ["category", "Category", ["category", "classification"]],
      ["note", "Note", ["note", "description", "details", "memo", "merchant"]],
      ["account", "Account", ["account", "accountname"]]
    ];
    $("#mapping-grid").innerHTML = fields.map(([key, title, aliases]) => {
      const guessed = importHeaders.findIndex((header) => aliases.includes(normalizedHeader(header)));
      return `<label class="field-label">${title}<select data-map="${key}"><option value="-1">Skip column</option>${importHeaders.map((header, index) => `<option value="${index}" ${index === guessed ? "selected" : ""}>${escapeHtml(header)}</option>`).join("")}</select></label>`;
    }).join("");
    $("#import-row-count").textContent = `${body.length} row${body.length === 1 ? "" : "s"} found · previewing up to 5`;
    $("#import-step-upload").classList.add("hidden");
    $("#import-step-preview").classList.remove("hidden");
    pendingImport = { headers: importHeaders, rows: importRows };
    updateImportTable();
  }
  function updateImportTable() {
    const mapped = Object.fromEntries($$("[data-map]").map((select) => [select.dataset.map, Number(select.value)]));
    const previewHeaders = ["date", "amount", "category", "note"].filter((key) => mapped[key] >= 0);
    $("#preview-head").innerHTML = `<tr>${previewHeaders.map((key) => `<th>${key.toUpperCase()}</th>`).join("")}</tr>`;
    $("#preview-body").innerHTML = importRows.slice(0, 5).map((row) => `<tr>${previewHeaders.map((key) => `<td>${escapeHtml(row[mapped[key]] || "")}</td>`).join("")}</tr>`).join("");
  }
  function importMappedRows() {
    if (!pendingImport) return;
    const mapped = Object.fromEntries($$("[data-map]").map((select) => [select.dataset.map, Number(select.value)]));
    if (mapped.date < 0 || mapped.amount < 0) { showToast("Map at least a date and amount column."); return; }
    const normalized = pendingImport.rows.map((row) => {
      let rawDate = (row[mapped.date] || "").trim();
      const iso = rawDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (iso) rawDate = `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
      else {
        const parsedDate = new Date(rawDate);
        if (!Number.isNaN(parsedDate.getTime())) rawDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
      }
      const rawAmount = (row[mapped.amount] || "").replace(/[₹,\s]/g, "");
      const amount = Math.abs(Number(rawAmount));
      const typeRaw = mapped.type >= 0 ? (row[mapped.type] || "").toLowerCase() : "";
      const type = /income|credit|deposit|inflow/.test(typeRaw) ? "income" : "expense";
      const category = mapped.category >= 0 && row[mapped.category].trim() ? row[mapped.category].trim() : (type === "income" ? "Other income" : "Other");
      const note = mapped.note >= 0 ? row[mapped.note].trim() : "";
      const account = mapped.account >= 0 && row[mapped.account].trim() ? row[mapped.account].trim() : "Everyday account";
      return { rawDate, amount, type, category, note, account };
    });
    const invalid = normalized.filter((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.rawDate) || !Number.isFinite(item.amount) || item.amount <= 0);
    if (invalid.length) { showToast(`${invalid.length} row${invalid.length === 1 ? "" : "s"} have an invalid date or amount. Fix the file and try again.`); return; }
    const imported = normalized.map((item) => ({ id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: item.note || item.category, category: item.category, type: item.type, amount: item.amount, date: item.rawDate, account: item.account, note: item.note }));
    state.transactions.push(...imported);
    save(); render(); closeModals(); showToast(`${imported.length} transaction${imported.length === 1 ? "" : "s"} imported.`);
  }

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) switchView(viewButton.dataset.view);
    const goButton = event.target.closest("[data-go]");
    if (goButton) switchView(goButton.dataset.go);
    if (event.target.closest("[data-open-add]") || event.target.closest("#add-transaction-top")) openTransactionModal();
    if (event.target.closest("[data-close-modal]")) closeModals();
    if (event.target.classList.contains("modal-backdrop")) closeModals();
    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) deleteTransaction(deleteButton.dataset.delete);
    const deleteBudgetButton = event.target.closest("[data-delete-budget]");
    if (deleteBudgetButton) {
      delete state.budgets[deleteBudgetButton.dataset.deleteBudget];
      save(); render(); showToast("Budget removed.");
    }
    const editBudgetButton = event.target.closest("[data-edit-budget]");
    if (editBudgetButton) {
      const name = editBudgetButton.dataset.editBudget;
      populateBudgetSelect();
      $("#budget-category").value = name;
      $("#budget-form").elements.limit.value = state.budgets[name];
      $("#budget-modal-title").textContent = `Edit ${name} budget`;
      openModal("budget-modal");
    }
    const editTransactionButton = event.target.closest("[data-edit-transaction]");
    if (editTransactionButton) editTransaction(editTransactionButton.dataset.editTransaction);
  });
  $$(".type-option").forEach((button) => button.addEventListener("click", () => {
    selectedType = button.dataset.type;
    $$(".type-option").forEach((item) => item.classList.toggle("active", item === button));
    const current = $("#transaction-category").value;
    populateCategorySelect($("#transaction-category"), selectedType);
    $("#transaction-category").value = Array.from($("#transaction-category").options).some((option) => option.value === current) ? current : (selectedType === "income" ? "Salary" : "Food & dining");
  }));
  $("#transaction-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(data.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) { showToast("Enter an amount greater than zero."); return; }
    const category = String(data.get("category"));
    const note = String(data.get("note") || "").trim();
    const transaction = { name: note || category, category, type: selectedType, amount, date: String(data.get("date")), account: String(data.get("account")), note };
    if (editingTransactionId !== null) {
      const current = state.transactions.find((item) => String(item.id) === String(editingTransactionId));
      if (current) Object.assign(current, transaction);
      state.lastCategory = category;
      save(); render(); closeModals(); showToast("Transaction updated.");
      editingTransactionId = null;
    } else {
      const budgetAlert = addTransaction({ id: `txn-${Date.now()}`, ...transaction });
      closeModals(); showToast(budgetAlert || "Transaction saved.");
    }
  });
  $("#add-budget-button").addEventListener("click", () => {
    $("#budget-form").reset();
    $("#budget-modal-title").textContent = "Set a budget";
    populateBudgetSelect();
    const available = Array.from($("#budget-category").options).find((option) => option.value !== "Overall" && !state.budgets[option.value]);
    if (available) $("#budget-category").value = available.value;
    openModal("budget-modal");
  });
  $("#budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.category.value;
    const limit = Number(form.elements.limit.value);
    if (!name || !Number.isFinite(limit) || limit <= 0) { showToast("Enter a category and a budget above zero."); return; }
    state.budgets[name] = limit;
    save(); render(); closeModals(); showToast(`${name} budget saved.`);
  });
  $("#month-picker").addEventListener("change", (event) => { if (event.target.value) { selectedMonth = event.target.value; render(); } });
  $("#budget-month-picker").addEventListener("change", (event) => { if (event.target.value) { selectedMonth = event.target.value; render(); } });
  $("#transaction-search").addEventListener("input", renderTransactions);
  $("#type-filter").addEventListener("change", renderTransactions);
  $("#category-filter").addEventListener("change", renderTransactions);
  $("#export-button").addEventListener("click", () => exportCsv());
  $("#export-report-button").addEventListener("click", () => exportCsv(monthTransactions(), `pennywise-report-${selectedMonth}.csv`));
  $("#import-button").addEventListener("click", openImport);
  $("#import-button-secondary").addEventListener("click", openImport);
  $("#csv-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Choose a CSV file smaller than 5 MB."); return; }
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("This CSV needs a header row and at least one transaction.");
      renderImportPreview(rows);
    } catch (error) {
      console.error("CSV import failed.", error);
      showToast(error.message || "Could not read this CSV file.");
    }
  });
  $("#mapping-grid").addEventListener("change", updateImportTable);
  $("#confirm-import").addEventListener("click", importMappedRows);
  $("#cancel-import").addEventListener("click", () => {
    $("#import-step-preview").classList.add("hidden");
    $("#import-step-upload").classList.remove("hidden");
    pendingImport = null;
  });
  $("#menu-button").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModals();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openTransactionModal(); }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "n" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) openTransactionModal();
  });

  populateCategorySelect($("#transaction-category"), "expense");
  populateBudgetSelect();
  render();
})();
