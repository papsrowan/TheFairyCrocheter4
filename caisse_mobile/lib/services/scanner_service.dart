import 'dart:async';
import 'package:flutter/services.dart';

class ScannerService {
  static const EventChannel _eventChannel =
      EventChannel('com.thefairycrocheter.pos/scanner_events');
  static const MethodChannel _methodChannel =
      MethodChannel('com.thefairycrocheter.pos/scanner_config');

  final StreamController<String> _scanStreamController =
      StreamController<String>.broadcast();

  StreamSubscription? _eventSubscription;

  Stream<String> get onBarcodeScanned => _scanStreamController.stream;

  ScannerService() {
    _initChannel();
  }

  void _initChannel() {
    try {
      _eventSubscription = _eventChannel.receiveBroadcastStream().listen(
        (dynamic event) {
          if (event is String && event.trim().isNotEmpty) {
            _scanStreamController.add(event.trim());
          }
        },
        onError: (dynamic error) {
          // Sur les plateformes de dev (Windows/Web), le channel natif peut être inactif
        },
      );
    } catch (_) {}
  }

  // Émission manuelle (par exemple depuis le Keyboard Wedge ou le scanner caméra)
  void notifyBarcode(String code) {
    if (code.trim().isNotEmpty) {
      _scanStreamController.add(code.trim());
    }
  }

  // Enregistrer une action d'intent personnalisée si le terminal POS utilise une action propriétaire
  Future<bool> registerCustomAction(String actionName) async {
    try {
      final res = await _methodChannel.invokeMethod<bool>(
        'registerCustomAction',
        {'action': actionName.trim()},
      );
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  void dispose() {
    _eventSubscription?.cancel();
    _scanStreamController.close();
  }
}
