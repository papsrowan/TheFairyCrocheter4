import 'product.dart';

class CartItem {
  final String produitId;
  final String? varianteId;
  final String nom;
  final String? couleur;
  final String? codeBarres;
  int quantite;
  final double prixBase;
  final List<PalierPrix> paliers;
  final double? prixGros;
  final int? qtePrixGros;
  double remise; // Remise totale sur la ligne en XAF
  final double tauxTVA;
  final int stockDisponible;

  CartItem({
    required this.produitId,
    this.varianteId,
    required this.nom,
    this.couleur,
    this.codeBarres,
    this.quantite = 1,
    required this.prixBase,
    this.paliers = const [],
    this.prixGros,
    this.qtePrixGros,
    this.remise = 0.0,
    required this.tauxTVA,
    required this.stockDisponible,
  });

  String get cartKey => varianteId != null ? '${produitId}__$varianteId' : produitId;

  // Calcul du prix unitaire dynamique selon les paliers de quantité
  double get prixUnitaire {
    if (paliers.isNotEmpty) {
      final paliersTries = List<PalierPrix>.from(paliers)
        ..sort((a, b) => b.quantiteMin.compareTo(a.quantiteMin));
      for (final p in paliersTries) {
        if (quantite >= p.quantiteMin) {
          return p.prixUnitaire;
        }
      }
    }
    if (prixGros != null && qtePrixGros != null && quantite >= qtePrixGros!) {
      return prixGros!;
    }
    return prixBase;
  }

  // Sous-total brut de la ligne
  double get sousTotal => prixUnitaire * quantite;

  // Total net après remise de la ligne
  double get total => (sousTotal - remise).clamp(0.0, double.infinity);

  // Formatage pour l'API Next.js /api/ventes
  Map<String, dynamic> toApiLigne() => {
    'produitId': produitId,
    'varianteId': varianteId,
    'quantite': quantite,
    'prixUnitaire': prixUnitaire,
    'remise': remise,
    'tauxTVA': tauxTVA,
  };
}
