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

    override fun onDestroy() {
        unregisterReceiverSafe()
        super.onDestroy()
    }
}
