import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/user.dart';
import '../models/product.dart';
import '../models/sale.dart';

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
  static const String keyCashDrawerPin = 'pos_cash_drawer_pin';
  static const String keyRequireDrawerPin = 'pos_require_drawer_pin';
  static const String keyOfflineModeEnabled = 'pos_offline_mode_enabled';
  static const String keyCachedProducts = 'pos_cached_products';
  static const String keyLastProductsCacheDate = 'pos_last_products_cache_date';
  static const String keyCachedSales = 'pos_cached_sales';

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

  String getCashDrawerPin() {
    final pin = _prefs.getString(keyCashDrawerPin);
    if (pin == null || pin.isEmpty || pin == '123456') {
      return '799270';
    }
    return pin;
  }
  Future<void> setCashDrawerPin(String pin) => _prefs.setString(keyCashDrawerPin, pin.trim());

  bool getRequireDrawerPin() => _prefs.getBool(keyRequireDrawerPin) ?? true;
  Future<void> setRequireDrawerPin(bool val) => _prefs.setBool(keyRequireDrawerPin, val);

  String getPrinterMode() => _prefs.getString(keyPrinterMode) ?? 'android_spooler';
  Future<void> setPrinterMode(String mode) => _prefs.setString(keyPrinterMode, mode);

  String getScannerMode() => _prefs.getString(keyScannerMode) ?? 'wedge';
  Future<void> setScannerMode(String mode) => _prefs.setString(keyScannerMode, mode);

  String getCustomIntentAction() => _prefs.getString(keyCustomIntentAction) ?? '';
  Future<void> setCustomIntentAction(String act) => _prefs.setString(keyCustomIntentAction, act.trim());

  // Mode Hors-Ligne & Cache
  bool getOfflineModeEnabled() => _prefs.getBool(keyOfflineModeEnabled) ?? true;
  Future<void> setOfflineModeEnabled(bool val) => _prefs.setBool(keyOfflineModeEnabled, val);

  // Cache Produits
  DateTime? getLastProductsCacheDate() {
    final str = _prefs.getString(keyLastProductsCacheDate);
    if (str == null) return null;
    return DateTime.tryParse(str);
  }

  Future<void> saveCachedProducts(List<Product> products) async {
    final rawList = products.map((p) => p.toJson()).toList();
    await _prefs.setString(keyCachedProducts, jsonEncode(rawList));
    await _prefs.setString(keyLastProductsCacheDate, DateTime.now().toIso8601String());
  }

  List<Product> getCachedProducts() {
    final raw = _prefs.getString(keyCachedProducts);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> decrementLocalStock(String produitId, String? varianteId, int quantite) async {
    final products = getCachedProducts();
    final pIdx = products.indexWhere((p) => p.id == produitId);
    if (pIdx < 0) return;

    final p = products[pIdx];
    int newStock = (p.stockActuel - quantite).clamp(0, 999999);
    List<VarianteCouleur> newVariantes = List.from(p.variantes);

    if (varianteId != null) {
      final vIdx = newVariantes.indexWhere((v) => v.id == varianteId);
      if (vIdx >= 0) {
        final v = newVariantes[vIdx];
        newVariantes[vIdx] = VarianteCouleur(
          id: v.id,
          couleur: v.couleur,
          description: v.description,
          codeBarres: v.codeBarres,
          stockActuel: (v.stockActuel - quantite).clamp(0, 999999),
        );
      }
    }

    products[pIdx] = Product(
      id: p.id,
      nom: p.nom,
      description: p.description,
      codeBarres: p.codeBarres,
      prixVente: p.prixVente,
      prixGros: p.prixGros,
      qtePrixGros: p.qtePrixGros,
      tauxTVA: p.tauxTVA,
      stockActuel: newStock,
      stockMinimum: p.stockMinimum,
      imageUrl: p.imageUrl,
      categorieNom: p.categorieNom,
      variantes: newVariantes,
      paliers: p.paliers,
    );

    await saveCachedProducts(products);
  }

  // Cache Ventes
  Future<void> saveCachedSales(List<VenteItem> sales) async {
    final rawList = sales.map((s) => s.toJson()).toList();
    await _prefs.setString(keyCachedSales, jsonEncode(rawList));
  }

  List<VenteItem> getCachedSales() {
    final raw = _prefs.getString(keyCachedSales);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((e) => VenteItem.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

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

  Future<void> addToOfflineQueue(Map<String, dynamic> salePayload, {Map<String, dynamic>? extraInfo}) async {
    final queue = getOfflineQueue();
    queue.add({
      'id': 'off_${DateTime.now().millisecondsSinceEpoch}',
      'type': 'vente',
      'payload': salePayload,
      'extra': extraInfo,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    });
    await _prefs.setString(keyOfflineQueue, jsonEncode(queue));
  }

  List<VenteItem> getOfflineSalesAsVenteItems() {
    final queue = getOfflineQueue();
    final List<VenteItem> list = [];
    for (final item in queue) {
      try {
        final payload = item['payload'] as Map<String, dynamic>?;
        final extra = item['extra'] as Map<String, dynamic>?;
        if (payload == null) continue;

        final offlineId = item['id'] as String? ?? 'off_${DateTime.now().millisecondsSinceEpoch}';
        final createdAtStr = item['createdAt'] as String? ?? DateTime.now().toIso8601String();
        final dt = DateTime.tryParse(createdAtStr) ?? DateTime.now();

        final numero = extra?['numero'] as String? ?? 'OFF-${dt.year}-${offlineId.replaceAll('off_', '').substring(0, 5)}';
        final clientNom = extra?['clientNom'] as String?;
        final vendeurNom = extra?['vendeurNom'] as String? ?? 'Caisse';
        final total = (extra?['total'] as num?)?.toDouble() ?? (payload['prixSpecial'] as num?)?.toDouble() ?? 0.0;
        final sousTotal = (extra?['sousTotal'] as num?)?.toDouble() ?? total;
        final remiseGlobale = (payload['remiseGlobale'] as num?)?.toDouble() ?? 0.0;
        final modePaiement = payload['modePaiement'] as String? ?? 'ESPECES';

        final List<LigneVenteItem> lignesList = [];
        if (extra?['lignes'] is List) {
          for (final l in extra!['lignes'] as List) {
            if (l is Map<String, dynamic>) {
              lignesList.add(LigneVenteItem.fromJson(l));
            }
          }
        }

        list.add(
          VenteItem(
            id: offlineId,
            numero: numero,
            createdAt: dt,
            dateFacture: dt,
            statut: 'OFFLINE_PENDING',
            statutPaiement: 'PAYE',
            modePaiement: modePaiement,
            sousTotal: sousTotal,
            remiseGlobale: remiseGlobale,
            total: total,
            clientNom: clientNom,
            vendeurNom: vendeurNom,
            lignes: lignesList,
          ),
        );
      } catch (_) {}
    }
    return list;
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
