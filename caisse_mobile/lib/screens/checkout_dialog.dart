import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../providers/cart_provider.dart';
import '../providers/terminal_settings_provider.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/printer_service.dart';
import '../widgets/quick_cash_pad.dart';
import 'sale_success_screen.dart';

class CheckoutDialog extends StatefulWidget {
  final String caissierNom;

  const CheckoutDialog({super.key, required this.caissierNom});

  @override
  State<CheckoutDialog> createState() => _CheckoutDialogState();
}

class _CheckoutDialogState extends State<CheckoutDialog> {
  String? _errorMessage;

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final settings = context.watch<TerminalSettingsProvider>();

    return Container(
      padding: const EdgeInsets.all(16),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // En-tête
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Règlement de la Vente',
                style: TextStyle(
                  fontSize: 18,
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

          const SizedBox(height: 8),

          // Total à payer
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${cart.totalArticles} article${cart.totalArticles > 1 ? 's' : ''}',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                    if (cart.client != null)
                      Text(
                        'Client: ${cart.client!.nomComplet}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryDark),
                      ),
                  ],
                ),
                Text(
                  AppConstants.formatCurrency(cart.total),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primaryDark,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _errorMessage!,
                style: const TextStyle(color: AppTheme.errorColor, fontSize: 13),
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Sélecteur de mode de paiement
          const Text(
            'Mode de paiement :',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 8),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildModeChip('ESPECES', 'Espèces', Icons.payments_outlined, cart),
                const SizedBox(width: 8),
                _buildModeChip('CARTE', 'Carte', Icons.credit_card, cart),
                const SizedBox(width: 8),
                _buildModeChip('VIREMENT', 'Virement', Icons.swap_horiz, cart),
                const SizedBox(width: 8),
                _buildModeChip('CREDIT', 'Crédit', Icons.schedule, cart),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Pavé Espèces si mode ESPECES sélectionné
          Flexible(
            child: SingleChildScrollView(
              child: cart.modePaiement == 'ESPECES'
                  ? QuickCashPad(
                      totalDue: cart.total,
                      currentAmount: cart.montantRecu,
                      onAmountChanged: (amt) => cart.setMontantRecu(amt),
                    )
                  : Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Center(
                        child: Text(
                          'Paiement par ${cart.modePaiement}\nMontant total : ${AppConstants.formatCurrency(cart.total)}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                        ),
                      ),
                    ),
            ),
          ),

          const SizedBox(height: 14),

          // Bouton de validation
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.secondaryColor,
              minimumSize: const Size(double.infinity, 54),
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
                        date: DateTime.now(),
                        caissierNom: widget.caissierNom,
                        clientNom: cart.client?.nomComplet,
                        items: List.from(cart.items),
                        sousTotal: cart.sousTotal,
                        remiseGlobale: cart.remiseGlobale,
                        total: cart.total,
                        modePaiement: cart.modePaiement,
                        montantRecu: cart.modePaiement == 'ESPECES' ? cart.montantRecu : null,
                        monnaieRendue: cart.modePaiement == 'ESPECES' ? cart.monnaieRendue : null,
                      );

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
                      const Icon(Icons.check_circle_outline, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Valider la vente (${AppConstants.formatCurrency(cart.total)})',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
          ),
        ],
      ),
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
        size: 18,
        color: isSelected ? Colors.white : AppTheme.textPrimary,
      ),
      label: Text(
        label,
        style: TextStyle(
          color: isSelected ? Colors.white : AppTheme.textPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
      onSelected: (_) => cart.setModePaiement(value),
    );
  }
}
