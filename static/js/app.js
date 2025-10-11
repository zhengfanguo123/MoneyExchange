$(function() {
    const DECIMAL_OPTIONS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const DATE_OPTIONS = { hour12: false };
    const DIVIDER = '─────────────────────────────────────────────────────';
    const UTF8_BOM = String.fromCharCode(0xfeff);
    const RATE_CACHE_KEY = 'usdRateCache';
    const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
    const RATE_OVERRIDES = {
        KRW: 1300,
        RUB: 90,
        TWD: 32,
    };

    function roundCurrency(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    function toNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function toNullableNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function formatKRW(value) {
        return roundCurrency(value).toLocaleString('ko-KR', DECIMAL_OPTIONS);
    }

    function formatLocal(value) {
        return roundCurrency(value).toLocaleString('ko-KR', DECIMAL_OPTIONS);
    }

    function formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString('ko-KR', DATE_OPTIONS);
    }

    function sanitizeNote(note) {
        if (!note) return '';
        return String(note).replace(/\r?\n/g, ' ').trim();
    }

    function ensureExpenseShape(expense, tripMode) {
        const normalized = { ...expense };
        normalized.id = expense.id;
        normalized.local_amount = toNumber(expense.local_amount);
        normalized.local_currency = expense.local_currency || '';
        normalized.krw_amount = toNumber(expense.krw_amount);
        normalized.note = expense.note || '';
        normalized.created_at = expense.created_at || new Date().toISOString();
        normalized.fx_rate = typeof expense.fx_rate === 'number'
            ? expense.fx_rate
            : toNullableNumber(expense.fx_rate);
        if (normalized.fx_rate === null && normalized.local_amount) {
            const derived = normalized.krw_amount / normalized.local_amount;
            normalized.fx_rate = Number.isFinite(derived) ? derived : null;
        }
        normalized.fx_provider = expense.fx_provider || (tripMode === 'domestic' ? 'none' : 'frankfurter');
        normalized.remaining = toNumber(expense.remaining);
        return normalized;
    }

    function recalcTrip(trip) {
        let running = roundCurrency(trip.budget_krw);
        trip.expenses.forEach(exp => {
            const krw = roundCurrency(exp.krw_amount);
            running = roundCurrency(running - krw);
            exp.krw_amount = krw;
            exp.remaining = running;
            if (exp.fx_rate !== null && exp.fx_rate !== undefined) {
                exp.fx_rate = Number(exp.fx_rate);
            }
        });
        trip.remaining_krw = running;
    }

    function ensureTripShape(trip) {
        if (!trip) return null;
        const mode = trip.mode === 'domestic' ? 'domestic' : 'world';
        const normalized = {
            id: trip.id,
            country_code: trip.country_code,
            currency: trip.currency,
            mode: mode,
            budget_krw: roundCurrency(trip.budget_krw),
            remaining_krw: roundCurrency(
                typeof trip.remaining_krw === 'number' ? trip.remaining_krw : trip.budget_krw
            ),
            created_at: trip.created_at || new Date().toISOString(),
            expenses: Array.isArray(trip.expenses)
                ? trip.expenses.map(exp => ensureExpenseShape(exp, mode))
                : [],
            nextExpenseId: toNumber(trip.nextExpenseId) || 1,
        };
        if (!normalized.currency) {
            normalized.currency = mode === 'domestic' ? 'KRW' : '';
        }
        recalcTrip(normalized);
        if (!normalized.nextExpenseId || normalized.nextExpenseId <= normalized.expenses.length) {
            const maxId = normalized.expenses.reduce((max, exp) => {
                const id = toNumber(exp.id);
                return id > max ? id : max;
            }, 0);
            normalized.nextExpenseId = maxId + 1;
        }
        return normalized;
    }

    function loadTripsFromStorage() {
        const data = localStorage.getItem('trips');
        if (!data) return [];
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed.map(ensureTripShape).filter(Boolean) : [];
        } catch (err) {
            console.error('Failed to parse stored trips', err);
            return [];
        }
    }

    function saveTripsToStorage(trips) {
        localStorage.setItem('trips', JSON.stringify(trips));
    }

    function getNextTripId() {
        let id = parseInt(localStorage.getItem('nextTripId') || '1', 10);
        localStorage.setItem('nextTripId', id + 1);
        return id;
    }

    function getNextExpenseId(trip) {
        if (!trip.nextExpenseId) trip.nextExpenseId = 1;
        const id = trip.nextExpenseId;
        trip.nextExpenseId += 1;
        return id;
    }

    function deleteTripFromStorage(tripId) {
        const trips = loadTripsFromStorage().filter(t => t.id !== tripId);
        saveTripsToStorage(trips);
    }

    function deleteExpenseFromStorage(tripId, expenseId) {
        const trips = loadTripsFromStorage();
        const trip = trips.find(t => t.id === tripId);
        if (trip) {
            trip.expenses = trip.expenses.filter(e => e.id !== expenseId);
            recalcTrip(trip);
        }
        saveTripsToStorage(trips);
    }

    function clearAllStoredData() {
        localStorage.removeItem('trips');
        localStorage.removeItem('currentTripId');
        localStorage.removeItem('nextTripId');
    }

    function formatExpenseNote(note) {
        const sanitized = sanitizeNote(note);
        return sanitized || '';
    }

    function updateTripHeader(trip) {
        const label = trip.mode === 'domestic' ? 'Domestic (KRW)' : 'World Travel';
        $('#trip-label').text(label);
        $('#trip-country').text(`${trip.country_code} | ${trip.currency}`);
    }

    function showModeSelection() {
        $('#mode-selection').show();
        $('#world-setup').hide();
        $('#domestic-setup').hide();
    }

    function showWorldSetup() {
        $('#mode-selection').hide();
        $('#domestic-setup').hide();
        $('#world-setup').show();
    }

    function showDomesticSetup() {
        $('#mode-selection').hide();
        $('#world-setup').hide();
        $('#domestic-setup').show();
    }

    function renderCurrentTrip() {
        const tripId = parseInt(localStorage.getItem('currentTripId'), 10);
        if (!tripId) {
            $('#tracker').hide();
            $('#setup').show();
            showModeSelection();
            return;
        }
        const trips = loadTripsFromStorage();
        const trip = trips.find(t => t.id === tripId);
        if (!trip) {
            $('#tracker').hide();
            $('#setup').show();
            showModeSelection();
            return;
        }
        updateTripHeader(trip);
        $('#currency-code').text(trip.currency);
        $('#remaining').text(formatKRW(trip.remaining_krw));
        const tbody = $('#history tbody');
        tbody.empty();
        trip.expenses.forEach(exp => {
            const row = $('<tr>');
            row.append($('<td>').text(`${formatLocal(exp.local_amount)} ${exp.local_currency}`));
            row.append($('<td>').text(formatKRW(exp.krw_amount)));
            row.append($('<td>').text(formatExpenseNote(exp.note)));
            row.append($('<td>').text(formatKRW(exp.remaining)));
            tbody.append(row);
        });
        $('#setup').hide();
        $('#tracker').show();
    }

    function renderImportedData() {
        const trips = loadTripsFromStorage();
        const container = $('#imported-content');
        container.empty();
        if (trips.length === 0) {
            container.append($('<p>').text('No data found.'));
        } else {
            trips.forEach(trip => {
                const headerLabel = trip.mode === 'domestic'
                    ? `Domestic (KRW) | 총예산 KRW ${formatKRW(trip.budget_krw)} | 잔액 KRW ${formatKRW(trip.remaining_krw)} | 생성 ${formatDate(trip.created_at)}`
                    : `${trip.country_code} (${trip.currency}) | 총예산 KRW ${formatKRW(trip.budget_krw)} | 잔액 KRW ${formatKRW(trip.remaining_krw)} | 생성 ${formatDate(trip.created_at)}`;
                const item = $(`
<div class="accordion-item" id="trip-card-${trip.id}">
  <h2 class="accordion-header" id="heading${trip.id}">
    <div class="d-flex align-items-center w-100">
      <button class="accordion-button collapsed flex-grow-1" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${trip.id}" aria-expanded="false" aria-controls="collapse${trip.id}">
        ${headerLabel}
      </button>
      <button class="btn btn-danger btn-sm ms-2 delete-trip" data-trip-id="${trip.id}">Delete</button>
    </div>
  </h2>
  <div id="collapse${trip.id}" class="accordion-collapse collapse" aria-labelledby="heading${trip.id}" data-bs-parent="#imported-content">
    <div class="accordion-body">
      <h3 class="h6 mb-3">Expenses</h3>
      <div class="table-responsive">
        <table class="table table-bordered table-striped table-sm mb-0">
          <thead><tr><th>Local Amount</th><th>KRW Amount</th><th>Note</th><th>Remaining KRW</th><th>Timestamp</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>
</div>`);
                const tbody = item.find('tbody');
                trip.expenses.forEach(exp => {
                    const row = $(`
<tr id="expense-row-${exp.id}">
  <td>${formatLocal(exp.local_amount)} ${exp.local_currency}</td>
  <td>${formatKRW(exp.krw_amount)}</td>
  <td>${formatExpenseNote(exp.note)}</td>
  <td>${formatKRW(exp.remaining)}</td>
  <td>${formatDate(exp.created_at)}</td>
  <td><button class="btn btn-danger btn-sm delete-expense" data-expense-id="${exp.id}" data-trip-id="${trip.id}">Delete</button></td>
</tr>`);
                    tbody.append(row);
                });
                container.append(item);
            });
        }
        $('#imported-section').show();
    }

    function selectTripsForExport(scope) {
        const trips = loadTripsFromStorage();
        if (scope === 'current') {
            const tripId = parseInt(localStorage.getItem('currentTripId'), 10);
            if (!tripId) return [];
            const trip = trips.find(t => t.id === tripId);
            return trip ? [trip] : [];
        }
        return trips;
    }

    function formatFxRate(expense) {
        if (expense.fx_rate === null || expense.fx_rate === undefined) {
            return '없음';
        }
        return Number(expense.fx_rate).toFixed(6);
    }

    function applyRateOverrides(rawRates) {
        const normalized = { USD: 1 };
        if (rawRates && typeof rawRates === 'object') {
            Object.entries(rawRates).forEach(([code, value]) => {
                const upper = String(code || '').toUpperCase();
                const numeric = Number(value);
                if (upper && Number.isFinite(numeric) && numeric > 0) {
                    normalized[upper] = numeric;
                }
            });
        }
        Object.entries(RATE_OVERRIDES).forEach(([code, value]) => {
            if (!normalized[code] || !Number.isFinite(normalized[code]) || normalized[code] <= 0) {
                normalized[code] = value;
            }
        });
        return normalized;
    }

    function hasRequiredRates(rates, requiredCurrencies) {
        if (!rates || !Number.isFinite(rates.KRW) || rates.KRW <= 0) {
            return false;
        }
        for (const code of requiredCurrencies) {
            if (code === 'USD' || code === 'KRW') continue;
            if (!Number.isFinite(rates[code]) || rates[code] <= 0) {
                return false;
            }
        }
        return true;
    }

    function loadCachedUsdRates(requiredCurrencies) {
        try {
            const raw = localStorage.getItem(RATE_CACHE_KEY);
            if (!raw) return null;
            const payload = JSON.parse(raw);
            if (!payload || typeof payload.timestamp !== 'number' || !payload.rates) {
                return null;
            }
            if (Date.now() - payload.timestamp > RATE_CACHE_TTL_MS) {
                return null;
            }
            const rates = applyRateOverrides(payload.rates);
            if (!hasRequiredRates(rates, requiredCurrencies)) {
                return null;
            }
            return {
                provider: payload.provider || 'cache',
                rates,
                timestamp: payload.timestamp,
            };
        } catch (error) {
            console.warn('Failed to read cached USD rates', error);
            return null;
        }
    }

    function storeUsdRatesCache(data) {
        const payload = {
            timestamp: Date.now(),
            provider: data.provider,
            rates: data.rates,
        };
        try {
            localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to store USD rate cache', error);
        }
    }

    function fetchOpenErApiRates() {
        const url = 'https://open.er-api.com/v6/latest/USD';
        return fetch(url).then(resp => {
            if (!resp.ok) {
                throw new Error('open.er-api.com request failed');
            }
            return resp.json();
        }).then(data => {
            if (!data || data.result !== 'success' || !data.rates) {
                throw new Error('open.er-api.com missing rate table');
            }
            return {
                provider: 'open.er-api.com',
                rates: data.rates,
            };
        });
    }

    function fetchFawazRates() {
        const url = 'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd.json';
        return fetch(url).then(resp => {
            if (!resp.ok) {
                throw new Error('Fawaz currency API request failed');
            }
            return resp.json();
        }).then(data => {
            if (!data || !data.usd) {
                throw new Error('Fawaz currency API missing USD table');
            }
            return {
                provider: 'fawazahmed-currency-api',
                rates: data.usd,
            };
        });
    }

    function fetchFrankfurterRates() {
        const url = 'https://api.frankfurter.app/latest?from=USD';
        return fetch(url).then(resp => {
            if (!resp.ok) {
                throw new Error('Frankfurter request failed');
            }
            return resp.json();
        }).then(data => {
            if (!data || !data.rates) {
                throw new Error('Frankfurter missing rate table');
            }
            return {
                provider: 'frankfurter',
                rates: data.rates,
            };
        });
    }

    function fetchFreshUsdRates(requiredCurrencies) {
        const sources = [fetchOpenErApiRates, fetchFawazRates, fetchFrankfurterRates];
        let index = 0;

        function attempt(lastError) {
            if (index >= sources.length) {
                if (lastError) throw lastError;
                throw new Error('All USD rate sources failed');
            }
            const next = sources[index];
            index += 1;
            return next()
                .then(result => {
                    const rates = applyRateOverrides(result.rates);
                    if (!hasRequiredRates(rates, requiredCurrencies)) {
                        throw new Error('Missing required rates');
                    }
                    return {
                        provider: result.provider,
                        rates,
                    };
                })
                .catch(error => {
                    console.warn('USD rate source failed', error);
                    return attempt(error);
                });
        }

        return attempt();
    }

    function getUsdRates(requiredCurrencies = []) {
        const required = new Set();
        required.add('KRW');
        requiredCurrencies.forEach(code => {
            if (code) {
                required.add(String(code).toUpperCase());
            }
        });

        const cached = loadCachedUsdRates(required);
        if (cached) {
            return Promise.resolve({
                provider: cached.provider ? `${cached.provider} (cached)` : 'cache',
                rates: cached.rates,
            });
        }

        return fetchFreshUsdRates(required).then(result => {
            storeUsdRatesCache(result);
            return result;
        });
    }

    function convertToKRW(amount, currency) {
        const numericAmount = toNumber(amount);
        const baseAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
        const upperCurrency = String(currency || '').toUpperCase();

        if (upperCurrency === 'KRW' || upperCurrency === '') {
            const rate = 1;
            const krw = roundCurrency(baseAmount);
            return Promise.resolve({ krw, rate, provider: 'self' });
        }

        return getUsdRates([upperCurrency]).then(result => {
            const rates = result.rates;
            const provider = result.provider;
            const usdToKrw = Number(rates.KRW);
            if (!Number.isFinite(usdToKrw) || usdToKrw <= 0) {
                throw new Error('KRW rate unavailable');
            }

            let conversionRate;
            if (upperCurrency === 'USD') {
                conversionRate = usdToKrw;
            } else {
                const usdToLocal = Number(rates[upperCurrency]);
                if (!Number.isFinite(usdToLocal) || usdToLocal <= 0) {
                    throw new Error(`Rate unavailable for ${upperCurrency}`);
                }
                conversionRate = usdToKrw / usdToLocal;
            }

            const krwRaw = baseAmount * conversionRate;
            const krw = roundCurrency(krwRaw);
            return {
                krw,
                rate: conversionRate,
                provider,
            };
        });
    }

    function buildTextExport(trips) {
        if (trips.length === 0) return '';
        const lines = [];
        trips.forEach(trip => {
            const totalSpent = trip.expenses.reduce((sum, exp) => sum + toNumber(exp.krw_amount), 0);
            lines.push(DIVIDER);
            lines.push('[여행 요약]');
            lines.push(`여행ID: ${trip.id}  | 국가: ${trip.country_code} | 통화: ${trip.currency}`);
            lines.push(`총예산(KRW): ${formatKRW(trip.budget_krw)}  | 잔액(KRW): ${formatKRW(trip.remaining_krw)}`);
            lines.push(`생성시각: ${formatDate(trip.created_at)}`);
            lines.push('');
            lines.push('[지출 내역]');
            if (trip.expenses.length === 0) {
                lines.push('지출 내역이 없습니다.');
            } else {
                trip.expenses.forEach(exp => {
                    const note = sanitizeNote(exp.note) || '없음';
                    const fx = trip.mode === 'domestic' ? '없음' : formatFxRate(exp);
                    lines.push(`- ${formatLocal(exp.local_amount)} ${exp.local_currency}  →  ${formatKRW(exp.krw_amount)} KRW | 용도: ${note} | 환율: ${fx} | 지출후잔액: ${formatKRW(exp.remaining)} | ${formatDate(exp.created_at)}`);
                });
            }
            lines.push('');
            lines.push('[합계]');
            lines.push(`지출건수: ${trip.expenses.length}  | 지출합계(KRW): ${formatKRW(totalSpent)}`);
            lines.push(DIVIDER);
        });
        return lines.join('\n');
    }

    function csvEscape(value) {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (/[",\n\s]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    function buildCsvExport(trips) {
        if (trips.length === 0) return '';
        const header = ['여행ID', '국가코드', '통화', '총예산(KRW)', '잔액(KRW)', '지출ID', '현지금액', '현지통화', 'KRW금액', '환율', '용도', '지출후잔액(KRW)', '생성시각'];
        const rows = [header.map(csvEscape).join(',')];
        trips.forEach(trip => {
            if (trip.expenses.length === 0) {
                rows.push([
                    trip.id,
                    trip.country_code,
                    trip.currency,
                    formatKRW(trip.budget_krw),
                    formatKRW(trip.remaining_krw),
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    formatDate(trip.created_at),
                ].map(csvEscape).join(','));
                return;
            }
            trip.expenses.forEach(exp => {
                const note = sanitizeNote(exp.note);
                const fx = trip.mode === 'domestic' ? '없음' : formatFxRate(exp);
                rows.push([
                    trip.id,
                    trip.country_code,
                    trip.currency,
                    formatKRW(trip.budget_krw),
                    formatKRW(trip.remaining_krw),
                    exp.id,
                    formatLocal(exp.local_amount),
                    exp.local_currency,
                    formatKRW(exp.krw_amount),
                    fx,
                    note,
                    formatKRW(exp.remaining),
                    formatDate(exp.created_at),
                ].map(csvEscape).join(','));
            });
        });
        return rows.join('\n');
    }

    function triggerDownload(content, filename, mimeType, options = {}) {
        const { addBom = false } = options;
        const payload = addBom ? UTF8_BOM + content : content;
        const blob = new Blob([payload], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function exportTrips(format) {
        const scope = $('#export-scope').val();
        const trips = selectTripsForExport(scope);
        if (trips.length === 0) {
            alert('내보낼 여행 데이터가 없습니다.');
            return;
        }
        const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
        if (format === 'txt') {
            triggerDownload(buildTextExport(trips), `trips-${timestamp}.txt`, 'text/plain');
        } else if (format === 'csv') {
            const csv = buildCsvExport(trips);
            triggerDownload(csv, `trips-${timestamp}.csv`, 'text/csv', { addBom: true });
        }
    }

    function startTrip(mode) {
        const budgetInput = mode === 'domestic' ? $('#domestic-budget') : $('#world-budget');
        const budget = parseFloat(budgetInput.val());
        if (!Number.isFinite(budget) || budget <= 0) {
            alert('Enter a valid budget');
            return;
        }
        let country;
        let currency;
        if (mode === 'domestic') {
            country = 'KR';
            currency = 'KRW';
        } else {
            const selected = $('#world-country option:selected');
            country = selected.val();
            currency = selected.data('currency');
            if (!currency) {
                alert('선택한 여행지의 통화를 확인할 수 없습니다.');
                return;
            }
        }
        const trips = loadTripsFromStorage();
        const id = getNextTripId();
        const trip = ensureTripShape({
            id,
            country_code: country,
            currency: currency,
            mode: mode,
            budget_krw: budget,
            remaining_krw: budget,
            created_at: new Date().toISOString(),
            expenses: [],
            nextExpenseId: 1,
        });
        trips.push(trip);
        saveTripsToStorage(trips);
        localStorage.setItem('currentTripId', id);
        renderCurrentTrip();
        budgetInput.val('');
    }

    $('#choose-world').on('click', function() {
        showWorldSetup();
    });

    $('#choose-domestic').on('click', function() {
        showDomesticSetup();
    });

    $('#cancel-world').on('click', function() {
        $('#world-budget').val('');
        showModeSelection();
    });

    $('#cancel-domestic').on('click', function() {
        $('#domestic-budget').val('');
        showModeSelection();
    });

    $('#start-world-btn').on('click', function() {
        startTrip('world');
    });

    $('#start-domestic-btn').on('click', function() {
        startTrip('domestic');
    });

    $('#add-expense').on('click', function() {
        const amount = parseFloat($('#amount').val());
        const note = $('#note').val();
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid amount');
            return;
        }
        const tripId = parseInt(localStorage.getItem('currentTripId'), 10);
        if (!tripId) {
            alert('Trip not found');
            return;
        }
        const trips = loadTripsFromStorage();
        const trip = trips.find(t => t.id === tripId);
        if (!trip) {
            alert('Trip not found');
            return;
        }
        if (trip.mode === 'domestic') {
            const krw = roundCurrency(amount);
            const remaining = roundCurrency(trip.remaining_krw - krw);
            const expense = {
                id: getNextExpenseId(trip),
                local_amount: amount,
                local_currency: trip.currency,
                krw_amount: krw,
                note: note,
                remaining: remaining,
                created_at: new Date().toISOString(),
                fx_rate: null,
                fx_provider: 'none',
            };
            trip.remaining_krw = remaining;
            trip.expenses.push(expense);
            recalcTrip(trip);
            saveTripsToStorage(trips);
            renderCurrentTrip();
            $('#amount').val('');
            $('#note').val('');
            return;
        }
        convertToKRW(amount, trip.currency)
            .then(result => {
                const krw = result.krw;
                const fxRate = result.rate;
                const remaining = roundCurrency(trip.remaining_krw - krw);
                const expense = {
                    id: getNextExpenseId(trip),
                    local_amount: amount,
                    local_currency: trip.currency,
                    krw_amount: krw,
                    note: note,
                    remaining: remaining,
                    created_at: new Date().toISOString(),
                    fx_rate: fxRate,
                    fx_provider: result.provider,
                };
                trip.remaining_krw = remaining;
                trip.expenses.push(expense);
                recalcTrip(trip);
                saveTripsToStorage(trips);
                renderCurrentTrip();
                $('#amount').val('');
                $('#note').val('');
            })
            .catch(error => {
                console.error('Failed to convert currency', error);
                alert('환율 정보를 가져올 수 없습니다. 잠시 후 다시 시도하세요.');
            });
    });

    $('#import-btn').on('click', renderImportedData);

    $('#export-txt-btn').on('click', function() {
        exportTrips('txt');
    });

    $('#export-csv-btn').on('click', function() {
        exportTrips('csv');
    });

    $('#clear-storage-btn').on('click', function() {
        if (!confirm('Do you want to delete existing data?')) {
            return;
        }
        clearAllStoredData();
        $('#imported-content').empty();
        $('#imported-section').hide();
        renderCurrentTrip();
    });

    $(document).on('click', '.delete-trip', function() {
        const id = $(this).data('trip-id');
        if (!confirm('Delete this trip and all its expenses?')) return;
        deleteTripFromStorage(id);
        if (parseInt(localStorage.getItem('currentTripId'), 10) === id) {
            localStorage.removeItem('currentTripId');
            renderCurrentTrip();
        }
        renderImportedData();
    });

    $(document).on('click', '.delete-expense', function() {
        const tripId = $(this).data('trip-id');
        const expId = $(this).data('expense-id');
        if (!confirm('Delete this expense?')) return;
        deleteExpenseFromStorage(tripId, expId);
        if (parseInt(localStorage.getItem('currentTripId'), 10) === tripId) {
            renderCurrentTrip();
        }
        renderImportedData();
    });

    renderCurrentTrip();
});

