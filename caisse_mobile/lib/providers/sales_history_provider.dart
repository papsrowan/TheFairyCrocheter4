import 'package:flutter/foundation.dart';
import '../models/sale.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class SalesHistoryProvider extends ChangeNotifier {
  final ApiService apiService;
  final StorageService storageService;

  List<VenteItem> _sales = [];
  bool _isLoading = false;
  String? _errorMessage;
  String _searchQuery = '';

  SalesHistoryProvider({
    required this.apiService,
    required this.storageService,
  }) {
    _initFromCache();
  }

  void _initFromCache() {
    final offline = storageService.getOfflineSalesAsVenteItems();
    final cached = storageService.getCachedSales();
    if (offline.isNotEmpty || cached.isNotEmpty) {
      _sales = [...offline, ...cached];
    }
  }

  List<VenteItem> get sales => List.unmodifiable(_sales);
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String get searchQuery => _searchQuery;

  List<VenteItem> get filteredSales {
    if (_searchQuery.trim().isEmpty) return _sales;
    final q = _searchQuery.toLowerCase().trim();
    return _sales.where((v) {
      final numMatch = v.numero.toLowerCase().contains(q);
      final clientMatch = v.clientNom?.toLowerCase().contains(q) ?? false;
      final modeMatch = v.modePaiement.toLowerCase().contains(q);
      return numMatch || clientMatch || modeMatch;
    }).toList();
  }

  Future<void> loadSales({bool force = false}) async {
    if (_isLoading) return;
    if (_sales.isNotEmpty && !force) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final serverSales = await apiService.getSales(page: 1, pageSize: 50, search: _searchQuery);
      await storageService.saveCachedSales(serverSales);
      final offlineSales = storageService.getOfflineSalesAsVenteItems();

      // Fusionner : les ventes hors-ligne en attente apparaissent tout en haut
      _sales = [...offlineSales, ...serverSales];
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      final cached = storageService.getCachedSales();
      final offlineSales = storageService.getOfflineSalesAsVenteItems();
      _sales = [...offlineSales, ...cached];

      _errorMessage = _sales.isNotEmpty ? null : e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  void setSearchQuery(String q) {
    _searchQuery = q;
    notifyListeners();
  }

  Future<void> searchOnServer(String q) async {
    _searchQuery = q;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final serverSales = await apiService.getSales(page: 1, pageSize: 50, search: q);
      await storageService.saveCachedSales(serverSales);
      final offlineSales = storageService.getOfflineSalesAsVenteItems();
      _sales = [...offlineSales, ...serverSales];
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      final cached = storageService.getCachedSales();
      final offlineSales = storageService.getOfflineSalesAsVenteItems();
      _sales = [...offlineSales, ...cached];
      _errorMessage = _sales.isNotEmpty ? null : e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  void refreshWithOfflineSales() {
    final offlineSales = storageService.getOfflineSalesAsVenteItems();
    final cached = storageService.getCachedSales();
    
    // Garder les ventes serveur existantes ou en cache, et mettre les ventes offline au début
    final existingServerIds = <String>{};
    final serverList = <VenteItem>[];
    for (final s in _sales) {
      if (!s.isOfflinePending && existingServerIds.add(s.id)) {
        serverList.add(s);
      }
    }
    if (serverList.isEmpty) {
      serverList.addAll(cached);
    }
    _sales = [...offlineSales, ...serverList];
    notifyListeners();
  }

  Future<VenteItem?> fetchSaleDetails(String id) async {
    // 1. Si c'est une vente offline en attente, elle a déjà ses lignes
    final offlineMatch = _sales.where((v) => v.id == id).firstOrNull;
    if (offlineMatch != null && offlineMatch.lignes.isNotEmpty) {
      return offlineMatch;
    }

    // 2. Sinon interroger l'API distante
    try {
      return await apiService.getSaleDetails(id);
    } catch (e) {
      return offlineMatch;
    }
  }
}
