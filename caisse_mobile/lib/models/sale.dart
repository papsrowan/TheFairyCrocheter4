import 'cart_item.dart';
import '../services/printer_service.dart';

class LigneVenteItem {
  final String id;
  final String produitId;
  final String? varianteId;
  final String nomProduit;
  final String? couleur;
  final String? couleurDescription;
  final String? imageUrl;
  final int quantite;
  final double prixUnitaire;
  final double remise;
  final double tauxTVA;
  final double total;

  LigneVenteItem({
    required this.id,
    required this.produitId,
    this.varianteId,
    required this.nomProduit,
    this.couleur,
    this.couleurDescription,
    this.imageUrl,
    required this.quantite,
    required this.prixUnitaire,
    this.remise = 0.0,
    this.tauxTVA = 0.0,
    required this.total,
  });

  factory LigneVenteItem.fromJson(Map<String, dynamic> json) {
    String nom = 'Produit inconnu';
    String? img;
    if (json['produit'] is Map) {
      final p = json['produit'] as Map<String, dynamic>;
      nom = p['nom'] as String? ?? nom;
      img = p['imageUrl'] as String?;
    }

    String? clr;
    String? clrDesc;
    if (json['variante'] is Map) {
      final v = json['variante'] as Map<String, dynamic>;
      clr = v['couleur'] as String?;
      clrDesc = v['description'] as String?;
    }

    return LigneVenteItem(
      id: json['id'] as String? ?? '',
      produitId: json['produitId'] as String? ?? '',
      varianteId: json['varianteId'] as String?,
      nomProduit: nom,
      couleur: clr,
      couleurDescription: clrDesc,
      imageUrl: img,
      quantite: (json['quantite'] as num?)?.toInt() ?? 1,
      prixUnitaire: (json['prixUnitaire'] as num?)?.toDouble() ?? 0.0,
      remise: (json['remise'] as num?)?.toDouble() ?? 0.0,
      tauxTVA: (json['tauxTVA'] as num?)?.toDouble() ?? 0.0,
      total: (json['total'] as num?)?.toDouble() ?? 0.0,
    );
  }

  CartItem toCartItem() {
    return CartItem(
      produitId: produitId,
      varianteId: varianteId,
      nom: nomProduit,
      couleur: couleur,
      couleurDescription: couleurDescription,
      imageUrl: imageUrl,
      quantite: quantite,
      prixBase: prixUnitaire,
      remise: remise,
      tauxTVA: tauxTVA,
      stockDisponible: 999,
    );
  }
}

class VenteItem {
  final String id;
  final String numero;
  final DateTime createdAt;
  final DateTime? dateFacture;
  final DateTime? dateEcheance;
  final String statut;
  final String statutPaiement;
  final String modePaiement;
  final double sousTotal;
  final double remiseGlobale;
  final double montantTVA;
  final double total;
  final double? montantPaye;
  final String? notes;
  final String? clientNom;
  final String? clientTelephone;
  final String? vendeurNom;
  final List<LigneVenteItem> lignes;

  VenteItem({
    required this.id,
    required this.numero,
    required this.createdAt,
    this.dateFacture,
    this.dateEcheance,
    required this.statut,
    required this.statutPaiement,
    required this.modePaiement,
    required this.sousTotal,
    this.remiseGlobale = 0.0,
    this.montantTVA = 0.0,
    required this.total,
    this.montantPaye,
    this.notes,
    this.clientNom,
    this.clientTelephone,
    this.vendeurNom,
    this.lignes = const [],
  });

  bool get isCredit => modePaiement == 'CREDIT';
  bool get isPaye => statutPaiement == 'PAYE';
  bool get isAnnulee => statut == 'ANNULEE';
  double get resteDu => isCredit
      ? (total - (montantPaye ?? 0.0)).clamp(0.0, double.infinity)
      : 0.0;

  factory VenteItem.fromJson(Map<String, dynamic> json) {
    String? cNom;
    String? cTel;
    if (json['client'] is Map) {
      final c = json['client'] as Map<String, dynamic>;
      final nom = c['nom'] as String? ?? '';
      final prenom = c['prenom'] as String? ?? '';
      cNom = '$nom $prenom'.trim();
      if (cNom.isEmpty) cNom = null;
      cTel = c['telephone'] as String?;
    }

    String? vNom;
    if (json['vendeur'] is Map) {
      final v = json['vendeur'] as Map<String, dynamic>;
      final nom = v['nom'] as String? ?? '';
      final prenom = v['prenom'] as String? ?? '';
      vNom = '$prenom $nom'.trim();
      if (vNom.isEmpty) vNom = null;
    }

    final List<LigneVenteItem> lignesList = [];
    if (json['lignes'] is List) {
      for (final l in json['lignes'] as List) {
        if (l is Map<String, dynamic>) {
          lignesList.add(LigneVenteItem.fromJson(l));
        }
      }
    }

    return VenteItem(
      id: json['id'] as String? ?? '',
      numero: json['numero'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      dateFacture: json['dateFacture'] != null
          ? DateTime.tryParse(json['dateFacture'] as String)
          : null,
      dateEcheance: json['dateEcheance'] != null
          ? DateTime.tryParse(json['dateEcheance'] as String)
          : null,
      statut: json['statut'] as String? ?? 'COMPLETEE',
      statutPaiement: json['statutPaiement'] as String? ?? 'PAYE',
      modePaiement: json['modePaiement'] as String? ?? 'ESPECES',
      sousTotal: (json['sousTotal'] as num?)?.toDouble() ?? 0.0,
      remiseGlobale: (json['remiseGlobale'] as num?)?.toDouble() ?? 0.0,
      montantTVA: (json['montantTVA'] as num?)?.toDouble() ?? 0.0,
      total: (json['total'] as num?)?.toDouble() ?? 0.0,
      montantPaye: (json['montantPaye'] as num?)?.toDouble(),
      notes: json['notes'] as String?,
      clientNom: cNom,
      clientTelephone: cTel,
      vendeurNom: vNom,
      lignes: lignesList,
    );
  }

  ReceiptData toReceiptData(String fallbackCaissier) {
    return ReceiptData(
      numeroVente: numero,
      date: dateFacture ?? createdAt,
      caissierNom: vendeurNom ?? fallbackCaissier,
      clientNom: clientNom,
      items: lignes.map((l) => l.toCartItem()).toList(),
      sousTotal: sousTotal,
      remiseGlobale: remiseGlobale,
      total: total,
      modePaiement: modePaiement,
      montantRecu: null,
      monnaieRendue: null,
    );
  }
}
