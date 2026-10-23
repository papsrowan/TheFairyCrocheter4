import 'package:intl/intl.dart';

class AppConstants {
  // Par défaut, l'adresse du serveur local ou de production
  // Le caissier peut la modifier dans les paramètres du terminal
  static const String defaultBaseUrl = 'https://thefairycrocheter.fr';
  static const String appTitle = 'The Fairy Crocheter POS';
  static const String currency = 'XAF';

  // Format monétaire pour FCFA / XAF (ex: "15 000 XAF")
  static String formatCurrency(num amount) {
    final formatter = NumberFormat('#,###', 'fr_FR');
    return '${formatter.format(amount).replaceAll(',', ' ')} $currency';
  }

  // Format date et heure pour ticket thermique
  static String formatDateTime(DateTime dt) {
    return DateFormat('dd/MM/yyyy HH:mm', 'fr_FR').format(dt);
  }

  // Coupures usuelles en Francs CFA pour l'encaissement rapide
  static const List<int> quickCashAmounts = [
    500,
    1000,
    2000,
    5000,
    10000,
    20000,
    50000,
  ];
}
