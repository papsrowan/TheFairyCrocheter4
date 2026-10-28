import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../providers/cart_provider.dart';
import '../providers/terminal_settings_provider.dart';
import '../services/printer_service.dart';
import '../services/cash_drawer_service.dart';

class SaleSuccessScreen extends StatefulWidget {
  final ReceiptData receiptData;
  final bool autoPrint;

  const SaleSuccessScreen({
    super.key,
    required this.receiptData,
    this.autoPrint = true,
  });

  @override
  State<SaleSuccessScreen> createState() => _SaleSuccessScreenState();
}

class _SaleSuccessScreenState extends State<SaleSuccessScreen> {
  bool _isPrinting = false;

  @override
  void initState() {
    super.initState();
    if (widget.autoPrint) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _printTicket();
      });
    }
  }

  Future<void> _printTicket() async {
    if (_isPrinting) return;
    setState(() => _isPrinting = true);
    try {
      final ok = await PrinterService.printReceiptNative(widget.receiptData);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Impression annulée ou indisponible.'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur : $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPrinting = false);
    }
  }

  void _finishAndNewSale() {
    context.read<CartProvider>().clearCart();
    Navigator.popUntil(context, (route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.receiptData;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          _finishAndNewSale();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(),

                // Cercle vert animé
                Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: Color(0xFFD1FAE5),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_circle,
                    size: 54,
                    color: AppTheme.secondaryColor,
                  ),
                ),

                const SizedBox(height: 16),

                const Text(
                  'Vente enregistrée !',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textPrimary,
                  ),
                ),

                const SizedBox(height: 6),

                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: d.numeroVente.startsWith('OFF-') ? const Color(0xFFFEF3C7) : AppTheme.backgroundColor,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: d.numeroVente.startsWith('OFF-') ? const Color(0xFFF59E0B) : AppTheme.borderColor,
                    ),
                  ),
                  child: Text(
                    d.numeroVente,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: d.numeroVente.startsWith('OFF-') ? const Color(0xFFB45309) : AppTheme.primaryColor,
                    ),
                  ),
                ),

                if (d.numeroVente.startsWith('OFF-')) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFFBBF24)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.cloud_off, size: 14, color: Color(0xFFD97706)),
                        SizedBox(width: 5),
                        Text(
                          'Mode hors-ligne • En attente de synchro',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFB45309),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 16),

                // Montant payé
                Text(
                  AppConstants.formatCurrency(d.total),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.secondaryColor,
                  ),
                ),

                if (d.monnaieRendue != null && d.monnaieRendue! > 0) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Monnaie rendue : ${AppConstants.formatCurrency(d.monnaieRendue!)}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.secondaryColor,
                      ),
                    ),
                  ),
                ],

                const Spacer(),

                // Boutons d'actions : Ouvrir caisse + Imprimer ticket
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          final settings = context.read<TerminalSettingsProvider>();
                          CashDrawerService.openDrawer(code: settings.cashDrawerPin);
                        },
                        icon: const Icon(Icons.point_of_sale, size: 18),
                        label: const Text('Ouvrir caisse'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 50),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _isPrinting ? null : _printTicket,
                        icon: _isPrinting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.print_outlined, size: 18),
                        label: Text(_isPrinting ? '...' : 'Imprimer'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 50),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Bouton géant Nouvelle Vente
                ElevatedButton.icon(
                  onPressed: _finishAndNewSale,
                  icon: const Icon(Icons.add_shopping_cart),
                  label: const Text('Nouvelle Vente'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    minimumSize: const Size(double.infinity, 54),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
