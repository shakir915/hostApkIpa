package com.example.profitloss

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.util.zip.ZipFile
import kotlin.math.abs

// ==================== CONFIGURATION ====================
object Config {
    const val ZIP_FILE_PATH = "/path/to/your/data.zip" // Update this path
    const val URL_ENDPOINT = "https://your-api-endpoint.com/tradebook" // Update this URL
}

// ==================== DATA MODELS ====================
@Serializable
data class BillEntry(
    val date: String? = null,
    val trade_date: String? = null,
    val bill_amt: Double? = null,
    val turnover: Double? = null
)

@Serializable
data class BillData(
    val s: String,
    val data: BillDataWrapper? = null
)

@Serializable
data class BillDataWrapper(
    val DATA: List<BillEntry>
)

@Serializable
data class ExpenseEntry(
    val trade_date: String,
    val sebi_toc: Double = 0.0,
    val exchange_txn_charge: Double = 0.0,
    val brokerage: Double = 0.0,
    val cm_charge: Double = 0.0,
    val stt: Double = 0.0,
    val gst: Double = 0.0,
    val stamp_duty: Double = 0.0,
    val ipft: Double = 0.0
)

@Serializable
data class ExpenseData(
    val s: String,
    val data: ExpenseDataWrapper? = null
)

@Serializable
data class ExpenseDataWrapper(
    val DATA: List<ExpenseEntry>
)

@Serializable
data class TradeEntry(
    val date: String? = null,
    val trade_date: String? = null,
    val symbol: String,
    val type: String,
    val qty: Double,
    val trade_val: Double,
    val segment: String = "UNKNOWN"
)

@Serializable
data class TradeData(
    val s: String,
    val data: TradeDataWrapper? = null
)

@Serializable
data class TradeDataWrapper(
    val DATA: List<TradeEntry>
)

@Serializable
data class URLTradeEntry(
    val clientId: String? = null,
    val exchange: Int,
    val exchangeOrderNo: String,
    val fyToken: String? = null,
    val orderDateTime: String? = null,
    val orderNumber: String? = null,
    val orderTag: String? = null,
    val orderType: Int? = null,
    val productType: String? = null,
    val row: Long? = null,
    val segment: Int,
    val side: Int,
    val symbol: String,
    val tradeNumber: String? = null,
    val tradePrice: Double,
    val tradeValue: Double,
    val tradedQty: Double
)

@Serializable
data class URLDateData(
    val code: Int? = null,
    val message: String? = null,
    val s: String? = null,
    val tradeBook: List<URLTradeEntry>
)

data class TradeInfo(
    val buy: TradeStats = TradeStats(),
    val sell: TradeStats = TradeStats(),
    val segment: String = "UNKNOWN",
    val isExpiry: Boolean = false
)

data class TradeStats(
    var qty: Double = 0.0,
    var value: Double = 0.0
)

data class EnhancedTradeInfo(
    val trade: TradeInfo,
    var intradayTPL: Double = 0.0,
    var sellTPL: Double = 0.0,
    var buyExpTPL: Double = 0.0,
    var unmatchedBuy: Double = 0.0,
    var unmatchedSell: Double = 0.0
)

data class DateEntry(
    val date: Date,
    val originalDate: String,
    val billAmount: Double,
    val expense: Double,
    val grossProfit: Double,
    val tpl: Double,
    val ntpl: Double,
    val trades: Map<String, TradeInfo>?
)

data class YearData(
    val fiscalYear: String,
    val dates: List<DateEntry>,
    val totals: Totals
)

data class Totals(
    val billAmount: Double,
    val expense: Double,
    val tpl: Double,
    val ntpl: Double,
    val grossProfit: Double
)

data class MatchedPosition(
    val symbol: String,
    val buyDate: String,
    val sellDate: String,
    val qty: Double,
    val buyAmount: Double,
    val sellAmount: Double,
    val tpl: Double
)

data class Position(
    var qty: Double = 0.0,
    val lots: MutableList<Lot> = mutableListOf()
)

data class Lot(
    val date: String,
    var qty: Double,
    val price: Double
)

