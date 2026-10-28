class AppConstants {
  // Par défaut, l'adresse du serveur local ou de production
  // Le caissier peut la modifier dans les paramètres du terminal
  static const String defaultBaseUrl = 'https://thefairycrocheter.fr';
  static const String appTitle = 'TFC Caisse';
  static const String currency = 'XAF';

  // Format monétaire pour FCFA / XAF (ex: "15 000 XAF")
  static String formatCurrency(num amount) {
    final rounded = amount.round().toString();
    final withSpaces = rounded.replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]} ',
    );
    return '$withSpaces $currency';
  }

  // Format date et heure pour ticket thermique (ex: "25/10/2026 12:15")
  static String formatDateTime(DateTime dt) {
    final d = dt.day.toString().padLeft(2, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final y = dt.year.toString();
    final h = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$d/$m/$y $h:$min';
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
