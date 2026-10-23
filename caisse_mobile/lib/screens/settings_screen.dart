import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/terminal_settings_provider.dart';
import '../services/api_service.dart';
import '../services/printer_service.dart';
import '../services/feedback_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _urlCtrl = TextEditingController();
  final TextEditingController _intentCtrl = TextEditingController();
  bool _isTestingPrint = false;

  @override
  void initState() {
    super.initState();
    final settings = context.read<TerminalSettingsProvider>();
    _urlCtrl.text = settings.baseUrl;
    _intentCtrl.text = settings.customIntentAction;
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final settings = context.watch<TerminalSettingsProvider>();
    final apiService = context.read<ApiService>();

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
                  ElevatedButton(
                    onPressed: () async {
                      await settings.setBaseUrl(_urlCtrl.text);
                      apiService.updateBaseUrl();
                      FeedbackService.scanSuccess();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('URL du serveur mise à jour !')),
                        );
                      }
                    },
                    child: const Text('Enregistrer l\'URL'),
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
                  SwitchListTile(
                    title: const Text('Impression automatique', style: TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: const Text('Lancer l\'impression dès validation de la vente'),
                    value: settings.autoPrint,
                    activeThumbColor: AppTheme.primaryColor,
                    contentPadding: EdgeInsets.zero,
                    onChanged: (val) => settings.setAutoPrint(val),
                  ),
                  const Divider(),
                  const SizedBox(height: 6),
                  OutlinedButton.icon(
                    onPressed: _isTestingPrint ? null : _testPrint,
                    icon: _isTestingPrint
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.print),
                    label: const Text('Imprimer un ticket de test'),
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
                  OutlinedButton(
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
                ],
              ),
            ),
          ),

          const SizedBox(height: 18),

          // Section File d'attente Hors-Ligne
          _buildSectionHeader('Mode Hors-Ligne & Synchronisation'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Ventes en attente de sync :', style: TextStyle(fontWeight: FontWeight.w600)),
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
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.secondaryColor,
                    ),
                    onPressed: settings.offlineQueueCount == 0 || settings.isSyncing
                        ? null
                        : () async {
                            final ok = await settings.syncOfflineQueue(apiService);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(ok
                                      ? 'Synchronisation réussie !'
                                      : 'Échec de synchronisation. Vérifiez la connexion.'),
                                ),
                              );
                            }
                          },
                    icon: settings.isSyncing
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.sync),
                    label: Text(settings.isSyncing ? 'Synchronisation...' : 'Synchroniser les ventes'),
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
              child: ListTile(
                leading: const CircleAvatar(
                  backgroundColor: AppTheme.primaryLight,
                  child: Icon(Icons.person, color: AppTheme.primaryColor),
                ),
                title: Text(auth.user!.nomComplet, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('${auth.user!.email} • Rôle : ${auth.user!.role}'),
                trailing: IconButton(
                  icon: const Icon(Icons.logout, color: AppTheme.errorColor),
                  onPressed: () async {
                    await auth.logout();
                    if (context.mounted) {
                      Navigator.pop(context);
                    }
                  },
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
}