// ==================== BUSINESS LOGIC ====================
class ProfitLossViewModel {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun loadData(): Result<Triple<List<YearData>, Map<String, Map<String, EnhancedTradeInfo>>, List<MatchedPosition>>> {
        return withContext(Dispatchers.IO) {
            try {
                // Load ZIP data
                val (billMap, expenseMap, tradebookMap) = loadZipData()

                // Load URL data
                val (urlTradebookMap, urlExpenseMap) = loadURLData()

                // Merge URL trades where ZIP has no trades
                tradebookMap.putAll(urlTradebookMap.filterKeys { !tradebookMap.containsKey(it) })

                // Process all data
                val (enhancedTradebook, matchedPositions) = matchTradesGlobally(tradebookMap)
                val yearDataList = processYearData(billMap, expenseMap, urlExpenseMap, tradebookMap, enhancedTradebook)

                Result.success(Triple(yearDataList, enhancedTradebook, matchedPositions))
            } catch (e: Exception) {
                e.printStackTrace()
                Result.failure(e)
            }
        }
    }

    private fun loadZipData(): Triple<Map<String, Double>, Map<String, Double>, MutableMap<String, MutableMap<String, TradeInfo>>> {
        val billMap = mutableMapOf<String, Double>()
        val expenseMap = mutableMapOf<String, Double>()
        val tradebookMap = mutableMapOf<String, MutableMap<String, TradeInfo>>()

        try {
            val zipFile = ZipFile(Config.ZIP_FILE_PATH)

            // Load bills
            zipFile.entries().asSequence()
                .filter { it.name.startsWith("fybills/") && it.name.contains("bills_") && it.name.endsWith(".json") }
                .forEach { entry ->
                    val content = zipFile.getInputStream(entry).bufferedReader().readText()
                    val billData = json.decodeFromString<BillData>(content)
                    billData.data?.DATA?.forEach { bill ->
                        val date = bill.date ?: bill.trade_date ?: return@forEach
                        val amount = bill.bill_amt ?: bill.turnover ?: 0.0
                        if (amount != 0.0) {
                            billMap[date] = (billMap[date] ?: 0.0) + amount
                        }
                    }
                }

            // Load expenses
            zipFile.entries().asSequence()
                .filter { it.name.startsWith("fyexpense/") && it.name.contains("expense_") && it.name.endsWith(".json") }
                .forEach { entry ->
                    val content = zipFile.getInputStream(entry).bufferedReader().readText()
                    val expenseData = json.decodeFromString<ExpenseData>(content)
                    expenseData.data?.DATA?.forEach { exp ->
                        val totalExpense = exp.sebi_toc + exp.exchange_txn_charge + exp.brokerage +
                                exp.cm_charge + exp.stt + exp.gst + exp.stamp_duty + exp.ipft
                        expenseMap[exp.trade_date] = (expenseMap[exp.trade_date] ?: 0.0) + totalExpense
                    }
                }

            // Load tradebook
            zipFile.entries().asSequence()
                .filter { it.name.startsWith("fytradebooks/") && it.name.contains("tradebooks_") && it.name.endsWith(".json") }
                .forEach { entry ->
                    val content = zipFile.getInputStream(entry).bufferedReader().readText()
                    val tradeData = json.decodeFromString<TradeData>(content)
                    tradeData.data?.DATA?.forEach { trade ->
                        val date = trade.date ?: trade.trade_date ?: return@forEach
                        val dateMap = tradebookMap.getOrPut(date) { mutableMapOf() }
                        val tradeInfo = dateMap.getOrPut(trade.symbol) {
                            TradeInfo(segment = trade.segment, isExpiry = checkExpiry(trade.symbol, date, trade.segment))
                        }

                        when (trade.type.uppercase()) {
                            "BUY" -> {
                                tradeInfo.buy.qty += trade.qty
                                tradeInfo.buy.value += trade.trade_val
                            }
                            "SELL" -> {
                                tradeInfo.sell.qty += trade.qty
                                tradeInfo.sell.value += trade.trade_val
                            }
                        }
                    }
                }

            zipFile.close()
        } catch (e: Exception) {
            println("Error loading ZIP data: ${e.message}")
        }

        return Triple(billMap, expenseMap, tradebookMap)
    }

