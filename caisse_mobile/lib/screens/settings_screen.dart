import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/terminal_settings_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/sales_history_provider.dart';
import '../services/api_service.dart';
import '../services/connectivity_sync_service.dart';
import '../services/printer_service.dart';
import '../services/feedback_service.dart';
import '../widgets/cash_drawer_pin_dialog.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _urlCtrl = TextEditingController();
  final TextEditingController _intentCtrl = TextEditingController();
  bool _isTestingPrint = false;
  bool _isCachingCatalog = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final settings = context.read<TerminalSettingsProvider>();
        _urlCtrl.text = settings.baseUrl;
        _intentCtrl.text = settings.customIntentAction;
      }
    });
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _intentCtrl.dispose();
    super.dispose();
  }

  Future<void> _testPrint() async {
    setState(() => _isTestingPrint = true);
    final testReceipt = ReceiptData(
      numeroVente: 'TEST-0001',
      date: DateTime.now(),
      caissierNom: 'Test Terminal',
      clientNom: 'Client Test',
      items: [],
      sousTotal: 1000,
      remiseGlobale: 0,
      total: 1000,
      modePaiement: 'ESPECES',
    );
    await PrinterService.printReceiptNative(testReceipt);
    if (mounted) setState(() => _isTestingPrint = false);
  }

  Future<void> _testPrintHardware() async {
    setState(() => _isTestingPrint = true);
    final testReceipt = ReceiptData(
      numeroVente: 'TEST-ESC-01',
      date: DateTime.now(),
      caissierNom: 'Test Direct',
      clientNom: 'Client Test',
      items: [],
      sousTotal: 1000,
      remiseGlobale: 0,
      total: 1000,
      modePaiement: 'ESPECES',
    );
    final ok = await PrinterService.printReceiptDirectHardware(testReceipt);
    if (mounted) {
      setState(() => _isTestingPrint = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ok ? 'Impression matérielle directe envoyée !' : 'Commande matérielle envoyée (Vérifiez le rouleau).'),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<TerminalSettingsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Paramètres du Terminal'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Section Serveur
          _buildSectionHeader('Connexion Serveur'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _urlCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Adresse du serveur (URL)',
                      hintText: 'https://thefairycrocheter.fr',
                      prefixIcon: Icon(Icons.cloud_outlined),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        await settings.setBaseUrl(_urlCtrl.text);
                        if (context.mounted) {
                          context.read<ApiService>().updateBaseUrl();
                        }
                        FeedbackService.scanSuccess();
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('URL du serveur mise à jour !')),
                          );
                        }
                      },
                      child: const Text('Enregistrer l\'URL'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 18),

          // Section Imprimante Thermique
          _buildSectionHeader('Imprimante Thermique (58 mm)'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Impression automatique', style: TextStyle(fontWeight: FontWeight.w700)),
                            SizedBox(height: 2),
                            Text(
                              'Lancer l\'impression dès validation de la vente',
                              style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: settings.autoPrint,
                        activeThumbColor: AppTheme.primaryColor,
                        onChanged: (val) => settings.setAutoPrint(val),
                      ),
                    ],
                  ),
                  const Divider(),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: _isTestingPrint ? null : _testPrint,
                        icon: _isTestingPrint
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.print),
                        label: const Text('Test Système (Spooler Android)'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _isTestingPrint ? null : _testPrintHardware,
                        icon: const Icon(Icons.flash_on, color: AppTheme.primaryColor),
                        label: const Text('Test Matériel Direct (ESC/POS)'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 18),

          // Section Tiroir-Caisse (RJ12)
          _buildSectionHeader('Tiroir-Caisse (Câble RJ12)'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Ouverture auto
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Ouverture automatique de la caisse', style: TextStyle(fontWeight: FontWeight.w700)),
                            SizedBox(height: 2),
                            Text(
                              'Déclencher l\'ouverture du tiroir automatiquement à chaque encaissement',
                              style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: settings.autoOpenDrawer,
                        activeThumbColor: AppTheme.primaryColor,
                        onChanged: (val) => settings.setAutoOpenDrawer(val),
                      ),
                    ],
                  ),
                  const Divider(),
                  // Code PIN requis
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Code PIN de sécurité', style: TextStyle(fontWeight: FontWeight.w700)),
                            SizedBox(height: 2),
                            Text(
                              'Exiger le code PIN pour toute ouverture manuelle hors vente',
                              style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: settings.requireDrawerPin,
                        activeThumbColor: AppTheme.primaryColor,
                        onChanged: (val) => settings.setRequireDrawerPin(val),
                      ),
                    ],
                  ),
                  const Divider(),
                  // Modifier le code PIN
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Icon(Icons.pin_outlined, color: AppTheme.primaryColor),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Code matériel de la caisse', style: TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 2),
                              Text(
                                'Code fabricant : ${settings.cashDrawerPin}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () => _showChangePinDialog(context, settings),
                          child: const Text('Modifier'),
                        ),
                      ],
                    ),
                  ),
                  const Divider(),
                  const SizedBox(height: 6),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => CashDrawerPinDialog.verifyAndOpen(context),
                      icon: const Icon(Icons.point_of_sale),
                      label: const Text('Tester l\'ouverture sécurisée du tiroir-caisse'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 18),

          // Section Scanner Matériel
          _buildSectionHeader('Scanner Code-Barres Matériel'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Émulation Clavier (Keyboard Wedge) :',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Activée automatiquement. Si votre terminal (Pax, iMin, Newland, Telpo) envoie les codes scannés comme des frappes clavier, ils sont interceptés instantanément.',
                    style: TextStyle(fontSize: 12.5, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  const Text(
                    'Broadcast Intent propriétaire (optionnel) :',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _intentCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Action Broadcast Intent',
                      hintText: 'ex: nlscan.action.SCANNER_RESULT',
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () async {
                        await settings.setCustomIntentAction(_intentCtrl.text);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Action Intent configurée !')),
                          );
                        }
                      },
                      child: const Text('Appliquer l\'action Intent'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 18),

          // Section File d'attente Hors-Ligne
          // Section Mode Hors-Ligne & Synchronisation
          _buildSectionHeader('Mode Hors-Ligne & Cache Local'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text(
                      'Activer le mode hors-ligne',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: const Text(
                      'Consulter le catalogue, encaisser et imprimer même sans Internet. Les ventes sont automatiquement synchronisées dès le retour du réseau.',
                      style: TextStyle(fontSize: 12.5, color: AppTheme.textSecondary),
                    ),
                    value: settings.offlineModeEnabled,
                    onChanged: (val) async {
                      await settings.setOfflineModeEnabled(val);
                      if (val && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Mode hors-ligne activé. Pensez à mettre en cache votre catalogue.'),
                            duration: Duration(seconds: 3),
                          ),
                        );
                      }
                    },
                  ),
                  const Divider(height: 20),

                  // État du cache Catalogue
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Catalogue en cache local :', style: TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          Text(
                            settings.lastProductsCacheDate != null
                                ? 'Mis à jour le ${DateFormat('dd/MM/yyyy HH:mm', 'fr_FR').format(settings.lastProductsCacheDate!)}'
                                : 'Aucun produit en cache',
                            style: const TextStyle(fontSize: 11.5, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: settings.cachedProductsCount > 0 ? AppTheme.secondaryLight : AppTheme.backgroundColor,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Text(
                          '${settings.cachedProductsCount} art.',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: settings.cachedProductsCount > 0 ? AppTheme.secondaryColor : AppTheme.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Bouton télécharger/rafraîchir catalogue
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _isCachingCatalog
                          ? null
                          : () async {
                              setState(() => _isCachingCatalog = true);
                              try {
                                final catalog = context.read<CatalogProvider>();
                                await catalog.loadCatalog(force: true);
                                await settings.cacheCatalog(catalog.products);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('${catalog.products.length} produits mis en cache avec succès !'),
                                      backgroundColor: AppTheme.secondaryColor,
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Erreur lors de la mise en cache : $e'),
                                      backgroundColor: AppTheme.errorColor,
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted) setState(() => _isCachingCatalog = false);
                              }
                            },
                      icon: _isCachingCatalog
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.cloud_download_outlined, size: 18),
                      label: Text(_isCachingCatalog ? 'Téléchargement...' : 'Télécharger tout le catalogue en local'),
                    ),
                  ),

                  const Divider(height: 24),

                  // Ventes en attente de synchronisation
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Ventes hors-ligne en attente :', style: TextStyle(fontWeight: FontWeight.w600)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: settings.offlineQueueCount > 0 ? AppTheme.warningColor : AppTheme.secondaryLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${settings.offlineQueueCount}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: settings.offlineQueueCount > 0 ? Colors.white : AppTheme.secondaryColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Bouton Synchroniser maintenant
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondaryColor,
                      ),
                      onPressed: settings.offlineQueueCount == 0 || settings.isSyncing
                          ? null
                          : () async {
                              final connSync = context.read<ConnectivitySyncService>();
                              final salesHistory = context.read<SalesHistoryProvider>();
                              final ok = await connSync.syncNow(
                                onSyncSuccess: () {
                                  salesHistory.loadSales(force: true);
                                  settings.refreshCounts();
                                },
                              );
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(ok
                                        ? 'Ventes synchronisées avec le serveur avec succès !'
                                        : 'Échec de la synchronisation. Vérifiez votre connexion Internet.'),
                                    backgroundColor: ok ? AppTheme.secondaryColor : AppTheme.errorColor,
                                  ),
                                );
                              }
                            },
                      icon: settings.isSyncing
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.sync),
                      label: Text(settings.isSyncing ? 'Synchronisation...' : 'Synchroniser les ventes en attente'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 18),

          // Utilisateur connecté & Déconnexion
          if (auth.user != null) ...[
            _buildSectionHeader('Session Caissier'),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    const CircleAvatar(
                      backgroundColor: AppTheme.primaryLight,
                      child: Icon(Icons.person, color: AppTheme.primaryColor),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(auth.user!.nomComplet, style: const TextStyle(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(
                            '${auth.user!.email} • Rôle : ${auth.user!.role}',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.logout, color: AppTheme.errorColor),
                      onPressed: () async {
                        await auth.logout();
                        if (context.mounted) {
                          Navigator.pop(context);
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: AppTheme.textSecondary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  void _showChangePinDialog(BuildContext context, TerminalSettingsProvider settings) {
    final pinController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.password, color: AppTheme.primaryColor),
              SizedBox(width: 8),
              Text('Modifier le Code PIN', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Définissez un code PIN à 4 ou 6 chiffres pour sécuriser l\'accès manuel au tiroir-caisse.',
                style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: pinController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                obscureText: true,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Nouveau Code PIN',
                  hintText: 'Ex: 123456',
                  prefixIcon: Icon(Icons.lock_outline),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              onPressed: () async {
                final newPin = pinController.text.trim();
                if (newPin.length < 4) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Le code PIN doit comporter au moins 4 chiffres.'),
                      backgroundColor: Colors.red,
                    ),
                  );
                  return;
                }
                await settings.setCashDrawerPin(newPin);
                if (context.mounted) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Code PIN mis à jour avec succès !'),
                      backgroundColor: AppTheme.secondaryColor,
                    ),
                  );
                }
              },
              child: const Text('Enregistrer'),
            ),
          ],
        );
      },
    );
  }
}
