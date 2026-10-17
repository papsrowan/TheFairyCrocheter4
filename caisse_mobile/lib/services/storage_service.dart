import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/user.dart';

class StorageService {
  static const String keyBaseUrl = 'pos_base_url';
  static const String keyToken = 'pos_jwt_token';
  static const String keyUser = 'pos_user_data';
  static const String keyAutoPrint = 'pos_auto_print';
  static const String keyPrinterMode = 'pos_printer_mode'; // 'android_spooler' | 'esc_pos'
  static const String keyScannerMode = 'pos_scanner_mode'; // 'wedge' | 'broadcast' | 'camera'
  static const String keyCustomIntentAction = 'pos_custom_intent_action';
  static const String keyOfflineQueue = 'pos_offline_sales_queue';
  static const String keyAutoOpenDrawer = 'pos_auto_open_drawer';

  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // URL du serveur
  String getBaseUrl() {
    return _prefs.getString(keyBaseUrl) ?? AppConstants.defaultBaseUrl;
  }

  Future<void> setBaseUrl(String url) async {
    await _prefs.setString(keyBaseUrl, url.trim().replaceAll(RegExp(r'/+$'), ''));
  }

  // Jeton JWT
  String? getToken() {
    return _prefs.getString(keyToken);
  }

  Future<void> setToken(String? token) async {
    if (token == null) {
      await _prefs.remove(keyToken);
    } else {
      await _prefs.setString(keyToken, token);
    }
  }

  // Utilisateur connecté
  User? getUser() {
    final str = _prefs.getString(keyUser);
    if (str == null) return null;
    try {
      return User.fromJson(jsonDecode(str) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> setUser(User? user) async {
    if (user == null) {
      await _prefs.remove(keyUser);
    } else {
      await _prefs.setString(keyUser, jsonEncode(user.toJson()));
    }
  }

  // Options du terminal
  bool getAutoPrint() => _prefs.getBool(keyAutoPrint) ?? true;
  Future<void> setAutoPrint(bool val) => _prefs.setBool(keyAutoPrint, val);

  bool getAutoOpenDrawer() => _prefs.getBool(keyAutoOpenDrawer) ?? true;
  Future<void> setAutoOpenDrawer(bool val) => _prefs.setBool(keyAutoOpenDrawer, val);

  String getPrinterMode() => _prefs.getString(keyPrinterMode) ?? 'android_spooler';
  Future<void> setPrinterMode(String mode) => _prefs.setString(keyPrinterMode, mode);

  String getScannerMode() => _prefs.getString(keyScannerMode) ?? 'wedge';
  Future<void> setScannerMode(String mode) => _prefs.setString(keyScannerMode, mode);

  String getCustomIntentAction() => _prefs.getString(keyCustomIntentAction) ?? '';
  Future<void> setCustomIntentAction(String act) => _prefs.setString(keyCustomIntentAction, act.trim());

  // File d'attente hors-ligne
  List<Map<String, dynamic>> getOfflineQueue() {
    final raw = _prefs.getString(keyOfflineQueue);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> addToOfflineQueue(Map<String, dynamic> salePayload) async {
    final queue = getOfflineQueue();
    queue.add({
      'id': 'off_${DateTime.now().millisecondsSinceEpoch}',
      'type': 'vente',
      'payload': salePayload,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    });
    await _prefs.setString(keyOfflineQueue, jsonEncode(queue));
  }

  Future<void> clearOfflineQueue() async {
    await _prefs.remove(keyOfflineQueue);
  }

  // Déconnexion complète
  Future<void> clearSession() async {
    await _prefs.remove(keyToken);
    await _prefs.remove(keyUser);
  }
}
