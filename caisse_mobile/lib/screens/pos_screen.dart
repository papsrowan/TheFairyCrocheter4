import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/product.dart';
import '../models/sale.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/sales_history_provider.dart';
import '../providers/terminal_settings_provider.dart';
import '../services/scanner_service.dart';
import '../services/printer_service.dart';
import '../services/feedback_service.dart';
import '../widgets/universal_scanner_listener.dart';
import '../widgets/product_card.dart';
import '../widgets/cart_tile.dart';
import 'variant_selection_dialog.dart';
import 'client_search_modal.dart';
import 'checkout_dialog.dart';
import 'sale_detail_modal.dart';
import 'settings_screen.dart';
import '../widgets/cash_drawer_pin_dialog.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _salesSearchCtrl = TextEditingController();
  StreamSubscription<String>? _scanSubscription;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);

    // Charger le catalogue et l'historique des ventes au démarrage
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CatalogProvider>().loadCatalog();
      context.read<SalesHistoryProvider>().loadSales();
    });

    // Écouter les événements du scanner Broadcast Intent natif
    final scannerService = context.read<ScannerService>();
    _scanSubscription = scannerService.onBarcodeScanned.listen((barcode) {
      _handleBarcode(barcode);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchCtrl.dispose();
    _salesSearchCtrl.dispose();
    _scanSubscription?.cancel();
    super.dispose();
  }

  // Traitement centralisé d'un code-barres (qu'il vienne du clavier physique, broadcast, ou caméra)
  Future<void> _handleBarcode(String barcode) async {
    final catalog = context.read<CatalogProvider>();
    final cart = context.read<CartProvider>();

    final product = await catalog.findByBarcode(barcode);
    if (product == null) {
      FeedbackService.scanError();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Produit non trouvé pour le code : $barcode'),
            backgroundColor: AppTheme.errorColor,
            duration: const Duration(seconds: 2),
          ),
        );
      }
      return;
    }

    // Si le produit a des variantes de couleur, ouvrir le dialogue de sélection
    if (product.hasVariantes) {
      // Vérifier si le code-barres scanné correspond spécifiquement à une variante
      final matchingVar = product.variantes.where((v) => v.codeBarres == barcode).toList();
      if (matchingVar.isNotEmpty) {
        cart.addItem(product, variante: matchingVar.first);
        _notifyItemAdded('${product.nom} (${matchingVar.first.couleur})');
      } else {
        _showVariantDialog(product);
      }
    } else {
      final ok = cart.addItem(product);
      if (ok) {
        _notifyItemAdded(product.nom);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Stock insuffisant pour ${product.nom}'),
              backgroundColor: AppTheme.errorColor,
            ),
          );
        }
      }
    }
  }

  void _notifyItemAdded(String name) {
    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text('Ajouté : $name', maxLines: 1, overflow: TextOverflow.ellipsis)),
            ],
          ),
          backgroundColor: AppTheme.secondaryColor,
          duration: const Duration(milliseconds: 1200),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showVariantDialog(Product product) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => VariantSelectionDialog(
        product: product,
        onConfirm: (selections) {
          final cart = context.read<CartProvider>();
          for (final entry in selections.entries) {
            cart.addItem(product, variante: entry.key, quantity: entry.value);
          }
        },
      ),
    );
  }

  void _openClientModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ClientSearchModal(),
    );
  }

  void _showManualBarcodeDialog() {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.barcode_reader, color: AppTheme.primaryColor),
            SizedBox(width: 8),
            Text('Scanner Matériel', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Pour scanner automatiquement :\n• Visez le code-barres ou QR code\n• Appuyez sur le bouton physique du terminal.\n\nOu saisissez le code manuellement ci-dessous :',
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              autofocus: true,
              keyboardType: TextInputType.text,
              decoration: const InputDecoration(
                labelText: 'Code-barres du produit',
                prefixIcon: Icon(Icons.qr_code),
              ),
              onSubmitted: (code) {
                if (code.trim().isNotEmpty) {
                  Navigator.pop(ctx);
                  _handleBarcode(code.trim());
                }
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Fermer'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(minimumSize: const Size(100, 40)),
            onPressed: () {
              final code = ctrl.text.trim();
              if (code.isNotEmpty) {
                Navigator.pop(ctx);
                _handleBarcode(code);
              }
            },
            child: const Text('Valider'),
          ),
        ],
      ),
    );
  }

  void _openCheckoutDialog() {
    final cart = context.read<CartProvider>();
    final auth = context.read<AuthProvider>();
    if (cart.items.isEmpty) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CheckoutDialog(
        caissierNom: auth.user?.nomComplet ?? 'Caissier',
      ),
    ).then((_) {
      if (mounted) {
        // Rafraîchir l'historique des ventes après encaissement
        context.read<SalesHistoryProvider>().loadSales(force: true);
      }
    });
  }

  void _openSaleDetailModal(VenteItem sale) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SaleDetailModal(sale: sale),
    );
  }

  Future<void> _printQuickReceipt(VenteItem sale, AuthProvider auth, TerminalSettingsProvider settings) async {
    final receiptData = sale.toReceiptData(auth.user?.nomComplet ?? 'Caisse');
    try {
      final ok = await PrinterService.printReceiptSmart(receiptData, mode: settings.printerMode);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(ok ? Icons.check_circle : Icons.warning_amber, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(ok ? 'Reçu ${sale.numero} imprimé avec succès !' : 'Erreur impression thermique'),
              ],
            ),
            backgroundColor: ok ? AppTheme.secondaryColor : AppTheme.errorColor,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final auth = context.watch<AuthProvider>();
    final catalog = context.watch<CatalogProvider>();

    return UniversalScannerListener(
      onBarcodeScanned: (code) => _handleBarcode(code),
      child: Scaffold(
        appBar: AppBar(
          titleSpacing: 12,
          title: Row(
            children: [
              Image.asset(
                'assets/icon/app_icon.png',
                width: 28,
                height: 28,
                errorBuilder: (_, _, _) => const Icon(
                  Icons.shopping_bag,
                  color: AppTheme.primaryColor,
                  size: 24,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'The Fairy Crocheter',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      auth.user != null ? '${auth.user!.nomComplet} (Caisse)' : 'Caisse',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            // Bouton Client
            TextButton.icon(
              onPressed: _openClientModal,
              icon: Icon(
                cart.client != null ? Icons.person : Icons.person_add_alt,
                size: 18,
                color: cart.client != null ? AppTheme.primaryColor : AppTheme.textSecondary,
              ),
              label: Text(
                cart.client != null ? cart.client!.nomComplet : 'Client',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: cart.client != null ? AppTheme.primaryColor : AppTheme.textSecondary,
                ),
                maxLines: 1,
              ),
            ),

            // Bouton Tiroir-Caisse sécurisé par code PIN (RJ12)
            IconButton(
              tooltip: 'Ouvrir tiroir-caisse (Sécurisé)',
              icon: const Icon(Icons.point_of_sale_outlined),
              onPressed: () => CashDrawerPinDialog.verifyAndOpen(context),
            ),

            // Paramètres
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SettingsScreen()),
                );
              },
            ),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(48),
            child: Container(
              color: Colors.white,
              child: TabBar(
                controller: _tabController,
                indicatorColor: AppTheme.primaryColor,
                labelColor: AppTheme.primaryColor,
                unselectedLabelColor: AppTheme.textSecondary,
                tabs: [
                  const Tab(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.grid_view, size: 16),
                        SizedBox(width: 4),
                        Text('Catalogue', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  Tab(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shopping_bag_outlined, size: 16),
                        const SizedBox(width: 4),
                        Text('Panier (${cart.totalArticles})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  const Tab(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.receipt_long, size: 16),
                        SizedBox(width: 4),
                        Text('Ventes', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: [
            // ONGLET 1 : CATALOGUE & SCAN
            _buildCatalogTab(catalog),

            // ONGLET 2 : PANIER & TOTAL
            _buildCartTab(cart),

            // ONGLET 3 : HISTORIQUE DES VENTES & RÉIMPRESSION
            _buildSalesTab(),
          ],
        ),
      ),
    );
  }

  // ─── ONGLET CATALOGUE & SCAN ────────────────────────────────────────────────
  Widget _buildCatalogTab(CatalogProvider catalog) {
    return Column(
      children: [
        // Barre de recherche et statut scanner
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (q) => catalog.setSearchQuery(q),
                  decoration: InputDecoration(
                    hintText: 'Rechercher un produit...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              catalog.setSearchQuery('');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Tooltip(
                message: 'Scanner matériel prêt. Touche physique du terminal ou appuyez pour saisir.',
                child: Material(
                  color: AppTheme.secondaryLight,
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: _showManualBarcodeDialog,
                    child: Container(
                      height: 48,
                      width: 48,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppTheme.secondaryColor.withValues(alpha: 0.3)),
                      ),
                      child: const Icon(Icons.barcode_reader, color: AppTheme.secondaryColor),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Filtre des catégories
        if (catalog.categories.isNotEmpty)
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _buildCategoryPill('Tous', catalog.selectedCategory == null, () {
                  catalog.selectCategory(null);
                }),
                ...catalog.categories.map((cat) {
                  return _buildCategoryPill(cat, catalog.selectedCategory == cat, () {
                    catalog.selectCategory(cat);
                  });
                }),
              ],
            ),
          ),

        const SizedBox(height: 8),

        // Grille de produits
        Expanded(
          child: catalog.isLoading
              ? const Center(child: CircularProgressIndicator())
              : catalog.filteredProducts.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            catalog.errorMessage != null ? Icons.cloud_off : Icons.inventory_2_outlined,
                            size: 48,
                            color: catalog.errorMessage != null ? AppTheme.errorColor : AppTheme.textSecondary,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            catalog.errorMessage != null ? 'Erreur de connexion au catalogue' : 'Aucun produit trouvé',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                          if (catalog.errorMessage != null) ...[
                            const SizedBox(height: 6),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: Text(
                                catalog.errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size(180, 42),
                            ),
                            onPressed: () => catalog.loadCatalog(force: true),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Actualiser le catalogue'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () => catalog.loadCatalog(force: true),
                      child: GridView.builder(
                        padding: const EdgeInsets.all(12),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.72,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                        ),
                        itemCount: catalog.filteredProducts.length,
                        itemBuilder: (context, index) {
                          final p = catalog.filteredProducts[index];
                          return ProductCard(
                            product: p,
                            onTap: () {
                              if (p.hasVariantes) {
                                _showVariantDialog(p);
                              } else {
                                final ok = context.read<CartProvider>().addItem(p);
                                if (ok) _notifyItemAdded(p.nom);
                              }
                            },
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildCategoryPill(String title, bool isSelected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(title),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? Colors.white : AppTheme.textPrimary,
        ),
        selected: isSelected,
        selectedColor: AppTheme.primaryColor,
        backgroundColor: Colors.white,
        side: BorderSide(color: isSelected ? AppTheme.primaryColor : AppTheme.borderColor),
        onSelected: (_) => onTap(),
      ),
    );
  }

  // ─── ONGLET PANIER ───────────────────────────────────────────────────────────
  Widget _buildCartTab(CartProvider cart) {
    if (cart.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.remove_shopping_cart_outlined, size: 64, color: AppTheme.textSecondary),
            const SizedBox(height: 12),
            const Text('Votre panier est vide', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            const Text('Scannez un article ou choisissez dans le catalogue', style: TextStyle(color: AppTheme.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => _tabController.animateTo(0),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter des articles'),
              style: ElevatedButton.styleFrom(minimumSize: const Size(200, 46)),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Liste des articles
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: cart.items.length,
            itemBuilder: (context, index) {
              final item = cart.items[index];
              return CartTile(
                item: item,
                onIncrement: () => cart.updateQuantity(item.cartKey, 1),
                onDecrement: () => cart.updateQuantity(item.cartKey, -1),
                onDelete: () => cart.removeItem(item.cartKey),
                onDiscount: (d) => cart.setLineDiscount(item.cartKey, d),
              );
            },
          ),
        ),

        // Résumé financier et encaissement
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, -3)),
            ],
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Ligne Sous-total
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Sous-total :', style: TextStyle(color: AppTheme.textSecondary)),
                  Text(AppConstants.formatCurrency(cart.sousTotal), style: const TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),

              if (cart.totalRemises > 0) ...[
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Remises accordées :', style: TextStyle(color: AppTheme.secondaryColor)),
                    Text('-${AppConstants.formatCurrency(cart.totalRemises)}', style: const TextStyle(color: AppTheme.secondaryColor, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],

              if (cart.showPrixSpecial && cart.prixSpecial != null) ...[
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Prix spécial négocié :', style: TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.bold)),
                    Text(AppConstants.formatCurrency(cart.prixSpecial!), style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],

              if (cart.payerPlusTard) ...[
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(cart.paiementPartiel ? 'Acompte immédiat :' : 'Modalité :', style: const TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w700)),
                    Text(
                      cart.paiementPartiel
                          ? AppConstants.formatCurrency(cart.montantAEncaisser)
                          : 'Vente à crédit',
                      style: const TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],

              const Divider(height: 16),

              // Total Général
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('TOTAL À PAYER', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  Text(
                    AppConstants.formatCurrency(cart.total),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.primaryColor),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // Boutons d'action
              Row(
                children: [
                  IconButton.outlined(
                    onPressed: () => cart.clearCart(),
                    icon: const Icon(Icons.delete_sweep, color: AppTheme.errorColor),
                    tooltip: 'Vider le panier',
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondaryColor,
                        minimumSize: const Size(double.infinity, 52),
                      ),
                      onPressed: _openCheckoutDialog,
                      icon: const Icon(Icons.point_of_sale),
                      label: Text(
                        'Encaisser • ${AppConstants.formatCurrency(cart.total)}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── ONGLET 3 : HISTORIQUE DES VENTES & RÉIMPRESSION ─────────────────────────
  Widget _buildSalesTab() {
    final salesProvider = context.watch<SalesHistoryProvider>();
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<TerminalSettingsProvider>();

    return Column(
      children: [
        // Barre de recherche des ventes
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          color: Colors.white,
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _salesSearchCtrl,
                  onChanged: (q) => salesProvider.setSearchQuery(q),
                  onSubmitted: (q) => salesProvider.searchOnServer(q),
                  decoration: InputDecoration(
                    hintText: 'Rechercher N° vente, client, mode...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _salesSearchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _salesSearchCtrl.clear();
                              salesProvider.setSearchQuery('');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                icon: const Icon(Icons.refresh, size: 20),
                tooltip: 'Actualiser les ventes',
                onPressed: () => salesProvider.loadSales(force: true),
              ),
            ],
          ),
        ),

        const Divider(height: 1),

        // Liste des ventes avec pull-to-refresh
        Expanded(
          child: salesProvider.isLoading && salesProvider.sales.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : salesProvider.errorMessage != null && salesProvider.sales.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.cloud_off, size: 48, color: AppTheme.errorColor),
                          const SizedBox(height: 12),
                          const Text(
                            'Erreur lors du chargement des ventes',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          const SizedBox(height: 6),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: Text(
                              salesProvider.errorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: () => salesProvider.loadSales(force: true),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Réessayer'),
                          ),
                        ],
                      ),
                    )
                  : salesProvider.filteredSales.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.receipt_long_outlined, size: 54, color: AppTheme.textSecondary),
                              const SizedBox(height: 12),
                              const Text('Aucune vente trouvée', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 6),
                              const Text('Les ventes enregistrées apparaîtront ici.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: () => salesProvider.loadSales(force: true),
                                icon: const Icon(Icons.refresh, size: 16),
                                label: const Text('Actualiser'),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: () => salesProvider.loadSales(force: true),
                          child: ListView.builder(
                            padding: const EdgeInsets.all(12),
                            itemCount: salesProvider.filteredSales.length,
                            itemBuilder: (context, index) {
                              final sale = salesProvider.filteredSales[index];
                              return _buildSaleCard(sale, auth, settings);
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _buildSaleCard(VenteItem sale, AuthProvider auth, TerminalSettingsProvider settings) {
    return Card(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.borderColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Ligne 1 : Numéro de vente, Date et Statut
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.receipt, size: 16, color: AppTheme.primaryColor),
                    const SizedBox(width: 6),
                    Text(
                      sale.numero,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ],
                ),
                _buildSaleStatusChip(sale),
              ],
            ),

            const SizedBox(height: 4),

            // Ligne 2 : Date & Heure
            Text(
              DateFormat('dd/MM/yyyy à HH:mm').format(sale.dateFacture ?? sale.createdAt),
              style: const TextStyle(fontSize: 11.5, color: AppTheme.textSecondary),
            ),

            const SizedBox(height: 6),
            const Divider(height: 1, color: AppTheme.borderColor),
            const SizedBox(height: 8),

            // Ligne 3 : Client & Mode de paiement
            Row(
              children: [
                Icon(
                  sale.clientNom != null ? Icons.person : Icons.person_outline,
                  size: 14,
                  color: AppTheme.textSecondary,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    sale.clientNom ?? 'Client de passage',
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                _buildPaymentModeChip(sale.modePaiement),
              ],
            ),

            const SizedBox(height: 6),

            // Ligne 4 : Articles & Total
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${sale.lignes.length} article${sale.lignes.length > 1 ? 's' : ''}',
                      style: const TextStyle(fontSize: 11.5, color: AppTheme.textSecondary),
                    ),
                    if (sale.isCredit && sale.resteDu > 0)
                      Text(
                        'Reste dû : ${AppConstants.formatCurrency(sale.resteDu)}',
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFFB91C1C)),
                      ),
                  ],
                ),
                Text(
                  AppConstants.formatCurrency(sale.total),
                  style: const TextStyle(
                    fontSize: 16.5,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primaryDark,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // Ligne 5 : Boutons Détails et Impression
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      visualDensity: VisualDensity.compact,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _openSaleDetailModal(sale),
                    icon: const Icon(Icons.visibility_outlined, size: 16),
                    label: const Text('Détails', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      visualDensity: VisualDensity.compact,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _printQuickReceipt(sale, auth, settings),
                    icon: const Icon(Icons.print, size: 16),
                    label: const Text('Imprimer reçu', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSaleStatusChip(VenteItem sale) {
    Color bg;
    Color fg;
    String label;

    if (sale.isAnnulee) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFF991B1B);
      label = 'Annulée';
    } else if (sale.isCredit) {
      bg = const Color(0xFFEFF6FF);
      fg = const Color(0xFF1D4ED8);
      label = sale.statutPaiement == 'PAYE' ? 'Crédit soldé' : 'À crédit';
    } else {
      bg = const Color(0xFFD1FAE5);
      fg = const Color(0xFF065F46);
      label = 'Payé';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: fg),
      ),
    );
  }

  Widget _buildPaymentModeChip(String mode) {
    Color bg;
    Color fg;
    String label;

    switch (mode) {
      case 'ESPECES':
        bg = const Color(0xFFF0FDF4);
        fg = const Color(0xFF15803D);
        label = 'Espèces';
        break;
      case 'CARTE':
        bg = const Color(0xFFFAF5FF);
        fg = const Color(0xFF7E22CE);
        label = 'Carte';
        break;
      case 'VIREMENT':
        bg = const Color(0xFFEFF6FF);
        fg = const Color(0xFF2563EB);
        label = 'Virement';
        break;
      case 'CREDIT':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFB45309);
        label = 'Crédit';
        break;
      default:
        bg = AppTheme.backgroundColor;
        fg = AppTheme.textPrimary;
        label = mode;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }
}