    private fun loadURLData(): Pair<Map<String, MutableMap<String, TradeInfo>>, Map<String, Double>> {
        val tradebookMap = mutableMapOf<String, MutableMap<String, TradeInfo>>()
        val expenseMap = mutableMapOf<String, Double>()

        try {
            val urlContent = URL(Config.URL_ENDPOINT).readText()
            val urlData = json.decodeFromString<Map<String, URLDateData>>(urlContent)

            urlData.forEach { (dateKey, dateData) ->
                val convertedDate = convertURLDate(dateKey)

                // Calculate expense
                val expense = calculateURLExpense(dateData.tradeBook)
                expenseMap[convertedDate] = expense

                // Process trades
                val dateMap = tradebookMap.getOrPut(convertedDate) { mutableMapOf() }
                dateData.tradeBook.forEach { trade ->
                    val symbol = trade.symbol.substringAfter(":")
                    val segment = when (trade.segment) {
                        11 -> "NSE_FNO"
                        else -> when (trade.exchange) {
                            10 -> "NSE_FNO"
                            12 -> "BSE_FNO"
                            else -> "UNKNOWN"
                        }
                    }

                    val tradeInfo = dateMap.getOrPut(symbol) {
                        TradeInfo(segment = segment, isExpiry = checkExpiry(symbol, convertedDate, segment))
                    }

                    when (trade.side) {
                        1 -> { // BUY
                            tradeInfo.buy.qty += trade.tradedQty
                            tradeInfo.buy.value += trade.tradeValue
                        }
                        -1 -> { // SELL
                            tradeInfo.sell.qty += trade.tradedQty
                            tradeInfo.sell.value += trade.tradeValue
                        }
                    }
                }
            }
        } catch (e: Exception) {
            println("Error loading URL data: ${e.message}")
        }

        return Pair(tradebookMap, expenseMap)
    }

    private fun calculateURLExpense(trades: List<URLTradeEntry>): Double {
        // Group by exchangeOrderNo for brokerage
        val orderGroups = trades.groupBy { it.exchangeOrderNo }
        val brokeragePerOrder = 20.0
        val totalBrokerage = orderGroups.size * brokeragePerOrder

        var totalSTT = 0.0
        var totalExchangeTxn = 0.0
        var totalSEBI = 0.0
        var totalStampDuty = 0.0
        var totalNSEIPFT = 0.0

        trades.forEach { trade ->
            val value = trade.tradeValue

            // STT: 0.1% on SELL
            if (trade.side == -1) {
                totalSTT += value * 0.001
            }

            // Exchange Transaction Charges
            when (trade.exchange) {
                10 -> totalExchangeTxn += value * 0.0003503 // NSE: 0.03503%
                12 -> { // BSE
                    totalExchangeTxn += when {
                        trade.symbol.contains("SENSEX") && !trade.symbol.contains("50") -> value * 0.000325
                        trade.symbol.contains("BANKEX") -> value * 0.000325
                        trade.symbol.contains("SENSEX") && trade.symbol.contains("50") -> value * 0.00005
                        else -> value * 0.00005
                    }
                }
            }

            // SEBI Fee: ₹10/Crore
            totalSEBI += (value / 10000000) * 10

            // Stamp Duty: 0.003% on BUY
            if (trade.side == 1) {
                totalStampDuty += value * 0.00003
            }

            // NSE IPFT: ₹50/Crore (NSE only)
            if (trade.exchange == 10) {
                totalNSEIPFT += (value / 10000000) * 50
            }
        }

        // GST: 18% on (Brokerage + Exchange Txn + SEBI + NSE IPFT)
        val gstBase = totalBrokerage + totalExchangeTxn + totalSEBI + totalNSEIPFT
        val totalGST = gstBase * 0.18

        return totalBrokerage + totalSTT + totalExchangeTxn + totalSEBI + totalStampDuty + totalNSEIPFT + totalGST
    }

    private fun convertURLDate(dateKey: String): String {
        val parts = dateKey.split("_")
        return if (parts.size == 3) {
            "${parts[2]}/${parts[1]}/${parts[0]}"
        } else dateKey
    }

    private fun checkExpiry(symbol: String, date: String, segment: String): Boolean {
        if (segment != "NSE_FNO") return false
        val expiryDate = extractExpiryFromSymbol(symbol) ?: return false
        return expiryDate == date
    }

    private fun extractExpiryFromSymbol(symbol: String): String? {
        val regex = Regex("""(\d{1,2})([A-Za-z]{3})(\d{4})""")
        val match = regex.find(symbol) ?: return null
        val day = match.groupValues[1].padStart(2, '0')
        val monthStr = match.groupValues[2]
        val year = match.groupValues[3]

        val months = mapOf(
            "Jan" to "01", "Feb" to "02", "Mar" to "03", "Apr" to "04",
            "May" to "05", "Jun" to "06", "Jul" to "07", "Aug" to "08",
            "Sep" to "09", "Oct" to "10", "Nov" to "11", "Dec" to "12"
        )

        val month = months[monthStr] ?: return null
        return "$day/$month/$year"
    }

