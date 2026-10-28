import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class CatalogProvider extends ChangeNotifier {
  final ApiService apiService;
  final StorageService storageService;

  List<Product> _products = [];
  List<Product> _filteredProducts = [];
  Set<String> _categories = {};
  String? _selectedCategory;
  String _searchQuery = '';
  bool _isLoading = false;
  bool _isOffline = false;
  String? _errorMessage;

  List<Product> get products => _products;
  List<Product> get filteredProducts => _filteredProducts;
  Set<String> get categories => _categories;
  String? get selectedCategory => _selectedCategory;
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  bool get isOffline => _isOffline;
  String? get errorMessage => _errorMessage;

  CatalogProvider({
    required this.apiService,
    required this.storageService,
  }) {
    _initFromCache();
  }

  void _initFromCache() {
    final cached = storageService.getCachedProducts();
    if (cached.isNotEmpty) {
      _products = cached;
      _rebuildCategories();
      _applyFilters();
    }
  }

  void _rebuildCategories() {
    final cats = <String>{};
    for (final p in _products) {
      if (p.categorieNom != null && p.categorieNom!.isNotEmpty) {
        cats.add(p.categorieNom!);
      }
    }
    _categories = cats;
  }

  Future<void> loadCatalog({bool force = false}) async {
    if (_products.isNotEmpty && !force && !_isOffline) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final list = await apiService.searchProducts(all: true, limit: 100);
      _products = list;
      _isOffline = false;

      // Sauvegarde automatique du cache local
      await storageService.saveCachedProducts(list);

      _rebuildCategories();
      _applyFilters();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      final cached = storageService.getCachedProducts();
      if (cached.isNotEmpty) {
        _products = cached;
        _isOffline = true;
        _rebuildCategories();
        _applyFilters();
        _errorMessage = null;
      } else {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      }
      notifyListeners();
    }
  }

  void setSearchQuery(String q) {
    _searchQuery = q.trim();
    _applyFilters();
    notifyListeners();
  }

  void selectCategory(String? cat) {
    _selectedCategory = cat;
    _applyFilters();
    notifyListeners();
  }

  void _applyFilters() {
    _filteredProducts = _products.where((p) {
      final matchesCat = _selectedCategory == null || p.categorieNom == _selectedCategory;
      final matchesQuery = _searchQuery.isEmpty ||
          p.nom.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          (p.codeBarres != null && p.codeBarres!.contains(_searchQuery)) ||
          p.variantes.any((v) => v.couleur.toLowerCase().contains(_searchQuery.toLowerCase()));
      return matchesCat && matchesQuery;
    }).toList();
  }

  // Recherche rapide par code-barres (local puis distant si non trouvé)
  Future<Product?> findByBarcode(String barcode) async {
    final cleanCode = barcode.trim();
    if (cleanCode.isEmpty) return null;

    // 1. Chercher d'abord dans le catalogue en mémoire
    for (final p in _products) {
      if (p.codeBarres == cleanCode) return p;
      for (final v in p.variantes) {
        if (v.codeBarres == cleanCode) return p;
      }
    }

    // 2. Si pas trouvé, interroger le serveur
    try {
      final distantResults = await apiService.searchProducts(query: cleanCode, limit: 1);
      if (distantResults.isNotEmpty) {
        final found = distantResults.first;
        // L'ajouter au catalogue local s'il n'y est pas
        if (!_products.any((p) => p.id == found.id)) {
          _products.add(found);
          _applyFilters();
          notifyListeners();
        }
        return found;
      }
    } catch (_) {}

    return null;
  }

  Future<void> decrementStock(String produitId, String? varianteId, int qty) async {
    // 1. Décrémenter dans le stockage persistant
    await storageService.decrementLocalStock(produitId, varianteId, qty);

    // 2. Mettre à jour en mémoire vive
    final pIdx = _products.indexWhere((p) => p.id == produitId);
    if (pIdx != -1) {
      final p = _products[pIdx];
      List<VarianteCouleur> updatedVars = p.variantes;
      if (varianteId != null) {
        updatedVars = p.variantes.map((v) {
          if (v.id == varianteId) {
            return v.copyWith(stockActuel: math.max(0, v.stockActuel - qty));
          }
          return v;
        }).toList();
      }
      _products[pIdx] = p.copyWith(
        stockActuel: math.max(0, p.stockActuel - qty),
        variantes: updatedVars,
      );
      _applyFilters();
      notifyListeners();
    }
  }

  void reloadFromCache() {
    _initFromCache();
    notifyListeners();
  }
}
