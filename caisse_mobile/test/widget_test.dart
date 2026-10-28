import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:caisse_mobile/models/cart_item.dart';
import 'package:caisse_mobile/models/product.dart';
import 'package:caisse_mobile/models/client.dart';
import 'package:caisse_mobile/providers/cart_provider.dart';
import 'package:caisse_mobile/providers/auth_provider.dart';
import 'package:caisse_mobile/providers/catalog_provider.dart';
import 'package:caisse_mobile/providers/sales_history_provider.dart';
import 'package:caisse_mobile/providers/terminal_settings_provider.dart';
import 'package:caisse_mobile/services/storage_service.dart';
import 'package:caisse_mobile/services/scanner_service.dart';
import 'package:caisse_mobile/services/api_service.dart';
import 'package:caisse_mobile/services/connectivity_sync_service.dart';
import 'package:caisse_mobile/screens/settings_screen.dart';
import 'package:caisse_mobile/services/printer_service.dart';
import 'package:caisse_mobile/widgets/cash_drawer_pin_dialog.dart';

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

    testWidgets('CashDrawerPinDialog se construit avec 6 cases et pavé numérique', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) {
                return ElevatedButton(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (_) => const CashDrawerPinDialog(),
                    );
                  },
                  child: const Text('Ouvrir'),
                );
              },
            ),
          ),
        ),
      );

      // Ouvrir le dialogue
      await tester.tap(find.text('Ouvrir'));
      await tester.pumpAndSettle();

      // Vérifier le titre et le bouton style Hardware Manager
      expect(find.text('Tiroir-Caisse (RJ12)'), findsOneWidget);
      expect(find.text('Open cash box (Ouvrir)'), findsOneWidget);
      expect(find.text('Hardware Cashbox'), findsOneWidget);
    });

    testWidgets('SettingsScreen se construit sans écran blanc', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      SharedPreferences.setMockInitialValues({});
      final storage = StorageService();
      await storage.init();
      final scanner = ScannerService();
      final api = ApiService(storageService: storage);
      final auth = AuthProvider(apiService: api, storageService: storage);
      final settings = TerminalSettingsProvider(storageService: storage, scannerService: scanner);
      final catalog = CatalogProvider(apiService: api, storageService: storage);
      final salesHistory = SalesHistoryProvider(apiService: api, storageService: storage);
      final connSync = ConnectivitySyncService(apiService: api, storageService: storage, autoStart: false);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: settings),
            ChangeNotifierProvider.value(value: catalog),
            ChangeNotifierProvider.value(value: salesHistory),
            ChangeNotifierProvider.value(value: connSync),
            Provider.value(value: api),
          ],
          child: const MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Vérifier que les sections de réglages sont bien affichées (pas d'écran blanc)
      expect(find.text('Paramètres du Terminal'), findsOneWidget);
      expect(find.text('Connexion Serveur'), findsOneWidget);
      expect(find.text('Mode Hors-Ligne & Cache Local'), findsOneWidget);
      expect(find.text('Activer le mode hors-ligne'), findsOneWidget);
    });

    test('Mode Hors-Ligne : Cache produits, décrémentation stock local et file d\'attente', () async {
      SharedPreferences.setMockInitialValues({});
      final storage = StorageService();
      await storage.init();

      // 1. Sauvegarder catalogue en cache
      final testProducts = [
        Product(
          id: 'prod_101',
          nom: 'Fil Coton Bio',
          prixVente: 3500,
          tauxTVA: 0,
          stockActuel: 15,
          stockMinimum: 3,
          variantes: [
            VarianteCouleur(id: 'var_a', couleur: 'Écru', stockActuel: 8),
            VarianteCouleur(id: 'var_b', couleur: 'Terracotta', stockActuel: 7),
          ],
          paliers: [],
        ),
      ];

      await storage.saveCachedProducts(testProducts);
      expect(storage.getCachedProducts().length, 1);
      expect(storage.getCachedProducts().first.stockActuel, 15);

      // 2. Décrémenter le stock local pour une vente
      await storage.decrementLocalStock('prod_101', 'var_b', 2);
      final cachedAfter = storage.getCachedProducts().first;
      expect(cachedAfter.stockActuel, 13);
      expect(cachedAfter.variantes.firstWhere((v) => v.id == 'var_b').stockActuel, 5);

      // 3. Enregistrer une vente hors-ligne dans la file
      final now = DateTime.now();
      final offlineId = 'offline_${now.millisecondsSinceEpoch}';
      final extraInfo = {
        'id': offlineId,
        'numero': 'OFF-2026-000123',
        'createdAt': now.toIso8601String(),
        'total': 7000.0,
        'sousTotal': 7000.0,
        'totalRemise': 0.0,
        'modePaiement': 'ESPECES',
        'clientNom': 'Client Passage',
        'lignes': [
          {
            'id': 'ligne_1',
            'produitId': 'prod_101',
            'varianteId': 'var_b',
            'produitNom': 'Fil Coton Bio',
            'couleur': 'Terracotta',
            'quantite': 2,
            'prixUnitaire': 3500.0,
            'sousTotal': 7000.0,
            'remise': 0.0,
            'total': 7000.0,
          }
        ],
      };

      await storage.addToOfflineQueue({'clientId': null, 'modePaiement': 'ESPECES'}, extraInfo: extraInfo);
      expect(storage.getOfflineQueue().length, 1);

      // 4. Vérifier la conversion en VenteItem pour l'historique
      final offlineVentes = storage.getOfflineSalesAsVenteItems();
      expect(offlineVentes.length, 1);
      expect(offlineVentes.first.numero, 'OFF-2026-000123');
      expect(offlineVentes.first.isOfflinePending, true);
      expect(offlineVentes.first.statut, 'OFFLINE_PENDING');
      expect(offlineVentes.first.total, 7000.0);
      expect(offlineVentes.first.lignes.length, 1);
    });

    test('PrinterService.cleanItemTitle retire strictement tout détail ou parenthèse de couleur', () {
      final itemHex = CartItem(
        produitId: 'p1',
        nom: 'Pelote Coton',
        couleur: '#C1683E',
        prixBase: 2000,
        tauxTVA: 0,
        stockDisponible: 10,
      );
      expect(PrinterService.cleanItemTitle(itemHex), 'Pelote Coton');

      final itemDesc = CartItem(
        produitId: 'p2',
        nom: 'Pelote Coton (Terracotta chaud)',
        couleur: '#C1683E',
        couleurDescription: 'Terracotta chaud',
        prixBase: 2000,
        tauxTVA: 0,
        stockDisponible: 10,
      );
      expect(PrinterService.cleanItemTitle(itemDesc), 'Pelote Coton');

      final itemNomHex = CartItem(
        produitId: 'p3',
        nom: 'Top Dentelle (#FF0000)',
        prixBase: 5000,
        tauxTVA: 0,
        stockDisponible: 5,
      );
      expect(PrinterService.cleanItemTitle(itemNomHex), 'Top Dentelle');

      final itemNomCouleur = CartItem(
        produitId: 'p4',
        nom: 'Pelote Laine Velours (Bleu Canard)',
        prixBase: 3000,
        tauxTVA: 0,
        stockDisponible: 5,
      );
      expect(PrinterService.cleanItemTitle(itemNomCouleur), 'Pelote Laine Velours');
    });
  });
}
