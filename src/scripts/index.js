/** @type {(() => void)[]} */
const indexLoaders = [
    loadFieldTotalSpentMonth,
    loadBudgetPieChart,
    loadDailyAmountSpentChart,
    loadFieldTopPurchasedMonth,
    loadFieldAverageDailyMonth,
    loadFieldTotalSpentAllTime,
    loadFieldTopVendorMonth,
    loadFieldTopSpendingMonth,
    loadFieldRemainingBudget,
    loadModuleRecentPurchases
];

/* sourced from: https://stackoverflow.com/questions/1184334/get-number-days-in-a-specified-month-using-javascript */
/**
 * @param {number} month 
 * @param {number} year 
 * @returns {number}
 */
function daysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

/**
 * For typing purposes.
 * @template T
 * @param {T} pattern
 * @param {number} length
 * @returns {T[]}
 */
function arrayOf(pattern, length) {
    return new Array(length).fill(pattern);
}

/**
 * For typing purposes.
 * @template K
 * @template V
 * @param {K} k 
 * @param {V} v 
 * @returns {Map<K, V>}
 */
function typedMap(k, v) {
    return new Map();
}

function getTotalSpentMonth() {
    return expenses
        .filter(onlyThisMonth)
        .map(exp => getExpenseTotal(exp) + exp.tax)
        .reduce(sum, 0);
}

async function loadFieldTotalSpentMonth() {
    const total = getTotalSpentMonth();
    el("fieldTotalSpentMonth").textContent = `${await toCurrencyString(total)}/${await toCurrencyString(settings.budget)}`;
}

