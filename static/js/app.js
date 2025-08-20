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
});
