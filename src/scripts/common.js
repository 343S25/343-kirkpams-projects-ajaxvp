/**
 * @typedef Expense
 * @type {object}
 * @property {number} id
 * @property {number} vendorId - the Vendor of this Expense.
 * @property {number} total - the total price of this Expense, -1 if calculated via Items.
 * @property {number[]} itemIds - the items purchased in this Expense.
 * @property {number[]} itemQuantities - the quantity of each item purchased in this Expense.
 * @property {number} tax - the total tax paid on this Expense.
 * @property {number} time - timestamp for when this Expense occurred.
 */

/**
 * @typedef Vendor
 * @type {object}
 * @property {number} id
 * @property {string} name - the name of this Vendor.
 * @property {number[]} productIds - the products that this Vendor carries.
 */

/**
 * @typedef Item
 * @type {object}
 * @property {number} id
 * @property {string} name - the name of this Item.
 * @property {number} price - the price of this Item, without tax.
 */

/**
 * @typedef Settings
 * @type {object}
 * @property {number} budget - the current budget for the month.
 * @property {string} currencyType - the type of currency used.
 */

/**
 * @typedef Currency
 * @type {object}
 * @property {string} name - the name of this currency
 * @property {number} exchange - the current exchange rate of this currency, relative to USD.
 */

/** @type {(elementId: string) => HTMLElement | null} */
const el = document.getElementById.bind(document);

/** @type {Settings} */
const defaultSettings = { budget: 50, currencyType: "usd" };

/** @type {Expense} */
let modalAddExpenseState;

/** @type {Expense[]} */
let expenses;

/** @type {Vendor[]} */
let vendors;

/** @type {Item[]} */
let items;

/** @type {Settings} */
let settings;

let currenciesPromise = loadCurrencyList();

const modalConfirmation = new bootstrap.Modal("#modalConfirmation", { keyboard: false });
/** @type {() => void} */
let modalConfirmationAction;

const modalAddExpense = new bootstrap.Modal("#modalAddExpense", { keyboard: false });
const modalSetPrice = new bootstrap.Modal("#modalSetPrice", { keyboard: false });
const modalSetQuantity = new bootstrap.Modal("#modalSetQuantity", { keyboard: false });

const modalAddExpenseDate = new Datepicker(el("modalAddExpenseDate"));

/**
 * Adds two numbers together.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function sum(a, b) {
    return a + b;
}

/**
 * Rounds the timestamp down to the lowest day.
 * @param {number} timestamp 
 */
function toFloorDay(timestamp) {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Converts the number to the corresponding currency string.
 * @param {number} value 
 * @returns {string}
 */
function toCurrencyString(value) {
    return new Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(value);
}

/**
 * Converts the timestamp to a formatted string like <month name> <day>, <year>
 * @param {number} timestamp 
 * @returns {string}
 */
function toDateString(timestamp) {
    return new Intl.DateTimeFormat("en-us", { day: "numeric", month: "long", year: "numeric" }).format(new Date(timestamp));
}

/**
 * Converts the timestamp to a formatted string like <month>/<day>
 * @param {number} timestamp 
 * @returns {string}
 */
function toShortMonthDateString(timestamp) {
    return new Intl.DateTimeFormat("en-us", { day: "numeric", month: "numeric" }).format(new Date(timestamp));
}

/**
 * Consider whether a given query is sufficient for a given value to appear in search.
 * @param {string} value 
 * @param {string} query
 * @returns {boolean}
 */
function considerForQuery(value, query) {
    return value.toLowerCase().includes(query.toLowerCase());
}

/**
 * Predicate for selecting Expenses that only occurred this month.
 * @param {Expense} exp 
 * @returns {boolean}
 */
function onlyThisMonth(exp) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth());
    return exp.time >= monthStart.getTime();
}

/**
 * Adds a Vendor to the "database."
 * @param {string} name 
 * @param {number[]} productIds 
 * @returns {Vendor}
 */
function addVendor(name, productIds = []) {
    /** @type {Vendor} */
    const vendor = {};
    vendor.name = name;
    vendor.productIds = productIds;
    vendor.id = vendors.length;
    vendors.push(vendor);
    return vendor;
}