    private fun matchTradesGlobally(tradebookMap: Map<String, Map<String, TradeInfo>>):
            Pair<Map<String, Map<String, EnhancedTradeInfo>>, List<MatchedPosition>> {

        val enhancedTradebook = mutableMapOf<String, MutableMap<String, EnhancedTradeInfo>>()
        val matchedPositions = mutableListOf<MatchedPosition>()
        val positions = mutableMapOf<String, Position>()

        // Sort trades by date
        val sortedTrades = tradebookMap.entries.sortedBy { parseDate(it.key) }

        sortedTrades.forEach { (date, symbols) ->
            val enhancedDateMap = enhancedTradebook.getOrPut(date) { mutableMapOf() }

            symbols.forEach { (symbol, trade) ->
                val enhanced = enhancedDateMap.getOrPut(symbol) {
                    EnhancedTradeInfo(trade = trade)
                }

                val pos = positions.getOrPut(symbol) { Position() }

                val buyQty = trade.buy.qty
                val sellQty = trade.sell.qty
                val buyVal = trade.buy.value
                val sellVal = trade.sell.value

                // BUYexp: expired buy with no sell
                if (trade.isExpiry && buyQty > 0 && sellQty == 0.0) {
                    enhanced.buyExpTPL = -buyVal
                }

                // Intraday matching
                val matchedQty = minOf(buyQty, sellQty)
                if (matchedQty > 0) {
                    val avgBuyPrice = buyVal / buyQty
                    val avgSellPrice = sellVal / sellQty
                    enhanced.intradayTPL = (avgSellPrice - avgBuyPrice) * matchedQty
                }

                // Remaining BUY - add to position
                val remainingBuyQty = buyQty - matchedQty
                if (remainingBuyQty > 0) {
                    val avgBuyPrice = buyVal / buyQty
                    pos.lots.add(Lot(date, remainingBuyQty, avgBuyPrice))
                    pos.qty += remainingBuyQty
                    enhanced.unmatchedBuy = remainingBuyQty
                }

                // Remaining SELL - match with position FIFO
                var remainingSellQty = sellQty - matchedQty
                if (remainingSellQty > 0) {
                    val avgSellPrice = sellVal / sellQty
                    var sellTPL = 0.0

                    while (remainingSellQty > 0 && pos.lots.isNotEmpty()) {
                        val lot = pos.lots.first()
                        val qtyToMatch = minOf(lot.qty, remainingSellQty)

                        val tpl = (avgSellPrice - lot.price) * qtyToMatch
                        sellTPL += tpl

                        matchedPositions.add(
                            MatchedPosition(
                                symbol = symbol,
                                buyDate = lot.date,
                                sellDate = date,
                                qty = qtyToMatch,
                                buyAmount = lot.price * qtyToMatch,
                                sellAmount = avgSellPrice * qtyToMatch,
                                tpl = tpl
                            )
                        )

                        lot.qty -= qtyToMatch
                        pos.qty -= qtyToMatch
                        remainingSellQty -= qtyToMatch

                        if (lot.qty == 0.0) {
                            pos.lots.removeAt(0)
                        }
                    }

                    enhanced.sellTPL = sellTPL
                    if (remainingSellQty > 0) {
                        enhanced.unmatchedSell = remainingSellQty
                    }
                }
            }
        }

        return Pair(enhancedTradebook, matchedPositions)
    }

