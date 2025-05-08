/** @type {(() => void)[]} */
const settingsLoaders = [
    loadFieldBudget,
    loadFieldCurrencyType
];

async function loadFieldBudget() {
    el("settingsBudget").value = `${(toCurrencyStringUSD(settings.budget)).replace("$", "")}`;
}

async function loadFieldCurrencyType() {
    const list = el("settingsCurrencyList");
    list.innerHTML = "";
    const currencies = await currenciesPromise;
    currencies
        .forEach((currency, k) => {
            if (currency.name.length === 0) {
                return;
            }
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.classList.add("dropdown-item");
            a.href = "#";
            a.textContent = currency.name;
            li.addEventListener("click", ev => {
                el("settingsCurrencyType").textContent = currency.name;
                settings.currencyType = k;
            });
            li.appendChild(a);
            list.appendChild(li);
        });
    el("settingsCurrencyType").textContent = currencies.get(settings.currencyType).name;
}

/**
 * @param {Event} ev 
 */
function saveSettings(ev) {
    hideAlert("settingsBudgetError");
    hideAlert("settingsSaveSuccess");
    /** @type {string} */
    const budgetStr = el("settingsBudget").value.trim();
    const budget = parseFloat(budgetStr);
    if (budgetStr.length === 0 || isNaN(budget) || budget < 0) {
        showAlert("settingsBudgetError", "Budget must be a positive number.");
        return;
    }
    settings.budget = budget;
    updateBrowser();
    showAlert("settingsSaveSuccess", "All changes saved.");
}

function resetData() {
    expenses = [];
    vendors = [];
    items = [];
    settings = structuredClone(defaultSettings);
    updateBrowser();
    location.reload();
}

/**
 * @param {Event} ev 
 */
function resetDataConfirm(ev) {
    setupConfirmation(resetData);
}

function exportData() {
    const blob = new Blob([JSON.stringify({ expenses, vendors, items, settings })], { type: "text/plain" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "ff.json";
    link.click();

    URL.revokeObjectURL(url);
    link.remove();
}

function importData() {
    hideAlert("settingsImportDataError");
    const fileSelector = document.createElement("input");
    fileSelector.type = "file";

    fileSelector.addEventListener("change", ev => {
        const reader = new FileReader();
        reader.onload = () => {
            fileSelector.remove();
            let data;
            try {
                data = JSON.parse(reader.result);
            } catch (err) {
                showAlert("settingsImportDataError", "Imported data is not in JSON format.");
                return;
            }
            if (!data.expenses) {
                showAlert("settingsImportDataError", "Imported data does not include data about expenses.");
                return;
            }
            if (!data.vendors) {
                showAlert("settingsImportDataError", "Imported data does not include data about vendors.");
                return;
            }
            if (!data.items) {
                showAlert("settingsImportDataError", "Imported data does not include data about products.");
                return;
            }
            if (!data.settings) {
                showAlert("settingsImportDataError", "Imported data does not include settings.");
                return;
            }
            expenses = data.expenses;
            vendors = data.vendors;
            items = data.items;
            settings = data.settings;
            updateBrowser();
            location.reload();
        };
        reader.readAsText(fileSelector.files[0]);
    });

    fileSelector.click();
}

(function () {
    settingsLoaders.forEach(loader => loader());

    el("settingsSave")
        .addEventListener("click", saveSettings);

    el("settingsResetData")
        .addEventListener("click", resetDataConfirm);

    el("settingsExportData")
        .addEventListener("click", exportData);

    el("settingsImportData")
        .addEventListener("click", importData);

})();