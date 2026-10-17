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
  bool _isSubmitting = false;

  // ─── OPTIONS AVANCÉES (ALIGNÉES SUR LE WEB /ventes/nouvelle) ─────────────
  bool _showPrixSpecial = false;
  double? _prixSpecial;
  String? _motifPrixSpecial;

  bool _payerPlusTard = false; // Mode Vente à Crédit
  DateTime? _dateEcheance;

  bool _paiementPartiel = false; // Acompte versé immédiatement
  double? _montantPaye; // Montant de l'acompte

  DateTime? _dateFacture; // Antidatage optionnel

  // Getters
  List<CartItem> get items => List.unmodifiable(_items);
  Client? get client => _client;
  double get remiseGlobale => _remiseGlobale;
  String get modePaiement => _modePaiement;
  double get montantRecu => _montantRecu;
  bool get isSubmitting => _isSubmitting;

  bool get showPrixSpecial => _showPrixSpecial;
  double? get prixSpecial => _prixSpecial;
  String? get motifPrixSpecial => _motifPrixSpecial;

  bool get payerPlusTard => _payerPlusTard;
  DateTime? get dateEcheance => _dateEcheance;

  bool get paiementPartiel => _paiementPartiel;
  double? get montantPaye => _montantPaye;

  DateTime? get dateFacture => _dateFacture;

  int get totalArticles => _items.fold(0, (sum, item) => sum + item.quantite);

  double get sousTotal => _items.fold(0.0, (sum, item) => sum + item.sousTotal);

  double get totalRemisesLignes => _items.fold(0.0, (sum, item) => sum + item.remise);

  double get totalRemises => totalRemisesLignes + _remiseGlobale;

  // Total catalogue calculé
  double get totalCalcule => (sousTotal - totalRemises).clamp(0.0, double.infinity);

  // Total final effectif (prend en compte le prix spécial si activé)
  double get total {
    if (_showPrixSpecial && _prixSpecial != null && _prixSpecial! > 0) {
      return _prixSpecial!;
    }
    return totalCalcule;
  }

  // Reste à payer pour les ventes à crédit ou acomptes
  double get resteAPayer {
    if (!_payerPlusTard) return 0.0;
    if (_paiementPartiel && _montantPaye != null && _montantPaye! > 0) {
      return (total - _montantPaye!).clamp(0.0, double.infinity);
    }
    return total;
  }

  // Montant devant être encaissé aujourd'hui (pour le calcul du rendu de monnaie)
  double get montantAEncaisser {
    if (_payerPlusTard) {
      if (_paiementPartiel && _montantPaye != null) {
        return _montantPaye!;
      }
      return 0.0;
    }
    return total;
  }

  double get monnaieRendue {
    if (_modePaiement != 'ESPECES') return 0.0;
    final aPayer = montantAEncaisser;
    if (_montantRecu <= aPayer) return 0.0;
    return _montantRecu - aPayer;
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
          couleurDescription: variante?.description,
          codeBarres: variante?.codeBarres ?? product.codeBarres,
          imageUrl: product.imageUrl,
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
    _montantRecu = montantAEncaisser;
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
    _montantRecu = montantAEncaisser;
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
    _montantRecu = montantAEncaisser;
    notifyListeners();
  }

  void setLineDiscount(String cartKey, double discount) {
    final idx = _items.indexWhere((i) => i.cartKey == cartKey);
    if (idx >= 0) {
      _items[idx].remise = discount.clamp(0.0, _items[idx].sousTotal);
      _montantRecu = montantAEncaisser;
      notifyListeners();
    }
  }

  void removeItem(String cartKey) {
    _items.removeWhere((i) => i.cartKey == cartKey);
    _montantRecu = montantAEncaisser;
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
    _montantRecu = montantAEncaisser;
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

  // ─── CONTRÔLES DES OPTIONS AVANCÉES ──────────────────────────────────────────

  void setPrixSpecialEnabled(bool enabled) {
    _showPrixSpecial = enabled;
    if (!enabled) {
      _prixSpecial = null;
      _motifPrixSpecial = null;
    }
    _montantRecu = montantAEncaisser;
    notifyListeners();
  }

  void setPrixSpecial(double? prix, {String? motif}) {
    _prixSpecial = prix;
    if (motif != null) _motifPrixSpecial = motif;
    _montantRecu = montantAEncaisser;
    notifyListeners();
  }

  void setPayerPlusTard(bool enabled) {
    _payerPlusTard = enabled;
    if (!enabled) {
      _paiementPartiel = false;
      _montantPaye = null;
      _dateEcheance = null;
    }
    _montantRecu = montantAEncaisser;
    notifyListeners();
  }

  void setDateEcheance(DateTime? dt) {
    _dateEcheance = dt;
    notifyListeners();
  }

  void setPaiementPartiel(bool enabled, {double? montant}) {
    _paiementPartiel = enabled;
    if (!enabled) {
      _montantPaye = null;
    } else if (montant != null) {
      _montantPaye = montant.clamp(0.0, total);
    }
    _montantRecu = montantAEncaisser;
    notifyListeners();
  }

  void setMontantPaye(double? montant) {
    _montantPaye = montant?.clamp(0.0, total);
    _montantRecu = montantAEncaisser;
    notifyListeners();
  }

  void setDateFacture(DateTime? dt) {
    _dateFacture = dt;
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    _client = null;
    _remiseGlobale = 0.0;
    _modePaiement = 'ESPECES';
    _montantRecu = 0.0;
    _showPrixSpecial = false;
    _prixSpecial = null;
    _motifPrixSpecial = null;
    _payerPlusTard = false;
    _dateEcheance = null;
    _paiementPartiel = false;
    _montantPaye = null;
    _dateFacture = null;
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
      'modePaiement': _payerPlusTard ? 'CREDIT' : _modePaiement,
      if (_showPrixSpecial && _prixSpecial != null && _prixSpecial! > 0) ...{
        'prixSpecial': _prixSpecial,
        if (_motifPrixSpecial != null && _motifPrixSpecial!.trim().isNotEmpty)
          'motifPrixSpecial': _motifPrixSpecial!.trim(),
      },
      if (_payerPlusTard && _dateEcheance != null)
        'dateEcheance': _dateEcheance!.toUtc().toIso8601String(),
      if (_payerPlusTard && _paiementPartiel && _montantPaye != null && _montantPaye! > 0)
        'montantPaye': _montantPaye,
      if (_dateFacture != null)
        'dateFacture': _dateFacture!.toUtc().toIso8601String(),
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