/**
 * Adds an Item to the "database."
 * @param {string} name 
 * @param {number} price 
 * @param {number} vendorId 
 * @returns {Item}
 */
function addItem(name, price, vendorId) {
    /** @type {Item} */
    const item = {};
    item.name = name;
    item.price = price;
    item.id = items.length;
    getVendor(vendorId).productIds.push(item.id);
    items.push(item);
    return item;
}

/**
 * Adds an Expense to the "database."
 * @param {Expense} exp
 * @returns {Expense}
 */
function addExpense(exp) {
    exp.id = expenses.length;
    expenses.push(exp);
    return exp;
}

/**
 * Remove an Expense from the "database."
 * @param {number} id 
 */
function removeExpense(id) {
    expenses.splice(id, 1);
}

/**
 * Get a Vendor by its ID from the "database."
 * @param {number} id
 * @returns {Vendor} 
 */
function getVendor(id) {
    return vendors[id];
}

/**
 * Get an Item by its ID from the "database."
 * @param {number} id
 * @returns {Item} 
 */
function getItem(id) {
    return items[id];
}

/**
 * Get an Expense by its ID from the "database."
 * @param {number} id
 * @returns {Item} 
 */
function getExpense(id) {
    return expenses[id];
}

/**
 * Gets the total value of an Expense, without tax.
 * @param {Expense} exp
 */
function getExpenseTotal(exp) {
    if (!exp.total || exp.total === -1) {
        return exp.itemIds
            .map(getItem)
            .map((item, i) => item.price * exp.itemQuantities[i])
            .reduce(sum, 0);
    }
    return exp.total;
}

/**
 * Create a search result list item.
 * @param {string} text
 * @param {boolean} selected
 * @returns {HTMLLIElement}
 */
function createListItem(text, selected) {
    const li = document.createElement("li");
    li.classList.add("list-group-item");
    li.textContent = text;
    if (selected) {
        li.classList.add("secondary-clickable");
    } else {
        li.classList.add("white-clickable");
    }
    return li;
}

/**
 * Create a search result list item with two text fields.
 * @param {string} ltext
 * @param {string} rtext
 * @param {boolean} selected
 * @returns {HTMLLIElement}
 */
function createDoubleTextListItem(ltext, rtext, selected) {
    const li = document.createElement("li");
    li.classList.add("list-group-item");
    if (selected) {
        li.classList.add("secondary-clickable");
    } else {
        li.classList.add("white-clickable");
    }
    const container = document.createElement("div");
    container.classList.add("container", "p-0");
    const row = document.createElement("div");
    row.classList.add("row");
    const col1 = document.createElement("div");
    col1.classList.add("col");
    col1.textContent = ltext;
    const col2 = document.createElement("div");
    col2.classList.add("col", "text-end");
    col2.textContent = rtext;
    row.appendChild(col1);
    row.appendChild(col2);
    container.appendChild(row);
    li.appendChild(container);
    return li;
}

/**
 * Shows an alert message for the given alert element ID.
 * @param {string} id 
 * @param {string} msg 
 */
function showAlert(id, msg) {
    const element = el(id);
    element.classList.remove("d-none");
    element.textContent = msg;
}

/**
 * Hides the alert message for a given alert element ID.
 * @param {string} id 
 */
function hideAlert(id) {
    el(id).classList.add("d-none");
}

/**
 * Set up a confirmation action with a provided action on success.
 * @param {() => void} action 
 */
function setupConfirmation(action) {
    modalConfirmationAction = action;
    modalConfirmation.show();
}

/**
 * Opens the "Add Expense" modal.
 * @param {MouseEvent} ev 
 */
function openModalAddExpense(ev) {
    modalAddExpense.show();
}

/**
 * @param {Event} ev 
 */
function loadModalAddExpenseVendorSearchList(ev) {
    const ul = el("modalAddExpenseVendorSearchList");
    ul.innerHTML = "";
    const queryElement = el("modalAddExpenseVendorQuery");
    vendors
        .filter(vendor => queryElement.value.length !== 0 && considerForQuery(vendor.name, queryElement.value))
        .forEach(vendor => {
            const stateVendor = getVendor(modalAddExpenseState.vendorId);
            const li = createListItem(vendor.name,
                stateVendor && vendor.name === stateVendor.name);
            ul.appendChild(li);
            li.addEventListener("click", ev => {
                modalAddExpenseState.vendorId = vendor.id;
                loadModalAddExpenseVendorSearchList(ev);
            });
        });
}