    private fun processYearData(
        billMap: Map<String, Double>,
        expenseMap: Map<String, Double>,
        urlExpenseMap: Map<String, Double>,
        tradebookMap: Map<String, Map<String, TradeInfo>>,
        enhancedTradebook: Map<String, Map<String, EnhancedTradeInfo>>
    ): List<YearData> {

        val allData = mutableMapOf<String, MutableList<DateEntry>>()
        val processedDates = mutableSetOf<String>()

        // Process bills with expenses
        billMap.forEach { (dateStr, billAmount) ->
            val date = parseDate(dateStr)
            val fiscalYear = getFiscalYear(date)

            val expense = expenseMap[dateStr] ?: 0.0
            val trades = tradebookMap[dateStr]

            // Calculate TPL
            var tpl = 0.0
            if (trades != null && enhancedTradebook[dateStr] != null) {
                enhancedTradebook[dateStr]!!.values.forEach { enhanced ->
                    tpl += enhanced.intradayTPL + enhanced.sellTPL + enhanced.buyExpTPL
                }
            }

            val ntpl = tpl - expense
            val grossProfit = billAmount + expense

            allData.getOrPut(fiscalYear) { mutableListOf() }.add(
                DateEntry(
                    date = date,
                    originalDate = dateStr,
                    billAmount = billAmount,
                    expense = expense,
                    grossProfit = grossProfit,
                    tpl = tpl,
                    ntpl = ntpl,
                    trades = trades
                )
            )
            processedDates.add(dateStr)
        }

        // Process trade-only dates (no bill)
        tradebookMap.forEach { (dateStr, trades) ->
            if (dateStr !in processedDates) {
                val date = parseDate(dateStr)
                val fiscalYear = getFiscalYear(date)

                // Use URL expense if available
                val expense = urlExpenseMap[dateStr] ?: 0.0

                var tpl = 0.0
                if (enhancedTradebook[dateStr] != null) {
                    enhancedTradebook[dateStr]!!.values.forEach { enhanced ->
                        tpl += enhanced.intradayTPL + enhanced.sellTPL + enhanced.buyExpTPL
                    }
                }

                val ntpl = tpl - expense

                allData.getOrPut(fiscalYear) { mutableListOf() }.add(
                    DateEntry(
                        date = date,
                        originalDate = dateStr,
                        billAmount = 0.0,
                        expense = expense,
                        grossProfit = 0.0, // Keep 0 for display as NA
                        tpl = tpl,
                        ntpl = ntpl,
                        trades = trades
                    )
                )
            }
        }

        // Convert to YearData
        return allData.entries.sortedByDescending { it.key }.map { (fiscalYear, dates) ->
            val sortedDates = dates.sortedByDescending { it.date }

            val totals = Totals(
                billAmount = sortedDates.sumOf { it.billAmount },
                expense = sortedDates.sumOf { it.expense },
                tpl = sortedDates.sumOf { it.tpl },
                ntpl = sortedDates.sumOf { it.ntpl },
                grossProfit = sortedDates.sumOf { it.grossProfit }
            )

            YearData(fiscalYear, sortedDates, totals)
        }
    }

    private fun parseDate(dateStr: String): Date {
        val parts = dateStr.split("/", "-")
        return if (parts[0].length == 4) {
            SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(dateStr.replace("/", "-"))!!
        } else {
            SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).parse("${parts[0]}/${parts[1]}/${parts[2]}")!!
        }
    }

    private fun getFiscalYear(date: Date): String {
        val cal = Calendar.getInstance().apply { time = date }
        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH) + 1

        return if (month >= 4) {
            "$year-${year + 1}"
        } else {
            "${year - 1}-$year"
        }
    }
}

