import 'package:flutter_test/flutter_test.dart';
import 'package:caisse_mobile/models/cart_item.dart';
import 'package:caisse_mobile/models/product.dart';
import 'package:caisse_mobile/models/client.dart';
import 'package:caisse_mobile/providers/cart_provider.dart';

void main() {
  group('POS Unit Tests - The Fairy Crocheter', () {
    test('Calcul des paliers de prix et remises dans CartItem', () {
      final product = Product(
        id: 'p1',
        nom: 'Pelote Laine Velours',
        prixVente: 2500,
        tauxTVA: 0,
        stockActuel: 50,
        stockMinimum: 5,
        variantes: [],
        paliers: [
          PalierPrix(quantiteMin: 10, prixUnitaire: 2200),
          PalierPrix(quantiteMin: 20, prixUnitaire: 2000),
        ],
      );

      // Quantité 5 -> prixVente normal (2500 XAF)
      expect(product.getPrixPourQuantite(5), 2500.0);
      // Quantité 12 -> palier 10 (2200 XAF)
      expect(product.getPrixPourQuantite(12), 2200.0);
      // Quantité 25 -> palier 20 (2000 XAF)
      expect(product.getPrixPourQuantite(25), 2000.0);

      final item = CartItem(
        produitId: product.id,
        nom: product.nom,
        quantite: 10,
        prixBase: product.prixVente,
        paliers: product.paliers,
        remise: 1000,
        tauxTVA: 0,
        stockDisponible: 50,
      );

      expect(item.prixUnitaire, 2200.0);
      expect(item.sousTotal, 22000.0);
      expect(item.total, 21000.0); // 22000 - 1000 remise
    });

    test('CartProvider calcul du total et monnaie rendue', () {
      final cart = CartProvider();
      final product = Product(
        id: 'p1',
        nom: 'Aiguille Crochet 4mm',
        prixVente: 1500,
        tauxTVA: 0,
        stockActuel: 10,
        stockMinimum: 2,
        variantes: [],
        paliers: [],
      );

      cart.addItem(product, quantity: 2);
      expect(cart.totalArticles, 2);
      expect(cart.sousTotal, 3000.0);
      expect(cart.total, 3000.0);

      // Remise globale de 500 XAF
      cart.setRemiseGlobale(500);
      expect(cart.total, 2500.0);

      // Espèces reçues : 5 000 XAF -> Monnaie à rendre : 2 500 XAF
      cart.setModePaiement('ESPECES');
      cart.setMontantRecu(5000);
      expect(cart.monnaieRendue, 2500.0);

      // Association client
      final client = Client(
        id: 'c1',
        nom: 'Kouassi',
        prenom: 'Amina',
        totalAchats: 45000,
      );
      cart.setClient(client);
      expect(cart.client?.nomComplet, 'Amina Kouassi');

      // Vider le panier
      cart.clearCart();
      expect(cart.items.isEmpty, true);
      expect(cart.total, 0.0);
      expect(cart.client, null);
    });
  });
}