/**
 * @param {Event} ev 
 */
function loadModalAddExpenseItemSelectorSearchList(ev) {
    if (typeof modalAddExpenseState.vendorId === "undefined") {
        showAlert("modalAddExpenseItemSelectorError", "No vendor has been selected yet.");
        return;
    }
    const stateVendor = getVendor(modalAddExpenseState.vendorId);
    const ul = el("modalAddExpenseItemSelectorSearchList");
    ul.innerHTML = "";
    const queryElement = el("modalAddExpenseItemSelectorQuery");
    items
        /* filters s/t the items shown will have names that contain the query string and 
           the vendor will have a product named as such */
        .filter(item => queryElement.value.length !== 0 &&
            considerForQuery(item.name, queryElement.value) &&
            stateVendor.productIds.map(getItem).find(it => it.name === item.name))
        .forEach(item => {
            const li = createDoubleTextListItem(item.name, `${toCurrencyString(item.price)}`,
                modalAddExpenseState.itemIds && modalAddExpenseState.itemIds.map(getItem).find(it => it.name === item.name));
            ul.appendChild(li);
            li.addEventListener("click", ev => {
                modalAddExpenseState.itemIds.push(item.id);
                modalSetQuantity.show();
            });
        });
}

/**
 * @param {Event} ev 
 */
function loadModalAddExpenseItemList(ev) {
    const ul = el("modalAddExpenseItemList");
    ul.innerHTML = "";
    modalAddExpenseState.itemIds.map(getItem).forEach((item, i) => {
        const quantity = modalAddExpenseState.itemQuantities[i];
        const li = createDoubleTextListItem(`${item.name} ✕ ${quantity}`, `${toCurrencyString(item.price * quantity)}`, false);
        ul.appendChild(li);
    });
}

/**
 * @param {Event} ev 
 */
function addVendorModalAddExpense(ev) {
    hideAlert("modalAddExpenseVendorError");
    /** @type {string} */
    const query = el("modalAddExpenseVendorQuery").value.trim();
    if (query.length === 0) {
        showAlert("modalAddExpenseVendorError", "Vendor name must not be empty.");
        return;
    }
    if (vendors.find(vendor => vendor.name === query)) {
        showAlert("modalAddExpenseVendorError", "That vendor already exists on FinanceFlow.");
        return;
    }
    addVendor(query);
    loadModalAddExpenseVendorSearchList(ev);
}

/**
 * @param {Event} ev
 */
function addItemModalAddExpense(ev) {
    hideAlert("modalAddExpenseItemSelectorError");
    if (typeof modalAddExpenseState.vendorId === "undefined") {
        showAlert("modalAddExpenseItemSelectorError", "No vendor has been selected yet.");
        return;
    }
    const stateVendor = getVendor(modalAddExpenseState.vendorId);
    /** @type {string} */
    const query = el("modalAddExpenseItemSelectorQuery").value.trim();
    if (query.length === 0) {
        showAlert("modalAddExpenseItemSelectorError", "Item name must not be empty.");
        return;
    }
    if (stateVendor.productIds.map(getItem).find(item => item.name === query)) {
        showAlert("modalAddExpenseItemSelectorError", `That ${stateVendor.name} product already exists on FinanceFlow.`);
        return;
    }
    modalSetPrice.show();
}

/**
 * @param {Event} ev
 */
function finishModalSetPrice(ev) {
    hideAlert("modalSetPriceError");
    const priceStr = el("modalSetPricePrice").value.trim();
    if (priceStr.length === 0) {
        showAlert("modalSetPriceError", "Enter a price for the item.");
        return;
    }
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
        showAlert("modalSetPriceError", "Enter a valid number for the price.");
        return;
    }
    /** @type {string} */
    const query = el("modalAddExpenseItemSelectorQuery").value.trim();
    addItem(query, price, modalAddExpenseState.vendorId);
    loadModalAddExpenseItemSelectorSearchList(ev);
    modalSetPrice.hide();
}

