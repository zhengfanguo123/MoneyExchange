$(function() {
    function fmtNumber(num) {
        return Number(num).toLocaleString();
    }

    function fmtDate(isoStr) {
        const d = new Date(isoStr);
        return d.toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function loadImportedData() {
        $.ajax({
            url: '/import_data',
            method: 'GET',
            success: function(res) {
                const container = $('#imported-content');
                container.empty();
                if (!res.trips || res.trips.length === 0) {
                    container.append($('<p>').text('No data found.'));
                } else {
                    res.trips.forEach(function(trip) {
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
                        trip.expenses.forEach(function(exp) {
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
            },
            error: function(err) {
                const msg = err.responseJSON && err.responseJSON.error ? err.responseJSON.error : 'Import failed';
                alert(msg);
            }
        });
    }

    $('#start-btn').on('click', function() {
        const country = $('#country').val();
        const budget = parseFloat($('#budget').val());
        if (!budget || budget <= 0) {
            alert('Enter a valid budget');
            return;
        }
        $.ajax({
            url: '/set_budget',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({country: country, budget: budget}),
            success: function(res) {
                $('#currency-code').text(res.currency);
                $('#remaining').text(fmtNumber(res.remaining));
                $('#setup').hide();
                $('#tracker').show();
            }
        });
    });

    $('#add-expense').on('click', function() {
        const amount = parseFloat($('#amount').val());
        const note = $('#note').val();
        if (!amount || amount <= 0) {
            alert('Enter a valid amount');
            return;
        }
        $.ajax({
            url: '/add_expense',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({amount: amount, note: note}),
            success: function(res) {
                const row = $('<tr>');
                row.append($('<td>').text(fmtNumber(amount) + ' ' + res.currency));
                row.append($('<td>').text(fmtNumber(res.krw)));
                row.append($('<td>').text(res.note));
                row.append($('<td>').text(fmtNumber(res.remaining)));
                $('#history tbody').append(row);
                $('#remaining').text(fmtNumber(res.remaining));
                $('#amount').val('');
                $('#note').val('');
            },
            error: function(err) {
                alert(err.responseJSON.error);
            }
        });
    });

    $('#import-btn').on('click', loadImportedData);

    $(document).on('click', '.delete-trip', function() {
        const id = $(this).data('trip-id');
        if (!confirm('Delete this trip and all its expenses?')) return;
        $.ajax({
            url: '/delete_trip/' + id,
            method: 'DELETE',
            success: function() { loadImportedData(); },
            error: function(err) {
                const msg = err.responseJSON && err.responseJSON.error ? err.responseJSON.error : 'Delete failed';
                alert(msg);
            }
        });
    });

    $(document).on('click', '.delete-expense', function() {
        const id = $(this).data('expense-id');
        if (!confirm('Delete this expense?')) return;
        $.ajax({
            url: '/delete_expense/' + id,
            method: 'DELETE',
            success: function() { loadImportedData(); },
            error: function(err) {
                const msg = err.responseJSON && err.responseJSON.error ? err.responseJSON.error : 'Delete failed';
                alert(msg);
            }
        });
    });
});

