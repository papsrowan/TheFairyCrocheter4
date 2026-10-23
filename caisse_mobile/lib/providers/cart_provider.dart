import 'package:flutter/foundation.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../models/client.dart';
import '../models/sale_response.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/feedback_service.dart';

class CartProvider extends ChangeNotifier {
  final List<CartItem> _items = [];
  Client? _client;
  double _remiseGlobale = 0.0;
  String _modePaiement = 'ESPECES';
  double _montantRecu = 0.0;
  DateTime? _dateEcheance; // Si paiement à crédit
  bool _isSubmitting = false;

  List<CartItem> get items => List.unmodifiable(_items);
  Client? get client => _client;
  double get remiseGlobale => _remiseGlobale;
  String get modePaiement => _modePaiement;
  double get montantRecu => _montantRecu;
  DateTime? get dateEcheance => _dateEcheance;
  bool get isSubmitting => _isSubmitting;

  int get totalArticles => _items.fold(0, (sum, item) => sum + item.quantite);

  double get sousTotal => _items.fold(0.0, (sum, item) => sum + item.sousTotal);

  double get totalRemisesLignes => _items.fold(0.0, (sum, item) => sum + item.remise);

  double get totalRemises => totalRemisesLignes + _remiseGlobale;

  double get total => (sousTotal - totalRemises).clamp(0.0, double.infinity);

  double get monnaieRendue {
    if (_modePaiement != 'ESPECES' || _montantRecu <= total) return 0.0;
    return _montantRecu - total;
  }

  // ─── GESTION DES ARTICLES ────────────────────────────────────────────────────

  bool addItem(Product product, {VarianteCouleur? variante, int quantity = 1}) {
    final key = variante != null ? '${product.id}__${variante.id}' : product.id;
    final stockDispo = variante != null ? variante.stockActuel : product.stockActuel;

    final existingIndex = _items.indexWhere((i) => i.cartKey == key);

    if (existingIndex >= 0) {
      final item = _items[existingIndex];
      final newQty = item.quantite + quantity;
      if (newQty > stockDispo) {
        FeedbackService.scanError();
        return false;
      }
      item.quantite = newQty;
    } else {
      if (quantity > stockDispo && stockDispo > 0) {
        quantity = stockDispo;
      } else if (stockDispo <= 0) {
        FeedbackService.scanError();
        return false;
      }

      _items.add(
        CartItem(
          produitId: product.id,
          varianteId: variante?.id,
          nom: product.nom,
          couleur: variante?.couleur,
          codeBarres: variante?.codeBarres ?? product.codeBarres,
          quantite: quantity,
          prixBase: product.prixVente,
          paliers: product.paliers,
          prixGros: product.prixGros,
          qtePrixGros: product.qtePrixGros,
          tauxTVA: product.tauxTVA,
          stockDisponible: stockDispo,
        ),
      );
    }

    // Réinitialiser le montant reçu par défaut au montant total
    _montantRecu = total;
    FeedbackService.scanSuccess();
    notifyListeners();
    return true;
  }

  void updateQuantity(String cartKey, int delta) {
    final idx = _items.indexWhere((i) => i.cartKey == cartKey);
    if (idx < 0) return;

    final item = _items[idx];
    final newQty = item.quantite + delta;
    if (newQty <= 0) {
      _items.removeAt(idx);
    } else if (newQty <= item.stockDisponible) {
      item.quantite = newQty;
    }
    _montantRecu = total;
    notifyListeners();
  }

  void setQuantity(String cartKey, int quantity) {
    final idx = _items.indexWhere((i) => i.cartKey == cartKey);
    if (idx < 0) return;

    if (quantity <= 0) {
      _items.removeAt(idx);
    } else {
      _items[idx].quantite = quantity.clamp(1, _items[idx].stockDisponible);
    }
    _montantRecu = total;
    notifyListeners();
  }

  void setLineDiscount(String cartKey, double discount) {
    final idx = _items.indexWhere((i) => i.cartKey == cartKey);
    if (idx >= 0) {
      _items[idx].remise = discount.clamp(0.0, _items[idx].sousTotal);
      _montantRecu = total;
      notifyListeners();
    }
  }

  void removeItem(String cartKey) {
    _items.removeWhere((i) => i.cartKey == cartKey);
    _montantRecu = total;
    notifyListeners();
  }

  // ─── CLIENT & REMISE GLOBALE ─────────────────────────────────────────────────

  void setClient(Client? client) {
    _client = client;
    notifyListeners();
  }

  void clearClient() {
    _client = null;
    notifyListeners();
  }

  void setRemiseGlobale(double remise) {
    _remiseGlobale = remise.clamp(0.0, sousTotal);
    _montantRecu = total;
    notifyListeners();
  }

  void setModePaiement(String mode) {
    _modePaiement = mode;
    notifyListeners();
  }

  void setMontantRecu(double montant) {
    _montantRecu = montant;
    notifyListeners();
  }

  void setDateEcheance(DateTime? dt) {
    _dateEcheance = dt;
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    _client = null;
    _remiseGlobale = 0.0;
    _modePaiement = 'ESPECES';
    _montantRecu = 0.0;
    _dateEcheance = null;
    notifyListeners();
  }

  // ─── SOUMISSION DE LA VENTE ──────────────────────────────────────────────────

  Future<SaleResponse> submitSale({
    required ApiService apiService,
    required StorageService storageService,
  }) async {
    if (_items.isEmpty) {
      throw Exception('Le panier est vide');
    }

    _isSubmitting = true;
    notifyListeners();

    final payload = {
      'clientId': _client?.id,
      'lignes': _items.map((i) => i.toApiLigne()).toList(),
      'remiseGlobale': _remiseGlobale,
      'modePaiement': _modePaiement,
      if (_modePaiement == 'CREDIT' && _dateEcheance != null)
        'dateEcheance': _dateEcheance!.toUtc().toIso8601String(),
    };

    try {
      final response = await apiService.createSale(payload);
      _isSubmitting = false;
      notifyListeners();
      return response;
    } catch (e) {
      // En cas de panne réseau, sauvegarder dans la queue offline
      await storageService.addToOfflineQueue(payload);
      _isSubmitting = false;
      notifyListeners();

      // Retourner une confirmation locale temporaire
      return SaleResponse(
        id: 'offline_${DateTime.now().millisecondsSinceEpoch}',
        numero: 'VTE-OFFLINE-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
      );
    }
  }
}
