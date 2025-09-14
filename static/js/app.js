$(function() {
    function fmtNumber(num) {
        return Number(num).toLocaleString();
    }

    function fmtDate(isoStr) {
        const d = new Date(isoStr);
        return d.toLocaleString();
    }

    function loadTripsFromStorage() {
        const data = localStorage.getItem('trips');
        return data ? JSON.parse(data) : [];
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
            let remaining = trip.budget_krw;
            trip.expenses.forEach(e => {
                remaining -= e.krw_amount;
                e.remaining = remaining;
            });
            trip.remaining_krw = remaining;
        }
        saveTripsToStorage(trips);
    }

    function renderCurrentTrip() {
        const tripId = parseInt(localStorage.getItem('currentTripId'), 10);
        if (!tripId) {
            $('#tracker').hide();
            $('#setup').show();
            return;
        }
        const trips = loadTripsFromStorage();
        const trip = trips.find(t => t.id === tripId);
        if (!trip) {
            $('#tracker').hide();
            $('#setup').show();
            return;
        }
        $('#currency-code').text(trip.currency);
        $('#remaining').text(fmtNumber(trip.remaining_krw));
        const tbody = $('#history tbody');
        tbody.empty();
        trip.expenses.forEach(exp => {
            const row = $('<tr>');
            row.append($('<td>').text(fmtNumber(exp.local_amount) + ' ' + exp.local_currency));
            row.append($('<td>').text(fmtNumber(exp.krw_amount)));
            row.append($('<td>').text(exp.note));
            row.append($('<td>').text(fmtNumber(exp.remaining)));
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
                const item = $(`
<div class="accordion-item" id="trip-card-${trip.id}">
  <h2 class="accordion-header" id="heading${trip.id}">
    <div class="d-flex align-items-center w-100">
      <button class="accordion-button collapsed flex-grow-1" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${trip.id}" aria-expanded="false" aria-controls="collapse${trip.id}">
        ${trip.country_code} | Budget KRW ${fmtNumber(trip.budget_krw)} | Remaining KRW ${fmtNumber(trip.remaining_krw)} | Created ${fmtDate(trip.created_at)}
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
  <td>${fmtNumber(exp.local_amount)} ${exp.local_currency}</td>
  <td>${fmtNumber(exp.krw_amount)}</td>
  <td>${exp.note}</td>
  <td>${fmtNumber(exp.remaining)}</td>
  <td>${fmtDate(exp.created_at)}</td>
  <td><button class="btn btn-danger btn-sm delete-expense" data-expense-id="${exp.id}" data-trip-id="${trip.id}">Delete</button></td>
</tr>`);
                    tbody.append(row);
                });
                container.append(item);
            });
        }
        $('#imported-section').show();
    }

    $('#start-btn').on('click', function() {
        const country = $('#country').val();
        const currency = $('#country option:selected').data('currency');
        const budget = parseFloat($('#budget').val());
        if (!budget || budget <= 0) {
            alert('Enter a valid budget');
            return;
        }
        const trips = loadTripsFromStorage();
        const id = getNextTripId();
        const trip = {
            id: id,
            country_code: country,
            currency: currency,
            budget_krw: budget,
            remaining_krw: budget,
            created_at: new Date().toISOString(),
            expenses: []
        };
        trips.push(trip);
        saveTripsToStorage(trips);
        localStorage.setItem('currentTripId', id);
        renderCurrentTrip();
    });

    $('#add-expense').on('click', function() {
        const amount = parseFloat($('#amount').val());
        const note = $('#note').val();
        if (!amount || amount <= 0) {
            alert('Enter a valid amount');
            return;
        }
        const tripId = parseInt(localStorage.getItem('currentTripId'), 10);
        const trips = loadTripsFromStorage();
        const trip = trips.find(t => t.id === tripId);
        if (!trip) {
            alert('Trip not found');
            return;
        }
        fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${trip.currency}&to=KRW`)
            .then(resp => resp.json())
            .then(data => {
                const krw = data.rates && data.rates.KRW ? data.rates.KRW : 0;
                const remaining = trip.remaining_krw - krw;
                const expId = getNextExpenseId(trip);
                const expense = {
                    id: expId,
                    local_amount: amount,
                    local_currency: trip.currency,
                    krw_amount: krw,
                    note: note,
                    remaining: remaining,
                    created_at: new Date().toISOString()
                };
                trip.remaining_krw = remaining;
                trip.expenses.push(expense);
                saveTripsToStorage(trips);
                renderCurrentTrip();
                $('#amount').val('');
                $('#note').val('');
            })
            .catch(() => alert('Exchange rate request failed'));
    });

    $('#import-btn').on('click', renderImportedData);

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