/**
 * @param {Event} ev
 */
function finishModalSetQuantity(ev) {
    hideAlert("modalSetQuantityError");
    const quantityStr = el("modalSetQuantityQuantity").value.trim();
    if (quantityStr.length === 0) {
        showAlert("modalSetQuantityError", "Enter a quantity for the item.");
        return;
    }
    const quantity = parseInt(quantityStr);
    if (isNaN(quantity) || quantity <= 0) {
        showAlert("modalSetQuantityError", "Enter a valid positive integer for the price.");
        return;
    }
    modalAddExpenseState.itemQuantities.push(quantity);
    modalSetQuantity.hide();
}

/**
 * @param {Event} ev
 */
function resetModalAddExpense(ev) {
    modalAddExpenseState = { itemIds: [], itemQuantities: [] };
    el("modalAddExpenseVendorQuery").value = "";
    el("modalAddExpenseVendorSearchList").innerHTML = "";
    hideAlert("modalAddExpenseVendorError");
    // TODO: remove vendors which have no associated expenses
}

/**
 * @param {Event} ev
 */
function resetModalSetQuantity(ev) {
    // an item quantity wasn't added
    if (modalAddExpenseState.itemQuantities.length !== modalAddExpenseState.itemIds.length) {
        modalAddExpenseState.itemIds.pop();
    }
    loadModalAddExpenseItemSelectorSearchList(ev);
    loadModalAddExpenseItemList(ev);

    el("modalSetQuantityQuantity").value = "";
}

/**
 * @param {Event} ev
 */
function showItemSelectorModalAddExpense(ev) {
    el("modalAddExpenseItemSelectorInputGroup").classList.remove("d-none");
    el("modalAddExpenseExplicitPriceInputGroup").classList.add("d-none");
}

/**
 * @param {Event} ev
 */
function showPriceInputModalAddExpense(ev) {
    el("modalAddExpenseItemSelectorInputGroup").classList.add("d-none");
    el("modalAddExpenseExplicitPriceInputGroup").classList.remove("d-none");
}

/**
 * @param {Event} ev
 */
function setTotalModalAddExpense(ev) {
    hideAlert("modalAddExpenseExplicitPriceError");
    const priceStr = el("modalAddExpenseExplicitPrice").value.trim();
    const price = parseFloat(priceStr);
    if (priceStr.length !== 0 && (isNaN(price) || price < 0)) {
        showAlert("modalAddExpenseExplicitPriceError", "Price must be a positive number.");
        return;
    }
    modalAddExpenseState.total = price;
}

/**
 * @param {Event} ev
 */
function setTaxModalAddExpense(ev) {
    hideAlert("modalAddExpenseTaxError");
    const taxStr = el("modalAddExpenseTax").value.trim();
    const tax = parseFloat(taxStr);
    if (taxStr.length !== 0 && (isNaN(tax) || tax < 0)) {
        showAlert("modalAddExpenseTaxError", "Tax must be a positive number.");
        return;
    }
    modalAddExpenseState.tax = tax;
}

/**
 * @param {Event} ev
 */
function setTimestampModalAddExpense(ev) {
    const dateStr = el("modalAddExpenseDate").value.trim();
    if (dateStr.length === 0) {
        modalAddExpenseState.time = 0;
        return;
    }
    const date = new Date(dateStr);
    if (isNaN(date)) {
        modalAddExpenseState.time = 0;
        return;
    }
    modalAddExpenseState.time = date.getTime();
    const timeStr = el("modalAddExpenseTime").value.trim();
    if (timeStr.length === 0) {
        return;
    }
    const timeStrParts = timeStr.split(":");
    modalAddExpenseState.time += parseInt(timeStrParts[0]) * 3_600_000;
    modalAddExpenseState.time += parseInt(timeStrParts[1]) * 60_000;
}

/**
 * @param {Event} ev
 */