// ==================== UI COMPONENTS ====================
@Composable
fun ProfitLossApp() {
    var yearDataList by remember { mutableStateOf<List<YearData>>(emptyList()) }
    var enhancedTradebook by remember { mutableStateOf<Map<String, Map<String, EnhancedTradeInfo>>>(emptyMap()) }
    var matchedPositions by remember { mutableStateOf<List<MatchedPosition>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var useFullFormat by remember { mutableStateOf(false) }

    val viewModel = remember { ProfitLossViewModel() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            val result = viewModel.loadData()
            isLoading = false
            result.onSuccess { (years, enhanced, positions) ->
                yearDataList = years
                enhancedTradebook = enhanced
                matchedPositions = positions
            }.onFailure { error ->
                errorMessage = error.message
            }
        }
    }

    MaterialTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color(0xFFF5F5F5)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(Color(0xFF667EEA), Color(0xFF764BA2))
                            )
                        )
                        .padding(24.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "📊 Profit & Loss Statement",
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Fiscal Year Analysis",
                            fontSize = 16.sp,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }

                    // Currency format toggle
                    Row(
                        modifier = Modifier.align(Alignment.TopEnd),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Short", color = Color.White, fontSize = 12.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Switch(
                            checked = useFullFormat,
                            onCheckedChange = { useFullFormat = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.White,
                                checkedTrackColor = Color(0xFF4CAF50)
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Full", color = Color.White, fontSize = 12.sp)
                    }
                }

                // Content
                when {
                    isLoading -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                    errorMessage != null -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                text = "Error: $errorMessage",
                                color = Color.Red,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }
                    yearDataList.isEmpty() -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("No data available", fontSize = 16.sp, color = Color.Gray)
                        }
                    }
                    else -> {
                        ProfitLossContent(
                            yearDataList = yearDataList,
                            enhancedTradebook = enhancedTradebook,
                            matchedPositions = matchedPositions,
                            useFullFormat = useFullFormat
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ProfitLossContent(
    yearDataList: List<YearData>,
    enhancedTradebook: Map<String, Map<String, EnhancedTradeInfo>>,
    matchedPositions: List<MatchedPosition>,
    useFullFormat: Boolean
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Global Summary
        item {
            GlobalSummaryCard(yearDataList, useFullFormat)
        }

        // Year Items
        items(yearDataList) { yearData ->
            YearCard(yearData, enhancedTradebook, useFullFormat)
        }

        // Matched Positions
        item {
            MatchedPositionsCard(matchedPositions, useFullFormat)
        }
    }
}

@Composable
fun GlobalSummaryCard(yearDataList: List<YearData>, useFullFormat: Boolean) {
    val globalTotals = yearDataList.fold(
        Totals(0.0, 0.0, 0.0, 0.0, 0.0)
    ) { acc, year ->
        Totals(
            billAmount = acc.billAmount + year.totals.billAmount,
            expense = acc.expense + year.totals.expense,
            tpl = acc.tpl + year.totals.tpl,
            ntpl = acc.ntpl + year.totals.ntpl,
            grossProfit = acc.grossProfit + year.totals.grossProfit
        )
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(Color(0xFF4A5FD3), Color(0xFF5E3780))
                    )
                )
                .padding(20.dp)
        ) {
            Text(
                text = "📊 SUMMARY",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                SummaryItem("Total Bills", globalTotals.billAmount, useFullFormat, globalTotals.billAmount >= 0)
                SummaryItem("Total Expenses", globalTotals.expense, useFullFormat, false)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                SummaryItem("TPL", globalTotals.tpl, useFullFormat, globalTotals.tpl >= 0)
                SummaryItem("NTPL", globalTotals.ntpl, useFullFormat, globalTotals.ntpl >= 0)
            }
            Spacer(modifier = Modifier.height(8.dp))
            SummaryItem("Gross Profit", globalTotals.grossProfit, useFullFormat, globalTotals.grossProfit >= 0)
        }
    }
}

@Composable
fun RowScope.SummaryItem(label: String, value: Double, useFullFormat: Boolean, isPositive: Boolean) {
    Column(horizontalAlignment = Alignment.End) {
        Text(
            text = label,
            fontSize = 12.sp,
            color = Color.White.copy(alpha = 0.8f),
            fontWeight = if (label == "NTPL") FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = formatCurrency(value, useFullFormat),
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = if (isPositive) Color(0xFF4CAF50) else Color(0xFFF44336)
        )
    }
}

@Composable
fun YearCard(
    yearData: YearData,
    enhancedTradebook: Map<String, Map<String, EnhancedTradeInfo>>,
    useFullFormat: Boolean
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column {
            // Year Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(Color(0xFF667EEA), Color(0xFF764BA2))
                        )
                    )
                    .clickable { expanded = !expanded }
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "FY ${yearData.fiscalYear}",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Bills", fontSize = 10.sp, color = Color.White.copy(alpha = 0.8f))
                            Text(
                                formatCurrency(yearData.totals.billAmount, useFullFormat),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("NTPL", fontSize = 10.sp, color = Color.White.copy(alpha = 0.8f), fontWeight = FontWeight.Bold)
                            Text(
                                formatCurrency(yearData.totals.ntpl, useFullFormat),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.KeyboardArrowDown,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.rotate(if (expanded) 180f else 0f)
                        )
                    }
                }
            }

            // Dates Table
            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(8.dp)) {
                    // Header Row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF667EEA))
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        TableHeader("Date", 0.15f)
                        TableHeader("Bill", 0.15f)
                        TableHeader("Expense", 0.15f)
                        TableHeader("TPL", 0.15f)
                        TableHeader("NTPL", 0.15f)
                        TableHeader("Gross P.", 0.15f)
                    }

                    // Date Rows
                    yearData.dates.forEach { dateEntry ->
                        DateRow(dateEntry, enhancedTradebook, useFullFormat)
                    }
                }
            }
        }
    }
}

