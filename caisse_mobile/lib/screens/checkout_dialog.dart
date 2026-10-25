import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../providers/cart_provider.dart';
import '../providers/terminal_settings_provider.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/printer_service.dart';
import '../services/cash_drawer_service.dart';
import '../widgets/cash_drawer_pin_dialog.dart';
import '../widgets/quick_cash_pad.dart';
import 'client_search_modal.dart';
import 'sale_success_screen.dart';

class CheckoutDialog extends StatefulWidget {
  final String caissierNom;

  const CheckoutDialog({super.key, required this.caissierNom});

  @override
  State<CheckoutDialog> createState() => _CheckoutDialogState();
}

class _CheckoutDialogState extends State<CheckoutDialog> {
  String? _errorMessage;
  final TextEditingController _remiseCtrl = TextEditingController();
  final TextEditingController _prixSpecialCtrl = TextEditingController();
  final TextEditingController _motifPrixSpecialCtrl = TextEditingController();
  final TextEditingController _acompteCtrl = TextEditingController();

  bool _isAdvancedExpanded = false;

  @override
  void initState() {
    super.initState();
    final cart = context.read<CartProvider>();
    if (cart.remiseGlobale > 0) {
      _remiseCtrl.text = cart.remiseGlobale.toStringAsFixed(0);
    }
    if (cart.prixSpecial != null) {
      _prixSpecialCtrl.text = cart.prixSpecial!.toStringAsFixed(0);
    }
    if (cart.motifPrixSpecial != null) {
      _motifPrixSpecialCtrl.text = cart.motifPrixSpecial!;
    }
    if (cart.montantPaye != null) {
      _acompteCtrl.text = cart.montantPaye!.toStringAsFixed(0);
    }
  }

  @override
  void dispose() {
    _remiseCtrl.dispose();
    _prixSpecialCtrl.dispose();
    _motifPrixSpecialCtrl.dispose();
    _acompteCtrl.dispose();
    super.dispose();
  }

