import 'package:flutter/services.dart';

class CashDrawerService {
  static const MethodChannel _channel =
      MethodChannel('com.thefairycrocheter.pos/scanner_config');

  /// Déclenche l'impulsion électrique RJ12 pour ouvrir le tiroir-caisse physique
  static Future<bool> openDrawer({String? code}) async {
    try {
      final res = await _channel.invokeMethod<bool>('openCashDrawer', {
        'code': code ?? '',
      });
      return res ?? true;
    } catch (_) {
      return false;
    }
  }

  /// Génère les octets d'impulsion standard ESC/POS pour tiroir-caisse (Pin 2 et Pin 5)
  static List<int> getDrawerKickBytes() {
    return [
      27, 112, 0, 25, 250, // ESC p 0 25 250 (Pin 2 kick: 50ms pulse)
      27, 112, 1, 25, 250, // ESC p 1 25 250 (Pin 5 kick: 50ms pulse)
      16, 20, 1, 0, 5,     // DLE DC4 1 0 5 (Real-time kick pulse)
    ];
  }
}