@Composable
fun RowScope.TableHeader(text: String, weight: Float) {
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = Color.White,
        modifier = Modifier.weight(weight),
        textAlign = TextAlign.End
    )
}

@Composable
fun DateRow(
    dateEntry: DateEntry,
    enhancedTradebook: Map<String, Map<String, EnhancedTradeInfo>>,
    useFullFormat: Boolean
) {
    var expanded by remember { mutableStateOf(false) }
    val hasTrades = dateEntry.trades != null && dateEntry.trades.isNotEmpty()

    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(enabled = hasTrades) { if (hasTrades) expanded = !expanded }
                .padding(vertical = 12.dp, horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(dateEntry.date),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF667EEA),
                modifier = Modifier.weight(0.15f)
            )
            AmountText(dateEntry.billAmount, useFullFormat, dateEntry.billAmount >= 0, 0.15f)
            AmountText(dateEntry.expense, useFullFormat, false, 0.15f)
            AmountText(dateEntry.tpl, useFullFormat, dateEntry.tpl >= 0, 0.15f)
            AmountText(dateEntry.ntpl, useFullFormat, dateEntry.ntpl >= 0, 0.15f)
            Text(
                text = if (dateEntry.billAmount == 0.0) "NA" else formatCurrency(dateEntry.grossProfit, useFullFormat),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (dateEntry.grossProfit >= 0) Color(0xFF4CAF50) else Color(0xFFF44336),
                modifier = Modifier.weight(0.15f),
                textAlign = TextAlign.End
            )
        }

        // Trades Details
        if (hasTrades) {
            AnimatedVisibility(visible = expanded) {
                TradesSection(dateEntry, enhancedTradebook[dateEntry.originalDate], useFullFormat)
            }
        }

        Divider(color = Color.LightGray.copy(alpha = 0.3f))
    }
}

@Composable
fun RowScope.AmountText(amount: Double, useFullFormat: Boolean, isPositive: Boolean, weight: Float) {
    Text(
        text = formatCurrency(amount, useFullFormat),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = if (isPositive) Color(0xFF4CAF50) else Color(0xFFF44336),
        modifier = Modifier.weight(weight),
        textAlign = TextAlign.End
    )
}

@Composable
fun TradesSection(
    dateEntry: DateEntry,
    enhanced: Map<String, EnhancedTradeInfo>?,
    useFullFormat: Boolean
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF0F3FF))
            .padding(12.dp)
    ) {
        Text(
            text = "📈 Trades on this date:",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF667EEA)
        )
        Spacer(modifier = Modifier.height(8.dp))

        dateEntry.trades?.forEach { (symbol, trade) ->
            val enhancedInfo = enhanced?.get(symbol)
            TradeItem(symbol, trade, enhancedInfo, useFullFormat)
            Spacer(modifier = Modifier.height(6.dp))
        }
    }
}

@Composable
fun TradeItem(
    symbol: String,
    trade: TradeInfo,
    enhanced: EnhancedTradeInfo?,
    useFullFormat: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(6.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = symbol,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF333333)
            )
            Spacer(modifier = Modifier.height(6.dp))

            val buyQty = trade.buy.qty
            val sellQty = trade.sell.qty
            val buyVal = trade.buy.value
            val sellVal = trade.sell.value

            // BUYexp
            if (trade.isExpiry && buyQty > 0 && sellQty == 0.0) {
                TradeTypeRow("BUYexp", buyVal, enhanced?.buyExpTPL ?: 0.0, useFullFormat, Color(0xFFC2185B))
            }
            // SELLexp
            else if (trade.isExpiry && sellQty > 0 && buyQty == 0.0) {
                TradeTypeRow("SELLexp", sellVal, enhanced?.sellTPL ?: 0.0, useFullFormat, Color(0xFFC2185B))
            }
            // Both BUY and SELL
            else if (buyQty > 0 && sellQty > 0) {
                val matchedQty = minOf(buyQty, sellQty)
                if (matchedQty > 0) {
                    val matchedVal = maxOf((buyVal / buyQty) * matchedQty, (sellVal / sellQty) * matchedQty)
                    TradeTypeRow("Intraday", matchedVal, enhanced?.intradayTPL ?: 0.0, useFullFormat, Color(0xFF1976D2))
                }
                val remainingBuy = buyQty - matchedQty
                if (remainingBuy > 0) {
                    TradeTypeRow("BUY", (buyVal / buyQty) * remainingBuy, null, useFullFormat, Color(0xFF4CAF50))
                }
                val remainingSell = sellQty - matchedQty
                if (remainingSell > 0) {
                    TradeTypeRow("SELL", (sellVal / sellQty) * remainingSell, enhanced?.sellTPL ?: 0.0, useFullFormat, Color(0xFFF44336))
                }
            }
            // Only BUY
            else if (buyQty > 0) {
                TradeTypeRow("BUY", buyVal, null, useFullFormat, Color(0xFF4CAF50))
            }
            // Only SELL
            else if (sellQty > 0) {
                TradeTypeRow("SELL", sellVal, enhanced?.sellTPL ?: 0.0, useFullFormat, Color(0xFFF44336))
            }
        }
    }
}

