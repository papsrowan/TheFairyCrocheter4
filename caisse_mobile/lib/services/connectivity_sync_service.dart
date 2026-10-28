import 'dart:async';
import 'package:flutter/foundation.dart';
import 'api_service.dart';
import 'storage_service.dart';

class ConnectivitySyncService extends ChangeNotifier {
  final ApiService apiService;
  final StorageService storageService;

  Timer? _timer;
  bool _isOnline = true;
  bool _isSyncing = false;
  DateTime? _lastSyncTime;

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;
  DateTime? get lastSyncTime => _lastSyncTime;
  int get pendingSalesCount => storageService.getOfflineQueue().length;
  bool get hasPendingSales => pendingSalesCount > 0;

  ConnectivitySyncService({
    required this.apiService,
    required this.storageService,
    bool autoStart = true,
  }) {
    if (autoStart) {
      // Vérifier l'état initial
      checkConnection();
      // Surveiller toutes les 15 secondes
      _startMonitoring();
    }
  }

  void _startMonitoring() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) {
      _pollStatus();
    });
  }

  Future<void> checkConnection() async {
    final healthy = await apiService.checkHealth();
    if (_isOnline != healthy) {
      _isOnline = healthy;
      notifyListeners();
    }
  }

  Future<void> _pollStatus() async {
    final healthy = await apiService.checkHealth();
    
    if (_isOnline != healthy) {
      _isOnline = healthy;
      notifyListeners();
    }

    // Si on vient de repasser en ligne ou qu'on est en ligne avec des ventes en attente : auto-sync
    if (_isOnline && hasPendingSales && !_isSyncing) {
      await syncNow();
    }
  }

  /// Déclenche la synchronisation des ventes hors-ligne
  Future<bool> syncNow({VoidCallback? onSyncSuccess}) async {
    if (_isSyncing) return false;
    final queue = storageService.getOfflineQueue();
    if (queue.isEmpty) {
      notifyListeners();
      return true;
    }

    _isSyncing = true;
    notifyListeners();

    try {
      final success = await apiService.syncOfflineSales(queue);
      if (success) {
        await storageService.clearOfflineQueue();
        _lastSyncTime = DateTime.now();
        _isOnline = true;
        _isSyncing = false;
        notifyListeners();
        if (onSyncSuccess != null) {
          onSyncSuccess();
        }
        return true;
      } else {
        _isSyncing = false;
        notifyListeners();
        return false;
      }
    } catch (_) {
      _isSyncing = false;
      notifyListeners();
      return false;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
