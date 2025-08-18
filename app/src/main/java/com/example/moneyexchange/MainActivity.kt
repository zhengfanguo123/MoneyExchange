package com.example.moneyexchange

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MoneyExchangeApp() }
    }
}

data class Expense(
    val localAmount: Double,
    val localCurrency: String,
    val krwAmount: Double,
    val note: String,
    val remainingBudget: Double
)

data class Country(val name: String, val currencyCode: String)

fun getCountries(): List<Country> {
    return Locale.getISOCountries().mapNotNull { code ->
        val locale = Locale("", code)
        runCatching {
            val currency = Currency.getInstance(locale)
            Country(locale.displayCountry, currency.currencyCode)
        }.getOrNull()
    }.sortedBy { it.name }
}

@Composable
fun MoneyExchangeApp() {
    val countries = remember { getCountries() }
    var expanded by remember { mutableStateOf(false) }
    var selectedCountry by remember { mutableStateOf(countries.firstOrNull()) }
    var budgetInput by remember { mutableStateOf("") }
    var budgetSet by remember { mutableStateOf(false) }
    var remainingBudget by remember { mutableStateOf(0.0) }

    var expenseAmount by remember { mutableStateOf("") }
    var expenseNote by remember { mutableStateOf("") }
    val expenses = remember { mutableStateListOf<Expense>() }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.padding(16.dp)) {
        Text(text = "Select Country")
        Box {
            OutlinedTextField(
                value = selectedCountry?.name ?: "",
                onValueChange = {},
                modifier = Modifier.fillMaxWidth().clickable { expanded = true },
                enabled = false,
                label = { Text("Country") }
            )
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                countries.forEach { country ->
                    DropdownMenuItem(text = { Text(country.name) }, onClick = {
                        selectedCountry = country
                        expanded = false
                    })
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = budgetInput,
            onValueChange = { budgetInput = it },
            label = { Text("Total Budget (KRW)") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = {
            remainingBudget = budgetInput.toDoubleOrNull() ?: 0.0
            budgetSet = true
        }, modifier = Modifier.padding(top = 8.dp)) {
            Text("Set Budget")
        }

        Text("Remaining Budget: ${remainingBudget}", modifier = Modifier.padding(vertical = 8.dp))

        if (budgetSet && selectedCountry != null) {
            OutlinedTextField(
                value = expenseAmount,
                onValueChange = { expenseAmount = it },
                label = { Text("Amount (${selectedCountry!!.currencyCode})") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = expenseNote,
                onValueChange = { expenseNote = it },
                label = { Text("Note") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
            )
            Button(onClick = {
                val local = expenseAmount.toDoubleOrNull()
                if (local != null) {
                    scope.launch {
                        val krw = convertCurrency(local, selectedCountry!!.currencyCode)
                        remainingBudget -= krw
                        expenses.add(
                            Expense(local, selectedCountry!!.currencyCode, krw, expenseNote, remainingBudget)
                        )
                        expenseAmount = ""
                        expenseNote = ""
                    }
                }
            }, modifier = Modifier.padding(top = 8.dp)) {
                Text("Add Expense")
            }
        }

        LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
            items(expenses) { expense ->
                Text("${expense.note}: ${expense.localAmount} ${expense.localCurrency} (~${expense.krwAmount} KRW) Remaining: ${expense.remainingBudget}")
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

suspend fun convertCurrency(amount: Double, from: String): Double {
    return withContext(Dispatchers.IO) {
        val url = URL("https://api.exchangerate.host/convert?from=${from}&to=KRW&amount=${amount}")
        val conn = url.openConnection() as HttpURLConnection
        try {
            val response = conn.inputStream.bufferedReader().readText()
            val json = JSONObject(response)
            json.getDouble("result")
        } finally {
            conn.disconnect()
        }
    }
}
