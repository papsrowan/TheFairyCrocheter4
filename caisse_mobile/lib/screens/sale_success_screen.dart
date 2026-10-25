import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../providers/cart_provider.dart';
import '../services/printer_service.dart';

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
                    color: AppTheme.backgroundColor,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: Text(
                    d.numeroVente,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                ),

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

                // Bouton d'impression du ticket
                OutlinedButton.icon(
                  onPressed: _isPrinting ? null : _printTicket,
                  icon: _isPrinting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.print_outlined),
                  label: Text(_isPrinting ? 'Impression...' : 'Imprimer le ticket 58mm'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52),
                  ),
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