async function loadBudgetPieChart() {
    const total = getTotalSpentMonth();
    const currencies = await currenciesPromise;
    new Chart(el("chartBudget"), {
        type: "doughnut",
        data: {
            labels: ["Used", "Remaining"],
            datasets: [{
                data: [Math.min(total, settings.budget), Math.max(0, settings.budget - total)],
                backgroundColor: [
                    "gray",
                    "green"
                ]
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context => context.formattedValue = `${toCurrencyStringSync(context.parsed, currencies)}`
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    })
}

async function loadDailyAmountSpentChart() {
    const now = new Date();
    const thirtyDaysAgo = toFloorDay(now.getTime()) - 2_592_000_000;
    const length = 30;
    /* mapping from day indices to money spent on that day */
    const values = expenses
        .filter(exp => exp.time >= thirtyDaysAgo)
        .reduce((prev, curr) => {
            const k = length - 1 - Math.abs(toFloorDay(curr.time) - toFloorDay(now.getTime())) / 86_400_000;
            prev[k] += getExpenseTotal(curr) + curr.tax;
            return prev;
        }, arrayOf(0, length))
        .slice(0, length);
    const labels = arrayOf("", length)
        .map((_, i) => {
            const date = new Date(toFloorDay(now.getTime()) - ((length - 1 - i) * 86_400_000));
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
    const currencies = await currenciesPromise;
    new Chart(el("chartDailyAmountSpent"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                fill: false,
                borderColor: "green",
                tension: 0.1
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => context.formattedValue = `${toCurrencyStringSync(context.parsed.y, currencies)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        // Include a dollar sign in the ticks
                        callback: value => toCurrencyStringSync(value, currencies)
                    }
                }
            },
            responsive: true
        }
    });
}

function loadFieldTopPurchasedMonth() {
    /** @type {Item} */
    const emptyItem = {};

    // so basically what this does:
    //  - takes all expenses
    //  - removes ones previous to this month
    //  - creates an array out of item, item quantity pairs from each expenses
    //  - creates a frequency map using those item, item quantity pairs to get
    //    the true item quantities across all expenses
    //  - finds the max item quantity
    const max = Array.from(expenses
        .filter(onlyThisMonth)
        .flatMap(exp => exp.itemIds.map(getItem).map((it, i) => [it, exp.itemQuantities[i]]))
        .reduce((prev, curr) => {
            /** @type {Item} */
            const it = curr[0];
            /** @type {number} */
            const quan = curr[1];
            prev.set(it, (prev.get(it) ?? 0) + quan);
            return prev;
        }, typedMap(emptyItem, 0))
        .entries())
        .reduce((prev, curr) => curr[1] > prev[1] ? curr : prev, [null, 0]);

    if (max[0])
        el("fieldTopPurchasedMonth").textContent = `${max[0].name} (${max[1]})`;
    else
        el("fieldTopPurchasedMonth").textContent = "(none yet!)";
}

async function loadFieldAverageDailyMonth() {
    // similar to the one above
    const totals = Array.from(expenses
        .filter(onlyThisMonth)
        .map(exp => [toFloorDay(exp.time), getExpenseTotal(exp) + exp.tax])
        .reduce((prev, curr) => {
            const timestamp = curr[0];
            const total = curr[1];
            prev.set(timestamp, (prev.get(timestamp) ?? 0) + total);
            return prev;
        }, typedMap(0, 0))
        .values());

    const now = new Date();

    if (totals.length !== 0)
        el("fieldAverageDailyMonth").textContent = await toCurrencyString(totals.reduce(sum, 0) / daysInMonth(now.getMonth() + 1, now.getFullYear()));
    else
        el("fieldAverageDailyMonth").textContent = "(no purchases yet!)";
}

async function loadFieldTotalSpentAllTime() {
    const total = expenses
        .map(exp => getExpenseTotal(exp) + exp.tax)
        .reduce(sum, 0);

    el("fieldTotalSpentAllTime").textContent = await toCurrencyString(total);
}

function loadFieldTopVendorMonth() {
    const top = Array.from(expenses
        .filter(onlyThisMonth)
        .map(exp => getVendor(exp.vendorId).name)
        .reduce((prev, curr) => {
            prev.set(curr, (prev.get(curr) ?? 0) + 1);
            return prev;
        }, typedMap("", 0))
        .entries())
        .reduce((prev, curr) => curr[1] > prev[1] ? curr : prev, [null, 0]);

    if (top[0])
        el("fieldTopVendorMonth").textContent = `${top[0]} (${top[1]})`;
    else
        el("fieldTopVendorMonth").textContent = "(none yet!)";
}

async function loadFieldTopSpendingMonth() {
    const max = Array.from(expenses
        .filter(onlyThisMonth)
        .map(exp => [toFloorDay(exp.time), getExpenseTotal(exp) + exp.tax])
        .reduce((prev, curr) => {
            const timestamp = curr[0];
            const total = curr[1];
            prev.set(timestamp, (prev.get(timestamp) ?? 0) + total);
            return prev;
        }, typedMap(0, 0))
        .entries())
        .reduce((prev, curr) => curr[1] > prev[1] ? curr : prev, [0, 0]);

    if (max[0])
        el("fieldTopSpendingMonth").textContent = `${await toCurrencyString(max[1])} (${toShortMonthDateString(max[0])})`;
    else
        el("fieldTopSpendingMonth").textContent = "(no purchases yet!)";
}

async function loadFieldRemainingBudget() {
    el("fieldRemainingBudget").textContent = await toCurrencyString(Math.max(0, settings.budget - getTotalSpentMonth()));
}

/**
 * @param {Expense} exp 
 */
async function createRecentPurchaseEntry(exp) {
    const container = document.createElement("div");
    container.classList.add("container", "p-0");

    const row = document.createElement("div");
    row.classList.add("row");
    container.appendChild(row);

    const colLeft = document.createElement("div");
    colLeft.classList.add("col");
    colLeft.textContent = `${toShortMonthDateString(exp.time)}: ${getVendor(exp.vendorId).name}`;
    row.appendChild(colLeft);

    const colRight = document.createElement("div");
    colRight.classList.add("col", "text-end");
    colRight.textContent = await toCurrencyString(getExpenseTotal(exp) + exp.tax);
    row.appendChild(colRight);

    return container;
}

async function loadModuleRecentPurchases() {
    const module = el("moduleRecentPurchasesPurchases");

    if (expenses.length === 0) {
        el("moduleRecentPurchases").classList.add("d-none");
        return;
    }

    /** @type {Expense[]} */
    const sorted = expenses
        .toSorted((e1, e2) => e2.time - e1.time);

    for (const exp of sorted.slice(0, 5)) {
        module.appendChild(await createRecentPurchaseEntry(exp))
    }
}

(function () {
    indexLoaders.forEach(loader => loader());
})();