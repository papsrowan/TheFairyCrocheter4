import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/client.dart';
import '../services/api_service.dart';
import '../providers/cart_provider.dart';

class ClientSearchModal extends StatefulWidget {
  const ClientSearchModal({super.key});

  @override
  State<ClientSearchModal> createState() => _ClientSearchModalState();
}

class _ClientSearchModalState extends State<ClientSearchModal> {
  final TextEditingController _searchCtrl = TextEditingController();
  List<Client> _clients = [];
  bool _isLoading = false;
  bool _showCreateForm = false;

  // Formulaire création
  final _formKey = GlobalKey<FormState>();
  String _nom = '';
  String _prenom = '';
  String _telephone = '';
  String _email = '';
  bool _isCreating = false;
  String? _createError;

  void _onSearchChanged(String val) async {
    if (val.trim().length < 2) {
      setState(() => _clients = []);
      return;
    }

    setState(() => _isLoading = true);
    final apiService = context.read<ApiService>();
    try {
      final res = await apiService.searchClients(val.trim());
      if (mounted) {
        setState(() {
          _clients = res;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleCreateClient() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    setState(() {
      _isCreating = true;
      _createError = null;
    });

    final apiService = context.read<ApiService>();
    try {
      final newClient = await apiService.createClient(
        nom: _nom,
        prenom: _prenom.isNotEmpty ? _prenom : null,
        telephone: _telephone.isNotEmpty ? _telephone : null,
        email: _email.isNotEmpty ? _email : null,
      );

      if (mounted) {
        context.read<CartProvider>().setClient(newClient);
        Navigator.pop(context);
      }
    } catch (e) {
      setState(() {
        _isCreating = false;
        _createError = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cartProvider = context.watch<CartProvider>();

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Titre
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _showCreateForm ? 'Nouveau Client' : 'Associer un Client',
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Si un client est déjà associé
          if (cartProvider.client != null && !_showCreateForm) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.secondaryLight,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.secondaryColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person, color: AppTheme.secondaryColor),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cartProvider.client!.nomComplet,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        ),
                        if (cartProvider.client!.telephone != null)
                          Text(
                            cartProvider.client!.telephone!,
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                          ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      cartProvider.clearClient();
                    },
                    child: const Text('Dissocier', style: TextStyle(color: AppTheme.errorColor)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          if (!_showCreateForm) ...[
            // Barre de recherche client
            TextField(
              controller: _searchCtrl,
              autofocus: true,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Rechercher par nom ou téléphone...',
                prefixIcon: const Icon(Icons.search, color: AppTheme.primaryColor),
                suffixIcon: _isLoading
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : null,
              ),
            ),

            const SizedBox(height: 12),

            // Résultats de recherche
            if (_clients.isNotEmpty)
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _clients.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final c = _clients[index];
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(Icons.person_outline, color: AppTheme.primaryColor, size: 20),
                      ),
                      title: Text(c.nomComplet, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: c.telephone != null ? Text(c.telephone!) : null,
                      trailing: Text(
                        AppConstants.formatCurrency(c.totalAchats),
                        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                      onTap: () {
                        cartProvider.setClient(c);
                        Navigator.pop(context);
                      },
                    );
                  },
                ),
              )
            else if (_searchCtrl.text.length >= 2 && !_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text(
                    'Aucun client trouvé',
                    style: TextStyle(color: AppTheme.textSecondary),
                  ),
                ),
              ),

            const SizedBox(height: 12),

            // Bouton pour basculer vers création client
            OutlinedButton.icon(
              onPressed: () => setState(() => _showCreateForm = true),
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Créer un nouveau client'),
            ),
          ] else ...[
            // Formulaire de création rapide
            if (_createError != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _createError!,
                  style: const TextStyle(color: AppTheme.errorColor, fontSize: 13),
                ),
              ),
              const SizedBox(height: 10),
            ],

            Form(
              key: _formKey,
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    TextFormField(
                      decoration: const InputDecoration(labelText: 'Nom *'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Le nom est requis' : null,
                      onSaved: (v) => _nom = v?.trim() ?? '',
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      decoration: const InputDecoration(labelText: 'Prénom'),
                      onSaved: (v) => _prenom = v?.trim() ?? '',
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Téléphone'),
                      onSaved: (v) => _telephone = v?.trim() ?? '',
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email (optionnel)'),
                      onSaved: (v) => _email = v?.trim() ?? '',
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => setState(() => _showCreateForm = false),
                            child: const Text('Retour'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton(
                            onPressed: _isCreating ? null : _handleCreateClient,
                            child: _isCreating
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Text('Créer & Associer'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