function finishModalAddExpense(ev) {
    hideAlert("modalAddExpenseError");
    addExpense(structuredClone(modalAddExpenseState));
    updateBrowser();
    modalAddExpense.hide();
    if (typeof loadFieldTotalSpentMonth !== "undefined") {
        loadFieldTotalSpentMonth();
    }
    if (typeof loadBudgetPieChart !== "undefined") {
        loadBudgetPieChart();
    }
}

/**
 * @param {Event} ev
 */
function finishModalConfirmation(ev) {
    modalConfirmationAction();
    modalConfirmation.hide();
}

function updateBrowser() {
    localStorage.setItem("expenses", JSON.stringify(expenses));
    localStorage.setItem("vendors", JSON.stringify(vendors));
    localStorage.setItem("items", JSON.stringify(items));
    localStorage.setItem("settings", JSON.stringify(settings));
}

function updateSession() {
    expenses = JSON.parse(localStorage.getItem("expenses")) ?? [];
    vendors = JSON.parse(localStorage.getItem("vendors")) ?? [];
    items = JSON.parse(localStorage.getItem("items")) ?? [];
    settings = JSON.parse(localStorage.getItem("settings")) ?? structuredClone(defaultSettings);
}

async function loadCurrencyList() {
    /** @type {Response} */
    let currenciesResp;
    try {
        currenciesResp = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json");
    } catch {
        // fallback fetch, this should NOT fail (besides CORS...)
        currenciesResp = await fetch("../data/currency-list.json");
    }
    const currencyNames = await currenciesResp.json();
    /** @type {Response} */
    let exchangesResp;
    try {
        exchangesResp = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json");
    } catch {
        // fallback fetch, this should NOT fail (besides CORS...)
        exchangesResp = await fetch("../data/exchange-list.json");
    }
    // dr. stewart told me to log these...
    console.log(currenciesResp);
    console.log(exchangesResp);
    //
    const exchangeRates = await exchangesResp.json();
    /** @type {Map<string, Currency>} */
    const currencies = new Map();
    for (const id of Object.keys(currencyNames)) {
        /** @type {string} */
        const name = currencyNames[id];
        /** @type {number} */
        const exchangeRate = exchangeRates["usd"][id];
        currencies.set(id, { name: name, exchange: exchangeRate });
    }
    return currencies;
}

(function () {
    Chart.defaults.font.family = "'IBM Plex Mono', 'Courier New', Courier, monospace";

    updateSession();

    resetModalAddExpense(null);

    el("navbarAddExpense")
        .addEventListener("click", openModalAddExpense);

    el("modalAddExpenseVendorQuery")
        .addEventListener("input", loadModalAddExpenseVendorSearchList);

    el("modalAddExpenseVendorAdd")
        .addEventListener("click", addVendorModalAddExpense);

    el("modalAddExpense")
        .addEventListener("hidden.bs.modal", resetModalAddExpense);

    el("modalAddExpenseExplicitPriceYes")
        .addEventListener("input", showItemSelectorModalAddExpense);

    el("modalAddExpenseExplicitPriceNo")
        .addEventListener("input", showPriceInputModalAddExpense);

    el("modalAddExpenseItemSelectorQuery")
        .addEventListener("input", loadModalAddExpenseItemSelectorSearchList);

    el("modalAddExpenseItemSelectorAdd")
        .addEventListener("click", addItemModalAddExpense);

    el("modalSetPriceFinish")
        .addEventListener("click", finishModalSetPrice);

    el("modalSetQuantityFinish")
        .addEventListener("click", finishModalSetQuantity);

    el("modalSetQuantity")
        .addEventListener("hidden.bs.modal", resetModalSetQuantity);

    el("modalAddExpenseTax")
        .addEventListener("input", setTaxModalAddExpense);

    el("modalAddExpenseExplicitPrice")
        .addEventListener("input", setTotalModalAddExpense);

    el("modalAddExpenseDate")
        .addEventListener("input", setTimestampModalAddExpense);

    el("modalAddExpenseTime")
        .addEventListener("input", setTimestampModalAddExpense);

    el("modalAddExpenseFinish")
        .addEventListener("click", finishModalAddExpense);

    el("modalConfirmationYes")
        .addEventListener("click", finishModalConfirmation);

    el("modalConfirmationNo")
        .addEventListener("click", () => modalConfirmation.hide());

})();