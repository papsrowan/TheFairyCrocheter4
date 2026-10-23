import 'package:flutter/services.dart';

class FeedbackService {
  // Bip / clic de succès lors d'un scan code-barres réussi ou ajout au panier
  static Future<void> scanSuccess() async {
    try {
      await SystemSound.play(SystemSoundType.click);
      await HapticFeedback.mediumImpact();
    } catch (_) {}
  }

  // Vibration d'erreur (produit non trouvé ou rupture de stock)
  static Future<void> scanError() async {
    try {
      await HapticFeedback.heavyImpact();
      await Future.delayed(const Duration(milliseconds: 100));
      await HapticFeedback.heavyImpact();
    } catch (_) {}
  }

  // Clic léger de sélection tactile
  static Future<void> tap() async {
    try {
      await HapticFeedback.selectionClick();
    } catch (_) {}
  }
}
