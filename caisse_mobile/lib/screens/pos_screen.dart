import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/product.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/catalog_provider.dart';
import '../services/scanner_service.dart';
import '../services/feedback_service.dart';
import '../widgets/universal_scanner_listener.dart';
import '../widgets/product_card.dart';
import '../widgets/cart_tile.dart';
import 'variant_selection_dialog.dart';
import 'client_search_modal.dart';
import 'checkout_dialog.dart';
import 'settings_screen.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchCtrl = TextEditingController();
  StreamSubscription<String>? _scanSubscription;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);

    // Charger le catalogue au démarrage
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CatalogProvider>().loadCatalog();
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
    );
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
              const Icon(Icons.storefront, color: AppTheme.primaryColor),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Caisse POS', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  Text(
                    auth.user?.nomComplet ?? 'The Fairy Crocheter',
                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                  ),
                ],
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
                        Icon(Icons.grid_view, size: 18),
                        SizedBox(width: 6),
                        Text('Catalogue / Scan', style: TextStyle(fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  Tab(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shopping_bag_outlined, size: 18),
                        const SizedBox(width: 6),
                        Text('Panier (${cart.totalArticles})', style: const TextStyle(fontWeight: FontWeight.w700)),
                        if (cart.items.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryColor,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              AppConstants.formatCurrency(cart.total),
                              style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
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
          ],
        ),
        bottomNavigationBar: _tabController.index == 0 && cart.items.isNotEmpty
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, -2)),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${cart.totalArticles} article${cart.totalArticles > 1 ? 's' : ''}',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                          ),
                          Text(
                            AppConstants.formatCurrency(cart.total),
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.primaryColor),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondaryColor,
                        minimumSize: const Size(160, 48),
                      ),
                      onPressed: () {
                        _tabController.animateTo(1);
                      },
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Voir le panier'),
                    ),
                  ],
                ),
              )
            : null,
      ),
    );
  }

  // ─── ONGLET CATALOGUE ────────────────────────────────────────────────────────
  Widget _buildCatalogTab(CatalogProvider catalog) {
    return Column(
      children: [
        // Barre de recherche et bouton caméra
        Padding(
          padding: const EdgeInsets.all(12.0),
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
                message: 'Scanner matériel prêt. Appuyez sur la touche scan physique.',
                child: Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                    color: AppTheme.secondaryLight,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.secondaryColor.withValues(alpha: 0.3)),
                  ),
                  child: const Icon(Icons.barcode_reader, color: AppTheme.secondaryColor),
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
                          childAspectRatio: 0.88,
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

  Widget _buildCategoryPill(String label, bool isSelected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 6.0),
      child: FilterChip(
        selected: isSelected,
        label: Text(label),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          color: isSelected ? Colors.white : AppTheme.textPrimary,
        ),
        backgroundColor: Colors.white,
        selectedColor: AppTheme.primaryColor,
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
}
