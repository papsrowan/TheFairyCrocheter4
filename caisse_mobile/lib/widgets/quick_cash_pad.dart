import 'package:flutter/material.dart';
import '../config/constants.dart';
import '../config/theme.dart';

class QuickCashPad extends StatelessWidget {
  final double totalDue;
  final double currentAmount;
  final Function(double amount) onAmountChanged;

  const QuickCashPad({
    super.key,
    required this.totalDue,
    required this.currentAmount,
    required this.onAmountChanged,
  });

  @override
  Widget build(BuildContext context) {
    final change = (currentAmount - totalDue).clamp(0.0, double.infinity);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Zone résumé de la monnaie
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: change > 0 ? const Color(0xFFECFDF5) : AppTheme.backgroundColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: change > 0 ? AppTheme.secondaryColor.withValues(alpha: 0.3) : AppTheme.borderColor,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Monnaie à rendre',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    AppConstants.formatCurrency(change),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: change > 0 ? AppTheme.secondaryColor : AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'Reçu du client',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  Text(
                    AppConstants.formatCurrency(currentAmount),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        const Text(
          'Sélection rapide du montant reçu :',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
        ),

        const SizedBox(height: 8),

        // Grille de boutons rapides
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            // Bouton Compte Exact
            ActionChip(
              backgroundColor: currentAmount == totalDue ? AppTheme.primaryColor : Colors.white,
              label: Text(
                'Montant Exact (${AppConstants.formatCurrency(totalDue)})',
                style: TextStyle(
                  color: currentAmount == totalDue ? Colors.white : AppTheme.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 12.5,
                ),
              ),
              onPressed: () => onAmountChanged(totalDue),
            ),

            ...AppConstants.quickCashAmounts.map((amt) {
              final isSelected = currentAmount == amt.toDouble();
              return ActionChip(
                backgroundColor: isSelected ? AppTheme.primaryColor : Colors.white,
                side: BorderSide(
                  color: isSelected ? AppTheme.primaryColor : AppTheme.borderColor,
                ),
                label: Text(
                  AppConstants.formatCurrency(amt),
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppTheme.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                onPressed: () => onAmountChanged(amt.toDouble()),
              );
            }),
          ],
        ),
      ],
    );
  }
}
