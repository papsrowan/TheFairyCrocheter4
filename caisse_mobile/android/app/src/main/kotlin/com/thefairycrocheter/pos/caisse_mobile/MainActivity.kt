package com.thefairycrocheter.pos.caisse_mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val SCANNER_EVENT_CHANNEL = "com.thefairycrocheter.pos/scanner_events"
    private val SCANNER_METHOD_CHANNEL = "com.thefairycrocheter.pos/scanner_config"

    private var eventSink: EventChannel.EventSink? = null
    private var scannerReceiver: BroadcastReceiver? = null
    private val registeredActions = mutableSetOf(
        "nlscan.action.SCANNER_RESULT",
        "android.intent.ACTION_DECODE_DATA",
        "action.barcode.reader.value",
        "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED",
        "urovo.rcv.MESSAGE",
        "com.android.server.scannerservice.broadcast",
        "scan.rcv.message",
        "com.barcode.sendBroadcast",
        "device.scanner.EVENT"
    )

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // Configuration Channel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SCANNER_METHOD_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "registerCustomAction" -> {
                    val action = call.argument<String>("action")
                    if (!action.isNullOrBlank()) {
                        registeredActions.add(action)
                        reRegisterReceiver()
                        result.success(true)
                    } else {
                        result.error("INVALID_ACTION", "Action cannot be empty", null)
                    }
                }
                "getRegisteredActions" -> {
                    result.success(registeredActions.toList())
                }
                "openCashDrawer" -> {
                    val opened = openPhysicalCashDrawer()
                    result.success(opened)
                }
                "printRawEscPos" -> {
                    val bytes = call.argument<ByteArray>("bytes")
                    if (bytes != null && bytes.isNotEmpty()) {
                        val printed = printDirectHardware(bytes)
                        result.success(printed)
                    } else {
                        result.error("EMPTY_DATA", "Bytes cannot be null or empty", null)
                    }
                }
                else -> result.notImplemented()
            }
        }

        // Event Channel pour les flux de scan
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, SCANNER_EVENT_CHANNEL).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    registerReceiver()
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                    unregisterReceiverSafe()
                }
            }
        )
    }

    private fun registerReceiver() {
        if (scannerReceiver != null) return

        scannerReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent == null) return
                val barcode = extractBarcode(intent)
                if (!barcode.isNullOrBlank()) {
                    runOnUiThread {
                        eventSink?.success(barcode.trim())
                    }
                }
            }
        }

        val filter = IntentFilter()
        for (action in registeredActions) {
            filter.addAction(action)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(scannerReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(scannerReceiver, filter)
        }
    }

    private fun reRegisterReceiver() {
        unregisterReceiverSafe()
        if (eventSink != null) {
            registerReceiver()
        }
    }

    private fun unregisterReceiverSafe() {
        scannerReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {}
            scannerReceiver = null
        }
    }

    private fun extractBarcode(intent: Intent): String? {
        val bundle = intent.extras ?: return null

        // Liste des clés d'extras les plus couramment utilisées par les constructeurs POS
        val candidateKeys = listOf(
            "scan_result",
            "data",
            "scannerdata",
            "barcode_string",
            "barcode",
            "extra_barcode_string",
            "value",
            "barcode_data",
            "barocode",
            "bData",
            "msg"
        )

        for (key in candidateKeys) {
            val value = bundle.get(key)
            if (value is String && value.isNotBlank()) {
                return value
            } else if (value is ByteArray && value.isNotEmpty()) {
                return String(value)
            }
        }

        // Tentative de recherche sur n'importe quel String dans le bundle
        for (key in bundle.keySet()) {
            val v = bundle.get(key)
            if (v is String && v.isNotBlank() && v.length in 3..64) {
                return v
            }
        }

        return null
    }

    private fun openPhysicalCashDrawer(): Boolean {
        var success = false

        // 1. Broadcasts Android standards & constructeurs POS (ZCS, Sunmi, Urovo, iMin, etc.)
        val drawerActions = listOf(
            "com.zcs.action.OPEN_DRAWER",
            "com.zcs.action.CASH_BOX",
            "action.open.cashbox",
            "com.pos.drawer.open",
            "com.pos.action.CASHBOX_OPEN",
            "android.intent.action.CASH_DRAWER",
            "com.sunmi.action.CASH_DRAWER_OPEN",
            "com.imin.action.OPEN_DRAWER",
            "com.urovo.cashdrawer.OPEN",
            "device.action.OPEN_DRAWER",
            "com.android.cashdrawer.open",
            "android.intent.action.OPEN_DRAWER"
        )
        for (action in drawerActions) {
            try {
                sendBroadcast(Intent(action))
                success = true
            } catch (_: Exception) {}
        }

        // 2. Écriture directe des octets ESC/POS (Pin 2, Pin 5 et Real-time) sur les nœuds périphériques & ports séries
        val candidateDevices = listOf(
            "/dev/cash_drawer",
            "/dev/cashbox",
            "/dev/drawer",
            "/dev/ttyMT0",
            "/dev/ttyMT1",
            "/dev/ttyMT2",
            "/dev/ttyS0",
            "/dev/ttyS1",
            "/dev/ttyUSB0",
            "/dev/printer",
            "/dev/usb/lp0"
        )
        // Combinaison des impulsions standards RJ12 : Pin 2 (0x00), Pin 5 (0x01) et Real-time kick (0x10, 0x14)
        val kickBytes = byteArrayOf(
            0x1B, 0x70, 0x00, 0x19, 0xFA.toByte(), // ESC p 0 25 250
            0x1B, 0x70, 0x01, 0x19, 0xFA.toByte(), // ESC p 1 25 250
            0x10, 0x14, 0x01, 0x00, 0x05            // DLE DC4 1 0 5
        )
        for (devPath in candidateDevices) {
            try {
                val file = java.io.File(devPath)
                if (file.exists() && file.canWrite()) {
                    val fos = java.io.FileOutputStream(file)
                    fos.write(kickBytes)
                    fos.flush()
                    fos.close()
                    success = true
                }
            } catch (_: Exception) {}
        }

        return success
    }

    private fun printDirectHardware(bytes: ByteArray): Boolean {
        var success = false

        // 1. Broadcasts d'impression standards POS (ZCS, Sunmi, Urovo, etc.)
        val printIntents = listOf(
            "com.pos.action.PRINT",
            "net.nyx.printerservice.PRINT_RAW_DATA",
            "com.sunmi.action.PRINT_DATA",
            "android.intent.action.PRINT_DATA",
            "com.zcs.action.PRINT"
        )
        for (action in printIntents) {
            try {
                val intent = Intent(action)
                intent.putExtra("data", bytes)
                intent.putExtra("bytes", bytes)
                sendBroadcast(intent)
                success = true
            } catch (_: Exception) {}
        }

        // 2. Écriture directe sur les ports séries et périphériques d'impression thermique interne
        val candidatePorts = listOf(
            "/dev/ttyMT1",
            "/dev/ttyMT0",
            "/dev/ttyMT2",
            "/dev/ttyS1",
            "/dev/ttyS0",
            "/dev/ttyS2",
            "/dev/ttyUSB0",
            "/dev/printer",
            "/dev/usb/lp0"
        )
        for (portPath in candidatePorts) {
            try {
                val file = java.io.File(portPath)
                if (file.exists() && file.canWrite()) {
                    val fos = java.io.FileOutputStream(file)
                    fos.write(bytes)
                    fos.flush()
                    fos.close()
                    success = true
                }
            } catch (_: Exception) {}
        }

        return success
    }

    override fun onDestroy() {
        unregisterReceiverSafe()
        super.onDestroy()
    }
}