@Composable
fun TradeTypeRow(type: String, value: Double, tpl: Double?, useFullFormat: Boolean, typeColor: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = type,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = typeColor
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(horizontalAlignment = Alignment.End) {
                Text("Value", fontSize = 8.sp, color = Color.Gray)
                Text(formatCurrency(value, useFullFormat), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            }
            if (tpl != null) {
                Column(horizontalAlignment = Alignment.End) {
                    Text("TPL", fontSize = 8.sp, color = Color.Gray)
                    Text(
                        formatCurrency(tpl, useFullFormat),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (tpl >= 0) Color(0xFF4CAF50) else Color(0xFFF44336)
                    )
                }
            }
        }
    }
}

@Composable
fun MatchedPositionsCard(positions: List<MatchedPosition>, useFullFormat: Boolean) {
    var expanded by remember { mutableStateOf(false) }

    if (positions.isEmpty()) return

    val totalTPL = positions.sumOf { it.tpl }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(Color(0xFFF57C00), Color(0xFFFF6F00))
                        )
                    )
                    .clickable { expanded = !expanded }
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "📊 MATCHED POSITIONS (${positions.size})",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Total TPL", fontSize = 10.sp, color = Color.White.copy(alpha = 0.8f))
                            Text(
                                formatCurrency(totalTPL, useFullFormat),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.KeyboardArrowDown,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.rotate(if (expanded) 180f else 0f)
                        )
                    }
                }
            }

            AnimatedVisibility(visible = expanded) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 400.dp)
                        .padding(8.dp)
                ) {
                    items(positions) { position ->
                        PositionRow(position, useFullFormat)
                        Divider(color = Color.LightGray.copy(alpha = 0.3f))
                    }
                }
            }
        }
    }
}

@Composable
fun PositionRow(position: MatchedPosition, useFullFormat: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp, horizontal = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(0.3f)) {
            Text(position.symbol, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF667EEA))
            Text("Qty: ${position.qty.toInt()}", fontSize = 9.sp, color = Color.Gray)
        }
        Column(modifier = Modifier.weight(0.25f), horizontalAlignment = Alignment.End) {
            Text("Buy", fontSize = 8.sp, color = Color.Gray)
            Text(position.buyDate, fontSize = 9.sp)
        }
        Column(modifier = Modifier.weight(0.25f), horizontalAlignment = Alignment.End) {
            Text("Sell", fontSize = 8.sp, color = Color.Gray)
            Text(position.sellDate, fontSize = 9.sp)
        }
        Column(modifier = Modifier.weight(0.2f), horizontalAlignment = Alignment.End) {
            Text("TPL", fontSize = 8.sp, color = Color.Gray)
            Text(
                formatCurrency(position.tpl, useFullFormat),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = if (position.tpl >= 0) Color(0xFF4CAF50) else Color(0xFFF44336)
            )
        }
    }
}

// ==================== UTILITIES ====================
fun formatCurrency(amount: Double, useFullFormat: Boolean): String {
    val absAmount = abs(amount)
    val sign = if (amount < 0) "-" else ""

    return if (useFullFormat) {
        sign + "₹" + String.format("%,.0f", absAmount)
    } else {
        when {
            absAmount >= 10000000 -> sign + String.format("%.2f Cr", absAmount / 10000000)
            absAmount >= 100000 -> sign + String.format("%.2f L", absAmount / 100000)
            absAmount >= 1000 -> sign + String.format("%.1fk", absAmount / 1000)
            else -> sign + String.format("%.0f", absAmount)
        }
    }
}

// ==================== MAIN ACTIVITY ====================
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ProfitLossApp()
        }
    }
}
