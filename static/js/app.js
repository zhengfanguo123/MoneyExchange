$(function() {
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
                $('#remaining').text(res.remaining.toFixed(2));
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
                row.append($('<td>').text(amount.toFixed(2) + ' ' + res.currency));
                row.append($('<td>').text(res.krw.toFixed(2)));
                row.append($('<td>').text(res.note));
                row.append($('<td>').text(res.remaining.toFixed(2)));
                $('#history tbody').append(row);
                $('#remaining').text(res.remaining.toFixed(2));
                $('#amount').val('');
                $('#note').val('');
            },
            error: function(err) {
                alert(err.responseJSON.error);
            }
        });
    });

    $('#import-btn').on('click', function() {
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
                        const tripTable = $('<table>').addClass('data-table');
                        tripTable.append('<thead><tr><th>Country</th><th>Budget KRW</th><th>Remaining KRW</th><th>Created</th></tr></thead>');
                        const tBody = $('<tbody>');
                        const tRow = $('<tr>');
                        tRow.append($('<td>').text(trip.country_code));
                        tRow.append($('<td>').text(parseFloat(trip.budget_krw).toFixed(2)));
                        tRow.append($('<td>').text(parseFloat(trip.remaining_krw).toFixed(2)));
                        tRow.append($('<td>').text(trip.created_at));
                        tBody.append(tRow);
                        const expRow = $('<tr>');
                        const expCell = $('<td>').attr('colspan', 4);
                        const expTable = $('<table>').addClass('data-table');
                        expTable.append('<thead><tr><th>Local Amount</th><th>KRW Amount</th><th>Note</th><th>Remaining KRW</th><th>Timestamp</th></tr></thead>');
                        const expBody = $('<tbody>');
                        trip.expenses.forEach(function(exp) {
                            const r = $('<tr>');
                            r.append($('<td>').text(parseFloat(exp.local_amount).toFixed(2) + ' ' + exp.local_currency));
                            r.append($('<td>').text(parseFloat(exp.krw_amount).toFixed(2)));
                            r.append($('<td>').text(exp.note));
                            r.append($('<td>').text(parseFloat(exp.remaining).toFixed(2)));
                            r.append($('<td>').text(exp.created_at));
                            expBody.append(r);
                        });
                        expTable.append(expBody);
                        expCell.append(expTable);
                        expRow.append(expCell);
                        tBody.append(expRow);
                        tripTable.append(tBody);
                        container.append(tripTable);
                    });
                }
                $('#imported-section').show();
            },
            error: function(err) {
                const msg = err.responseJSON && err.responseJSON.error ? err.responseJSON.error : 'Import failed';
                alert(msg);
            }
        });
    });
});
