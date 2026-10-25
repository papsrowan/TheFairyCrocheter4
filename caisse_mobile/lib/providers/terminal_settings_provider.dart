import 'package:flutter/foundation.dart';
import '../services/storage_service.dart';
import '../services/scanner_service.dart';
import '../services/api_service.dart';

class TerminalSettingsProvider extends ChangeNotifier {
  final StorageService storageService;
  final ScannerService scannerService;

  late String _baseUrl;
  late bool _autoPrint;
  late bool _autoOpenDrawer;
  late String _cashDrawerPin;
  late bool _requireDrawerPin;
  late String _printerMode;
  late String _scannerMode;
  late String _customIntentAction;
  int _offlineQueueCount = 0;
  bool _isSyncing = false;

  String get baseUrl => _baseUrl;
  bool get autoPrint => _autoPrint;
  bool get autoOpenDrawer => _autoOpenDrawer;
  String get cashDrawerPin => _cashDrawerPin;
  bool get requireDrawerPin => _requireDrawerPin;
  String get printerMode => _printerMode;
  String get scannerMode => _scannerMode;
  String get customIntentAction => _customIntentAction;
  int get offlineQueueCount => _offlineQueueCount;
  bool get isSyncing => _isSyncing;

  TerminalSettingsProvider({
    required this.storageService,
    required this.scannerService,
  }) {
    _loadSettings();
  }

  void _loadSettings() {
    _baseUrl = storageService.getBaseUrl();
    _autoPrint = storageService.getAutoPrint();
    _autoOpenDrawer = storageService.getAutoOpenDrawer();
    _cashDrawerPin = storageService.getCashDrawerPin();
    _requireDrawerPin = storageService.getRequireDrawerPin();
    _printerMode = storageService.getPrinterMode();
    _scannerMode = storageService.getScannerMode();
    _customIntentAction = storageService.getCustomIntentAction();
    _updateOfflineCount();
    notifyListeners();
  }

  void _updateOfflineCount() {
    _offlineQueueCount = storageService.getOfflineQueue().length;
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.trim();
    await storageService.setBaseUrl(_baseUrl);
    notifyListeners();
  }

  Future<void> setAutoPrint(bool val) async {
    _autoPrint = val;
    await storageService.setAutoPrint(val);
    notifyListeners();
  }

  Future<void> setAutoOpenDrawer(bool val) async {
    _autoOpenDrawer = val;
    await storageService.setAutoOpenDrawer(val);
    notifyListeners();
  }

  Future<void> setCashDrawerPin(String pin) async {
    _cashDrawerPin = pin.trim();
    await storageService.setCashDrawerPin(_cashDrawerPin);
    notifyListeners();
  }

  Future<void> setRequireDrawerPin(bool val) async {
    _requireDrawerPin = val;
    await storageService.setRequireDrawerPin(val);
    notifyListeners();
  }

  Future<void> setPrinterMode(String mode) async {
    _printerMode = mode;
    await storageService.setPrinterMode(mode);
    notifyListeners();
  }

  Future<void> setScannerMode(String mode) async {
    _scannerMode = mode;
    await storageService.setScannerMode(mode);
    notifyListeners();
  }

  Future<void> setCustomIntentAction(String action) async {
    _customIntentAction = action.trim();
    await storageService.setCustomIntentAction(_customIntentAction);
    if (_customIntentAction.isNotEmpty) {
      await scannerService.registerCustomAction(_customIntentAction);
    }
    notifyListeners();
  }

  Future<bool> syncOfflineQueue(ApiService apiService) async {
    final queue = storageService.getOfflineQueue();
    if (queue.isEmpty) return true;

    _isSyncing = true;
    notifyListeners();

    final ok = await apiService.syncOfflineSales(queue);
    if (ok) {
      await storageService.clearOfflineQueue();
      _updateOfflineCount();
    }
    _isSyncing = false;
    notifyListeners();
    return ok;
  }
}
