import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../providers/terminal_settings_provider.dart';
import '../services/cash_drawer_service.dart';

class CashDrawerPinDialog extends StatefulWidget {
  const CashDrawerPinDialog({super.key});

  /// Méthode statique utilitaire : vérifie si le PIN est requis, l'affiche si nécessaire,
  /// et ouvre le tiroir-caisse physique RJ12 en cas de validation.
  static Future<bool> verifyAndOpen(BuildContext context) async {
    final settings = Provider.of<TerminalSettingsProvider>(context, listen: false);

    // Si le code PIN n'est pas activé, ouvrir directement avec le code configuré
    if (!settings.requireDrawerPin) {
      final ok = await CashDrawerService.openDrawer(code: settings.cashDrawerPin);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(ok ? Icons.check_circle : Icons.info_outline, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(ok ? 'Tiroir-caisse ouvert !' : 'Commande d\'ouverture envoyée.'),
              ],
            ),
            backgroundColor: AppTheme.secondaryColor,
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return ok;
    }

    // Afficher la boîte de dialogue de saisie du PIN (style Hardware Manager)
    final String? enteredPin = await showDialog<String?>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const CashDrawerPinDialog(),
    );

    if (enteredPin != null && enteredPin.isNotEmpty) {
      // Sauvegarder automatiquement comme code par défaut si différent
      if (settings.cashDrawerPin != enteredPin) {
        settings.setCashDrawerPin(enteredPin);
      }
      final ok = await CashDrawerService.openDrawer(code: enteredPin);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(ok ? Icons.check_circle : Icons.info_outline, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(ok ? 'Tiroir-caisse déverrouillé et ouvert !' : 'Commande d\'ouverture envoyée.'),
              ],
            ),
            backgroundColor: AppTheme.secondaryColor,
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return ok;
    }
    return false;
  }

  @override
  State<CashDrawerPinDialog> createState() => _CashDrawerPinDialogState();
}

class _CashDrawerPinDialogState extends State<CashDrawerPinDialog> {
  String _pin = '';
  String? _errorMessage;

  void _onKeyPress(String digit) {
    if (_pin.length < 6) {
      setState(() {
        _pin += digit;
        _errorMessage = null;
      });
      if (_pin.length == 6) {
        _checkPin();
      }
    }
  }

  void _onBackspace() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
        _errorMessage = null;
      });
    }
  }

  void _checkPin() {
    if (_pin.isNotEmpty) {
      Navigator.of(context).pop(_pin);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Container(
        width: 340,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icône et En-tête
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.point_of_sale,
                    size: 24,
                    color: AppTheme.primaryColor,
                  ),
                ),
                const SizedBox(width: 8),
                const Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Tiroir-Caisse (RJ12)',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      Text(
                        'Hardware Cashbox',
                        style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Input password to open cash box\n(Saisissez le code pour ouvrir le tiroir)',
              style: TextStyle(fontSize: 11.5, color: AppTheme.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),

            // 6 Cases arrondies de saisie du Code PIN (style Hardware Manager)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(6, (index) {
                final isFilled = index < _pin.length;
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: 32,
                  height: 38,
                  decoration: BoxDecoration(
                    color: isFilled ? AppTheme.primaryLight : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isFilled ? AppTheme.primaryColor : Colors.grey.shade300,
                      width: isFilled ? 1.5 : 1.0,
                    ),
                  ),
                  child: Center(
                    child: isFilled
                        ? Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppTheme.primaryColor,
                            ),
                          )
                        : null,
                  ),
                );
              }),
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 6),
              Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ] else ...[
              const SizedBox(height: 10),
            ],

            // Bouton Bleu "Ouvrir le tiroir-caisse" (comme Hardware Manager)
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton.icon(
                onPressed: _pin.isNotEmpty ? _checkPin : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1976D2), // Bleu Hardware Manager
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.lock_open, size: 18),
                label: const Text(
                  'Open cash box (Ouvrir)',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
            ),

            const SizedBox(height: 14),

            // Pavé numérique tactile
            Column(
              children: [
                _buildRow(['1', '2', '3']),
                const SizedBox(height: 8),
                _buildRow(['4', '5', '6']),
                const SizedBox(height: 8),
                _buildRow(['7', '8', '9']),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Bouton Annuler
                    SizedBox(
                      width: 72,
                      height: 48,
                      child: TextButton(
                        onPressed: () => Navigator.of(context).pop(null),
                        style: TextButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Annuler', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      ),
                    ),
                    _buildNumberButton('0'),
                    // Bouton Effacer
                    SizedBox(
                      width: 72,
                      height: 48,
                      child: IconButton(
                        icon: const Icon(Icons.backspace_outlined, size: 22),
                        color: AppTheme.textPrimary,
                        onPressed: _onBackspace,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(List<String> digits) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: digits.map((d) => _buildNumberButton(d)).toList(),
    );
  }

  Widget _buildNumberButton(String digit) {
    return SizedBox(
      width: 72,
      height: 48,
      child: ElevatedButton(
        onPressed: () => _onKeyPress(digit),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.grey.shade100,
          foregroundColor: AppTheme.textPrimary,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: Colors.grey.shade300),
          ),
          padding: EdgeInsets.zero,
        ),
        child: Text(
          digit,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
