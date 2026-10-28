class VarianteCouleur {
  final String id;
  final String couleur;
  final String? description;
  final String? codeBarres;
  final int stockActuel;

  VarianteCouleur({
    required this.id,
    required this.couleur,
    this.description,
    this.codeBarres,
    required this.stockActuel,
  });

  factory VarianteCouleur.fromJson(Map<String, dynamic> json) {
    return VarianteCouleur(
      id: json['id'] as String? ?? '',
      couleur: json['couleur'] as String? ?? 'Standard',
      description: json['description'] as String?,
      codeBarres: json['codeBarres'] as String?,
      stockActuel: (json['stockActuel'] as num?)?.toInt() ?? 0,
    );
  }

  VarianteCouleur copyWith({
    String? id,
    String? couleur,
    String? description,
    String? codeBarres,
    int? stockActuel,
  }) {
    return VarianteCouleur(
      id: id ?? this.id,
      couleur: couleur ?? this.couleur,
      description: description ?? this.description,
      codeBarres: codeBarres ?? this.codeBarres,
      stockActuel: stockActuel ?? this.stockActuel,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'couleur': couleur,
    'description': description,
    'codeBarres': codeBarres,
    'stockActuel': stockActuel,
  };
}

class PalierPrix {
  final int quantiteMin;
  final double prixUnitaire;

  PalierPrix({
    required this.quantiteMin,
    required this.prixUnitaire,
  });

  factory PalierPrix.fromJson(Map<String, dynamic> json) {
    return PalierPrix(
      quantiteMin: (json['quantiteMin'] as num?)?.toInt() ?? 1,
      prixUnitaire: (json['prixUnitaire'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'quantiteMin': quantiteMin,
    'prixUnitaire': prixUnitaire,
  };
}

class Product {
  final String id;
  final String nom;
  final String? description;
  final String? codeBarres;
  final double prixVente;
  final double? prixGros;
  final int? qtePrixGros;
  final double tauxTVA;
  final int stockActuel;
  final int stockMinimum;
  final String? imageUrl;
  final String? categorieNom;
  final List<VarianteCouleur> variantes;
  final List<PalierPrix> paliers;

  Product({
    required this.id,
    required this.nom,
    this.description,
    this.codeBarres,
    required this.prixVente,
    this.prixGros,
    this.qtePrixGros,
    required this.tauxTVA,
    required this.stockActuel,
    required this.stockMinimum,
    this.imageUrl,
    this.categorieNom,
    required this.variantes,
    required this.paliers,
  });

  bool get enRupture => stockActuel <= 0;
  bool get stockFaible => stockActuel > 0 && stockActuel <= stockMinimum;
  bool get hasVariantes => variantes.isNotEmpty;

  // Calcul du prix unitaire selon la quantité (paliers dégressifs)
  double getPrixPourQuantite(int quantite) {
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
    return prixVente;
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    String? catName;
    if (json['categorie'] is Map) {
      catName = json['categorie']['nom'] as String?;
    } else if (json['categorie'] is String) {
      catName = json['categorie'] as String;
    }

    final List<VarianteCouleur> vars = [];
    if (json['variantes'] is List) {
      for (final v in json['variantes'] as List) {
        if (v is Map<String, dynamic>) {
          vars.add(VarianteCouleur.fromJson(v));
        }
      }
    }

    final List<PalierPrix> pals = [];
    if (json['paliers'] is List) {
      for (final p in json['paliers'] as List) {
        if (p is Map<String, dynamic>) {
          pals.add(PalierPrix.fromJson(p));
        }
      }
    }

    return Product(
      id: json['id'] as String? ?? '',
      nom: json['nom'] as String? ?? 'Sans nom',
      description: json['description'] as String?,
      codeBarres: json['codeBarres'] as String?,
      prixVente: (json['prixVente'] as num?)?.toDouble() ?? 0.0,
      prixGros: (json['prixGros'] as num?)?.toDouble(),
      qtePrixGros: (json['qtePrixGros'] as num?)?.toInt(),
      tauxTVA: (json['tauxTVA'] as num?)?.toDouble() ?? 0.0,
      stockActuel: (json['stockActuel'] as num?)?.toInt() ?? 0,
      stockMinimum: (json['stockMinimum'] as num?)?.toInt() ?? 5,
      imageUrl: json['imageUrl'] as String?,
      categorieNom: catName,
      variantes: vars,
      paliers: pals,
    );
  }

  Product copyWith({
    String? id,
    String? nom,
    String? description,
    String? codeBarres,
    double? prixVente,
    double? prixGros,
    int? qtePrixGros,
    double? tauxTVA,
    int? stockActuel,
    int? stockMinimum,
    String? imageUrl,
    String? categorieNom,
    List<VarianteCouleur>? variantes,
    List<PalierPrix>? paliers,
  }) {
    return Product(
      id: id ?? this.id,
      nom: nom ?? this.nom,
      description: description ?? this.description,
      codeBarres: codeBarres ?? this.codeBarres,
      prixVente: prixVente ?? this.prixVente,
      prixGros: prixGros ?? this.prixGros,
      qtePrixGros: qtePrixGros ?? this.qtePrixGros,
      tauxTVA: tauxTVA ?? this.tauxTVA,
      stockActuel: stockActuel ?? this.stockActuel,
      stockMinimum: stockMinimum ?? this.stockMinimum,
      imageUrl: imageUrl ?? this.imageUrl,
      categorieNom: categorieNom ?? this.categorieNom,
      variantes: variantes ?? this.variantes,
      paliers: paliers ?? this.paliers,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'nom': nom,
    'description': description,
    'codeBarres': codeBarres,
    'prixVente': prixVente,
    'prixGros': prixGros,
    'qtePrixGros': qtePrixGros,
    'tauxTVA': tauxTVA,
    'stockActuel': stockActuel,
    'stockMinimum': stockMinimum,
    'imageUrl': imageUrl,
    'categorie': categorieNom != null ? {'nom': categorieNom} : null,
    'variantes': variantes.map((v) => v.toJson()).toList(),
    'paliers': paliers.map((p) => p.toJson()).toList(),
  };
}
