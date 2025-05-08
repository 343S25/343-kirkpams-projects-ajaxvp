/** @type {(() => void)[]} */
const historyLoaders = [
    loadHistory
];

/**
 * Opens the "Edit" modal.
 * @param {MouseEvent} ev
 * @param {Expense} exp
 */
async function openModalEditExpense(ev, exp) {
    el("modalAddExpenseLabel").textContent = "Edit Expense";
    el("modalAddExpenseFinish").textContent = "Update";
    modalAddExpenseState = structuredClone(exp);
    el("modalAddExpenseVendorQuery").value = vendors[modalAddExpenseState.vendorId].name;
    loadModalAddExpenseVendorSearchList(ev);
    if (typeof modalAddExpenseState.total === "undefined" || modalAddExpenseState.total === -1) {
        /** @type {HTMLInputElement} */
        const yes = el("modalAddExpenseExplicitPriceYes");
        yes.click();
        await loadModalAddExpenseItemList(ev);
    } else {
        /** @type {HTMLInputElement} */
        const no = el("modalAddExpenseExplicitPriceNo");
        no.click();
        const priceEl = el("modalAddExpenseExplicitPrice");
        priceEl.value = modalAddExpenseState.total;
    }
    el("modalAddExpenseTax").value = modalAddExpenseState.tax;
    el("modalAddExpenseDate").value = toDateSelectorDateString(modalAddExpenseState.time);
    if (toFloorDay(modalAddExpenseState.time) !== 0) {
        el("modalAddExpenseTime").value = toTimeSelectorTimeString(modalAddExpenseState.time);
    }
    modalAddExpense.show();
}

/**
 * @param {Expense} exp 
 */
async function createHistoryEntry(exp) {
    const box = document.createElement("div");
    box.classList.add("border", "p-3", "module", "mb-3");

    const container = document.createElement("div");
    container.classList.add("container", "p-0");
    box.appendChild(container);

    const row = document.createElement("div");
    row.classList.add("row");
    container.appendChild(row);

    const colLeft = document.createElement("div");
    colLeft.classList.add("col-auto");
    row.appendChild(colLeft);

    const vendorName = document.createElement("div");
    vendorName.classList.add("fs-4");
    vendorName.textContent = getVendor(exp.vendorId).name;
    colLeft.appendChild(vendorName);

    const price = document.createElement("div");
    price.textContent = await toCurrencyString(getExpenseTotal(exp) + exp.tax);
    colLeft.appendChild(price);

    if (items.length !== 0) {
        const colMiddle = document.createElement("div");
        colMiddle.classList.add("col", "d-none", "d-md-flex", "align-items-center");
        row.appendChild(colMiddle);

        const itemList = document.createElement("div");
        itemList.classList.add("text-truncate");
        itemList.textContent = exp.itemIds.map(getItem).map((item, i) => `${item.name} ✕ ${exp.itemQuantities[i]}`).join(", ");
        colMiddle.appendChild(itemList);
    }

    const colRight = document.createElement("div");
    colRight.classList.add("col", "d-flex", "align-items-center", "justify-content-end", "py-2");
    row.appendChild(colRight);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.classList.add("btn", "secondary-clickable", "me-2");
    // editButton.id = maybe we do this?
    editButton.textContent = "Edit";
    editButton.addEventListener("click", ev => {
        openModalEditExpense(ev, exp);
    });
    colRight.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.classList.add("btn", "secondary-clickable", "ms-2");
    // deleteButton.id = maybe we do this?
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", ev => setupConfirmation(() => {
        removeExpense(exp.id);
        updateBrowser();
        location.reload();
    }));
    colRight.appendChild(deleteButton);

    return box;
}

/**
 * @param {number} timestamp
 */
function createDayHeader(timestamp) {
    const daystamp = toFloorDay(timestamp);

    const el = document.createElement("h5");
    el.classList.add("mb-3");
    el.textContent = toDateString(daystamp);

    return el;
}

async function loadHistory() {
    const historyList = el("historyList");
    if (expenses.length === 0) {
        const h5 = document.createElement("h1");
        h5.classList.add("fs-5");
        h5.textContent = "Start adding expenses to see them show up here!";
        historyList.appendChild(h5);
        return;
    }
    /** @type {Expense[]} */
    const sorted = expenses
        .toSorted((e1, e2) => e2.time - e1.time);
    let lastDay = 0;
    for (const exp of sorted) {
        if (toFloorDay(exp.time) !== lastDay) {
            historyList.appendChild(createDayHeader(exp.time));
        }
        historyList.appendChild(await createHistoryEntry(exp));
        lastDay = toFloorDay(exp.time);
    }
}

(function () {
    historyLoaders.forEach(loader => loader());
})();