  void _openClientModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ClientSearchModal(),
    );
  }

  Future<void> _selectDateEcheance(BuildContext context, CartProvider cart) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: cart.dateEcheance ?? now.add(const Duration(days: 14)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      helpText: "DATE D'ÉCHÉANCE DU CRÉDIT",
      confirmText: 'SÉLECTIONNER',
      cancelText: 'ANNULER',
    );
    if (picked != null) {
      cart.setDateEcheance(picked);
    }
  }

  Future<void> _selectDateFacture(BuildContext context, CartProvider cart) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: cart.dateFacture ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now,
      helpText: 'DATE DE LA VENTE (ANTIDATAGE)',
      confirmText: 'APPLIQUER',
      cancelText: 'ANNULER',
    );
    if (picked != null) {
      cart.setDateFacture(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final settings = context.watch<TerminalSettingsProvider>();

    final totalDu = cart.total;
    final montantAEncaisser = cart.montantAEncaisser;
    final resteDu = cart.resteAPayer;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.92,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── EN-TÊTE DU DIALOGUE ───────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.point_of_sale, color: AppTheme.primaryColor),
                  SizedBox(width: 8),
                  Text(
                    'Règlement de la Vente',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close),
                visualDensity: VisualDensity.compact,
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          const SizedBox(height: 6),

          // ─── CARTE RÉSUMÉ FINANCIER & CLIENT ───────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cart.payerPlusTard
                  ? const Color(0xFFEFF6FF)
                  : AppTheme.primaryLight.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: cart.payerPlusTard
                    ? const Color(0xFF93C5FD)
                    : AppTheme.primaryColor.withValues(alpha: 0.25),
              ),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Client et articles
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          InkWell(
                            onTap: _openClientModal,
                            borderRadius: BorderRadius.circular(6),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2.0),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    cart.client != null ? Icons.person : Icons.person_add_alt,
                                    size: 16,
                                    color: cart.client != null
                                        ? AppTheme.primaryColor
                                        : AppTheme.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      cart.client != null
                                          ? cart.client!.nomComplet
                                          : 'Client de passage (Ajouter)',
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: cart.client != null
                                            ? AppTheme.primaryDark
                                            : AppTheme.textSecondary,
                                        decoration: TextDecoration.underline,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Text(
                            '${cart.totalArticles} article${cart.totalArticles > 1 ? 's' : ''}'
                            '${cart.totalRemises > 0 ? ' • Remise: -${AppConstants.formatCurrency(cart.totalRemises)}' : ''}',
                            style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    ),

                    // Montant Total
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (cart.showPrixSpecial && cart.prixSpecial != null)
                          Text(
                            AppConstants.formatCurrency(cart.totalCalcule),
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppTheme.textSecondary,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        Text(
                          AppConstants.formatCurrency(totalDu),
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: cart.payerPlusTard ? const Color(0xFF1D4ED8) : AppTheme.primaryDark,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                // Si Vente à Crédit / Paiement Partiel : afficher le détail clair
                if (cart.payerPlusTard) ...[
                  const Divider(height: 14, color: Color(0xFFBFDBFE)),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.schedule, size: 14, color: Color(0xFF2563EB)),
                          const SizedBox(width: 4),
                          Text(
                            cart.paiementPartiel
                                ? 'Acompte : ${AppConstants.formatCurrency(montantAEncaisser)}'
                                : 'Vente à Crédit (100% différé)',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E40AF),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDBEAFE),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Reste dû : ${AppConstants.formatCurrency(resteDu)}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF1E3A8A),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 10),

          // Message d'erreur s'il existe
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _errorMessage!,
                style: const TextStyle(color: AppTheme.errorColor, fontSize: 12),
              ),
            ),
            const SizedBox(height: 8),
          ],

          // ─── CORPS DÉROULANT (OPTIONS AVANCÉES & MODES DE PAIEMENT) ─────────
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─── SECTION OPTIONS AVANCÉES (ACCORDÉON) ─────────────────────
                  Container(
                    decoration: BoxDecoration(
                      color: AppTheme.backgroundColor,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.borderColor),
                    ),
                    child: ExpansionTile(
                      initiallyExpanded: _isAdvancedExpanded,
                      onExpansionChanged: (exp) => setState(() => _isAdvancedExpanded = exp),
                      tilePadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                      visualDensity: VisualDensity.compact,
                      leading: const Icon(Icons.tune, size: 18, color: AppTheme.primaryColor),
                      title: Row(
                        children: [
                          const Text(
                            'Options avancées',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(width: 8),
                          if (cart.showPrixSpecial)
                            _buildTag('Prix spécial', AppTheme.primaryColor),
                          if (cart.payerPlusTard)
                            _buildTag('Crédit', Colors.blue),
                          if (cart.remiseGlobale > 0)
                            _buildTag('Remise', Colors.green),
                        ],
                      ),
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Divider(height: 1),
                              const SizedBox(height: 10),

                              // 1. Remise globale
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  const Icon(Icons.percent, size: 16, color: AppTheme.secondaryColor),
                                  const SizedBox(width: 6),
                                  const Text(
                                    'Remise globale :',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                  const Spacer(),
                                  SizedBox(
                                    width: 100,
                                    height: 34,
                                    child: TextField(
                                      controller: _remiseCtrl,
                                      keyboardType: TextInputType.number,
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                      textAlign: TextAlign.center,
                                      decoration: InputDecoration(
                                        hintText: '0',
                                        suffixText: 'XAF',
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                                      ),
                                      onChanged: (val) {
                                        final numVal = double.tryParse(val.replaceAll(',', '.')) ?? 0.0;
                                        cart.setRemiseGlobale(numVal);
                                      },
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 6,
                                children: [
                                  _buildQuickDiscountPill(cart, 500),
                                  _buildQuickDiscountPill(cart, 1000),
                                  _buildQuickDiscountPill(cart, 2000),
                                  _buildQuickDiscountPill(cart, 5000),
                                ],
                              ),

                              const SizedBox(height: 12),
                              const Divider(height: 1),
                              const SizedBox(height: 10),

                              // 2. Prix Spécial (négocié)
                              Row(
                                children: [
                                  Checkbox(
                                    value: cart.showPrixSpecial,
                                    activeColor: AppTheme.primaryColor,
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    visualDensity: VisualDensity.compact,
                                    onChanged: (val) {
                                      cart.setPrixSpecialEnabled(val ?? false);
                                      if (val == true && _prixSpecialCtrl.text.isEmpty) {
                                        _prixSpecialCtrl.text = cart.totalCalcule.toStringAsFixed(0);
                                        cart.setPrixSpecial(cart.totalCalcule);
                                      }
                                    },
                                  ),
                                  const Text(
                                    'Prix spécial forfaitaire',
                                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                                  ),
                                ],
                              ),
                              if (cart.showPrixSpecial) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: _prixSpecialCtrl,
                                        keyboardType: TextInputType.number,
                                        decoration: const InputDecoration(
                                          labelText: 'Nouveau prix total',
                                          suffixText: 'XAF',
                                          isDense: true,
                                        ),
                                        onChanged: (val) {
                                          final p = double.tryParse(val.replaceAll(',', '.'));
                                          cart.setPrixSpecial(p, motif: _motifPrixSpecialCtrl.text);
                                        },
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: TextField(
                                        controller: _motifPrixSpecialCtrl,
                                        decoration: const InputDecoration(
                                          labelText: 'Motif (ex: Ami, Lot)',
                                          isDense: true,
                                        ),
                                        onChanged: (val) {
                                          cart.setPrixSpecial(cart.prixSpecial, motif: val);
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ],

                              const SizedBox(height: 12),
                              const Divider(height: 1),
                              const SizedBox(height: 10),

                              // 3. Payer plus tard (Vente à Crédit)
                              Row(
                                children: [
                                  Checkbox(
                                    value: cart.payerPlusTard,
                                    activeColor: Colors.blue.shade700,
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    visualDensity: VisualDensity.compact,
                                    onChanged: (val) {
                                      cart.setPayerPlusTard(val ?? false);
                                    },
                                  ),
                                  const Text(
                                    'Payer plus tard (Vente à Crédit)',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF1D4ED8),
                                    ),
                                  ),
                                ],
                              ),
                              if (cart.payerPlusTard) ...[
                                const SizedBox(height: 6),
                                Padding(
                                  padding: const EdgeInsets.only(left: 8.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Date d'échéance
                                      Row(
                                        children: [
                                          const Icon(Icons.calendar_today, size: 14, color: Color(0xFF2563EB)),
                                          const SizedBox(width: 6),
                                          Text(
                                            cart.dateEcheance != null
                                                ? 'Échéance : ${DateFormat('dd/MM/yyyy').format(cart.dateEcheance!)}'
                                                : "Pas d'échéance définie",
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                          ),
                                          const Spacer(),
                                          TextButton.icon(
                                            style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                            onPressed: () => _selectDateEcheance(context, cart),
                                            icon: const Icon(Icons.edit_calendar, size: 14),
                                            label: const Text('Choisir', style: TextStyle(fontSize: 11)),
                                          ),
                                        ],
                                      ),

                                      // Paiement partiel / Acompte
                                      Row(
                                        children: [
                                          Checkbox(
                                            value: cart.paiementPartiel,
                                            activeColor: Colors.indigo,
                                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            visualDensity: VisualDensity.compact,
                                            onChanged: (val) {
                                              cart.setPaiementPartiel(val ?? false);
                                              if (val == true && _acompteCtrl.text.isEmpty) {
                                                final acompteSug = (cart.total * 0.5).roundToDouble();
                                                _acompteCtrl.text = acompteSug.toStringAsFixed(0);
                                                cart.setMontantPaye(acompteSug);
                                              }
                                            },
                                          ),
                                          const Text(
                                            'Paiement partiel (Acompte versé maintenant)',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                          ),
                                        ],
                                      ),

                                      if (cart.paiementPartiel) ...[
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: TextField(
                                                controller: _acompteCtrl,
                                                keyboardType: TextInputType.number,
                                                decoration: const InputDecoration(
                                                  labelText: 'Montant versé maintenant',
                                                  suffixText: 'XAF',
                                                  isDense: true,
                                                ),
                                                onChanged: (val) {
                                                  final numVal = double.tryParse(val.replaceAll(',', '.'));
                                                  cart.setMontantPaye(numVal);
                                                },
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Reste à payer : ${AppConstants.formatCurrency(cart.resteAPayer)}',
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.indigo,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],

                              const SizedBox(height: 12),
                              const Divider(height: 1),
                              const SizedBox(height: 10),

                              // 4. Date de la vente (Antidatage)
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.history, size: 16, color: AppTheme.textSecondary),
                                      const SizedBox(width: 6),
                                      Text(
                                        cart.dateFacture != null
                                            ? 'Date vente : ${DateFormat('dd/MM/yyyy').format(cart.dateFacture!)}'
                                            : "Date de vente : Aujourd'hui",
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                  TextButton(
                                    style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                    onPressed: () => _selectDateFacture(context, cart),
                                    child: const Text('Modifier', style: TextStyle(fontSize: 11)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ─── SÉLECTEUR DE MODE DE PAIEMENT ───────────────────────────
                  // Visible si vente comptant ou si acompte versé
                  if (!cart.payerPlusTard || (cart.payerPlusTard && cart.paiementPartiel)) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          cart.payerPlusTard
                              ? "Mode de paiement de l'acompte :"
                              : 'Mode de règlement :',
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        TextButton.icon(
                          style: TextButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                          ),
                          onPressed: () => CashDrawerPinDialog.verifyAndOpen(context),
                          icon: const Icon(Icons.point_of_sale, size: 15, color: AppTheme.primaryColor),
                          label: const Text('Ouvrir tiroir', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),

                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildModeChip('ESPECES', 'Espèces', Icons.payments_outlined, cart),
                          const SizedBox(width: 6),
                          _buildModeChip('CARTE', 'Carte', Icons.credit_card, cart),
                          const SizedBox(width: 6),
                          _buildModeChip('VIREMENT', 'Virement', Icons.swap_horiz, cart),
                          const SizedBox(width: 6),
                          _buildModeChip('CHEQUE', 'Chèque', Icons.receipt_long, cart),
                        ],
                      ),
                    ),

                    const SizedBox(height: 10),

                    // Pavé Espèces si mode ESPECES sélectionné
                    if (cart.modePaiement == 'ESPECES')
                      QuickCashPad(
                        totalDue: montantAEncaisser,
                        currentAmount: cart.montantRecu,
                        onAmountChanged: (amt) => cart.setMontantRecu(amt),
                      ),
                  ] else ...[
                    // Vente à crédit à 100% sans acompte
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Icon(Icons.schedule, color: Color(0xFF1D4ED8), size: 28),
                          SizedBox(height: 6),
                          Text(
                            'Paiement différé intégral',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E40AF)),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Aucun encaissement requis aujourd\'hui. La créance client sera enregistrée.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11, color: Color(0xFF3B82F6)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ─── BOUTON DE VALIDATION ET ENCAISSEMENT ─────────────────────────
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: cart.payerPlusTard ? const Color(0xFF1D4ED8) : AppTheme.secondaryColor,
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: cart.isSubmitting
                ? null
                : () async {
                    setState(() => _errorMessage = null);
                    try {
                      final apiService = context.read<ApiService>();
                      final storageService = context.read<StorageService>();

                      final receiptData = ReceiptData(
                        numeroVente: '',
                        date: cart.dateFacture ?? DateTime.now(),
                        caissierNom: widget.caissierNom,
                        clientNom: cart.client?.nomComplet,
                        items: List.from(cart.items),
                        sousTotal: cart.sousTotal,
                        remiseGlobale: cart.remiseGlobale,
                        total: cart.total,
                        modePaiement: cart.payerPlusTard ? 'CREDIT' : cart.modePaiement,
                        montantRecu: cart.modePaiement == 'ESPECES' ? cart.montantRecu : null,
                        monnaieRendue: cart.modePaiement == 'ESPECES' ? cart.monnaieRendue : null,
                      );

                      // Déclencher l'ouverture automatique du tiroir-caisse RJ12 si paiement espèces
                      if (settings.autoOpenDrawer &&
                          (cart.modePaiement == 'ESPECES' || (cart.payerPlusTard && cart.paiementPartiel))) {
                        CashDrawerService.openDrawer();
                      }

                      final saleRes = await cart.submitSale(
                        apiService: apiService,
                        storageService: storageService,
                      );

                      final finalReceipt = ReceiptData(
                        numeroVente: saleRes.numero,
                        date: receiptData.date,
                        caissierNom: receiptData.caissierNom,
                        clientNom: receiptData.clientNom,
                        items: receiptData.items,
                        sousTotal: receiptData.sousTotal,
                        remiseGlobale: receiptData.remiseGlobale,
                        total: receiptData.total,
                        modePaiement: receiptData.modePaiement,
                        montantRecu: receiptData.montantRecu,
                        monnaieRendue: receiptData.monnaieRendue,
                      );

                      if (!context.mounted) return;
                      Navigator.pop(context); // Fermer dialogue
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => SaleSuccessScreen(
                            receiptData: finalReceipt,
                            autoPrint: settings.autoPrint,
                          ),
                        ),
                      );
                    } catch (e) {
                      setState(() {
                        _errorMessage = e.toString().replaceAll('Exception: ', '');
                      });
                    }
                  },
            child: cart.isSubmitting
                ? const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                      SizedBox(width: 12),
                      Text('Enregistrement en cours...'),
                    ],
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.check_circle_outline, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        cart.payerPlusTard
                            ? (cart.paiementPartiel
                                ? 'Encaisser acompte ${AppConstants.formatCurrency(montantAEncaisser)}'
                                : 'Valider la vente à crédit (${AppConstants.formatCurrency(totalDu)})')
                            : 'Valider la vente (${AppConstants.formatCurrency(totalDu)})',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTag(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }

  Widget _buildQuickDiscountPill(CartProvider cart, int amount) {
    return ActionChip(
      label: Text('-$amount', style: const TextStyle(fontSize: 11)),
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
      onPressed: () {
        _remiseCtrl.text = amount.toString();
        cart.setRemiseGlobale(amount.toDouble());
      },
    );
  }

  Widget _buildModeChip(String value, String label, IconData icon, CartProvider cart) {
    final isSelected = cart.modePaiement == value;
    return ChoiceChip(
      selected: isSelected,
      selectedColor: AppTheme.primaryColor,
      backgroundColor: AppTheme.backgroundColor,
      side: BorderSide(
        color: isSelected ? AppTheme.primaryColor : AppTheme.borderColor,
      ),
      avatar: Icon(
        icon,
        size: 16,
        color: isSelected ? Colors.white : AppTheme.textPrimary,
      ),
      label: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: isSelected ? Colors.white : AppTheme.textPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
      onSelected: (_) => cart.setModePaiement(value),
    );
  }
}
