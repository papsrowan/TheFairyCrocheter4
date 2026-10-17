import 'package:flutter/foundation.dart';
import '../models/sale.dart';
import '../services/api_service.dart';

class SalesHistoryProvider extends ChangeNotifier {
  final ApiService apiService;

  List<VenteItem> _sales = [];
  bool _isLoading = false;
  String? _errorMessage;
  String _searchQuery = '';

  SalesHistoryProvider({required this.apiService});

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
      _sales = await apiService.getSales(page: 1, pageSize: 50, search: _searchQuery);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
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
      _sales = await apiService.getSales(page: 1, pageSize: 50, search: q);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<VenteItem?> fetchSaleDetails(String id) async {
    try {
      return await apiService.getSaleDetails(id);
    } catch (e) {
      return null;
    }
  }
}
