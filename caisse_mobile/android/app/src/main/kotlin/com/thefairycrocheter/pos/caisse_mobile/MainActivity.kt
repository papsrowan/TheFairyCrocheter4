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
                    val codeArg = call.argument<String>("code") ?: ""
                    val code = if (codeArg.isNotBlank()) codeArg else "799270"
                    val opened = openPhysicalCashDrawer(code)
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

    private fun populatePasswordExtras(intent: Intent, code: String) {
        if (code.isBlank()) return
        intent.putExtra("password", code)
        intent.putExtra("pwd", code)
        intent.putExtra("pin", code)
        intent.putExtra("code", code)
        intent.putExtra("key", code)
        intent.putExtra("pass", code)
        intent.putExtra("psw", code)
        intent.putExtra("cashbox_password", code)
        intent.putExtra("cashbox_code", code)
        intent.putExtra("cashBoxPassword", code)
        intent.putExtra("cashboxPassword", code)
        intent.putExtra("drawer_password", code)
        intent.putExtra("drawerPassword", code)
        intent.putExtra("input_password", code)
        intent.putExtra("inputPassword", code)
    }

    private fun openPhysicalCashDrawer(code: String): Boolean {
        var success = false
        val finalCode = if (code.isNotBlank()) code else "799270"
        android.util.Log.i("POS_DRAWER", "Attempting to open cash drawer with code: $finalCode")

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
            "android.intent.action.OPEN_DRAWER",
            "com.zcs.action.OPEN_CASH_DRAWER",
            "com.zcs.action.OPEN_CASHBOX",
            "com.zcs.action.DRAWER_KICK",
            "com.zcs.action.DRAWER_OPEN",
            "com.zcs.action.DRAWER",
            "com.zcs.action.CASHBOX",
            "action.open.drawer",
            "com.zcs.zcshardwaremanager.action.OPEN_CASHBOX",
            "com.zcs.zcshardwaremanager.CASHBOX",
            "com.zcs.zsf.action.OPEN_DRAWER",
            "com.zcs.customized.action.OPEN_DRAWER"
        )

        // 1. Broadcasts globaux avec toutes les clés de mot de passe
        for (action in drawerActions) {
            try {
                val intent = Intent(action)
                populatePasswordExtras(intent, finalCode)
                sendBroadcast(intent)
                success = true
            } catch (e: Exception) {
                android.util.Log.w("POS_DRAWER", "Broadcast $action failed: ${e.message}")
            }
        }

        // 2. Recherche et ciblage explicite des packages ZCS / Hardware Manager installés
        try {
            val pm = packageManager
            val packages = pm.getInstalledPackages(0)
            for (pkg in packages) {
                val pName = pkg.packageName.lowercase()
                if (pName.contains("hardware") || pName.contains("cashbox") || pName.contains("drawer") || pName.contains("pos") || pName.contains("zcs")) {
                    android.util.Log.i("POS_DRAWER", "Found POS/Hardware package: ${pkg.packageName}")
                    for (action in drawerActions) {
                        try {
                            val targetedIntent = Intent(action)
                            targetedIntent.setPackage(pkg.packageName)
                            populatePasswordExtras(targetedIntent, finalCode)
                            sendBroadcast(targetedIntent)

                            // Tenter également en tant que service d'arrière-plan
                            try {
                                startService(targetedIntent)
                            } catch (_: Exception) {}
                        } catch (_: Exception) {}
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("POS_DRAWER", "Package search failed: ${e.message}")
        }

        // 3. Déclenchement de l'impulsion ESC/POS RJ12 via le circuit de l'imprimante thermique interne
        val kickBytes = byteArrayOf(
            0x1B, 0x70, 0x00, 0x19, 0xFA.toByte(), // ESC p 0 25 250 (Pin 2 kick)
            0x1B, 0x70, 0x01, 0x19, 0xFA.toByte(), // ESC p 1 25 250 (Pin 5 kick)
            0x10, 0x14, 0x01, 0x00, 0x05            // DLE DC4 1 0 5 (Real-time pulse)
        )
        try {
            printDirectHardware(kickBytes)
        } catch (_: Exception) {}

        // 4. Tentative d'écriture directe (si les permissions SELinux le permettent)
        val candidateDevices = listOf(
            "/dev/cash_drawer",
            "/dev/cashbox",
            "/dev/drawer",
            "/dev/printer",
            "/dev/usb/lp0"
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

        // 1. Broadcasts d'impression standards POS (envoyés en arrière-plan)
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
            } catch (_: Exception) {}
        }

        val zcsPrintPackages = listOf("com.zcs.customized", "com.zcs.zcshardwaremanager", "com.zcs.zsf")
        for (pkg in zcsPrintPackages) {
            try {
                val targeted = Intent("com.zcs.action.PRINT")
                targeted.setPackage(pkg)
                targeted.putExtra("data", bytes)
                targeted.putExtra("bytes", bytes)
                sendBroadcast(targeted)
            } catch (_: Exception) {}
        }

        // 2. Écriture directe sur périphériques d'impression thermique USB / Printer
        val candidatePorts = listOf(
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
