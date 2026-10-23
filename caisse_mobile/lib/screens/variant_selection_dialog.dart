import 'package:flutter/material.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/product.dart';

class VariantSelectionDialog extends StatefulWidget {
  final Product product;
  final Function(Map<VarianteCouleur, int> selections) onConfirm;

  const VariantSelectionDialog({
    super.key,
    required this.product,
    required this.onConfirm,
  });

  @override
  State<VariantSelectionDialog> createState() => _VariantSelectionDialogState();
}

class _VariantSelectionDialogState extends State<VariantSelectionDialog> {
  final Map<String, int> _quantities = {};

  @override
  void initState() {
    super.initState();
    // Par défaut 1 pour la première variante en stock
    for (final v in widget.product.variantes) {
      if (v.stockActuel > 0) {
        _quantities[v.id] = 1;
        break;
      }
    }
  }

  int get _totalSelected => _quantities.values.fold(0, (sum, q) => sum + q);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.product.nom,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textPrimary,
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      AppConstants.formatCurrency(widget.product.prixVente),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Text(
            'Choisissez les couleurs et quantités :',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 8),

          // Liste des variantes
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: widget.product.variantes.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final v = widget.product.variantes[index];
                final qte = _quantities[v.id] ?? 0;
                final enRupture = v.stockActuel <= 0;

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Nom couleur & stock disponible
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              v.couleur,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: enRupture ? AppTheme.textSecondary : AppTheme.textPrimary,
                              ),
                            ),
                            Text(
                              enRupture ? 'Rupture' : '${v.stockActuel} en stock',
                              style: TextStyle(
                                fontSize: 11,
                                color: enRupture ? AppTheme.errorColor : AppTheme.secondaryColor,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Boutons quantité
                      if (!enRupture)
                        Container(
                          decoration: BoxDecoration(
                            color: AppTheme.backgroundColor,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.borderColor),
                          ),
                          child: Row(
                            children: [
                              _buildBtn(Icons.remove, () {
                                if (qte > 0) {
                                  setState(() {
                                    _quantities[v.id] = qte - 1;
                                  });
                                }
                              }),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 10),
                                child: Text(
                                  '$qte',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              _buildBtn(Icons.add, () {
                                if (qte < v.stockActuel) {
                                  setState(() {
                                    _quantities[v.id] = qte + 1;
                                  });
                                }
                              }),
                            ],
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 16),

          // Bouton d'ajout
          ElevatedButton(
            onPressed: _totalSelected > 0
                ? () {
                    final selected = <VarianteCouleur, int>{};
                    for (final v in widget.product.variantes) {
                      final q = _quantities[v.id] ?? 0;
                      if (q > 0) selected[v] = q;
                    }
                    widget.onConfirm(selected);
                    Navigator.pop(context);
                  }
                : null,
            child: Text(
              _totalSelected > 0
                  ? 'Ajouter $_totalSelected article${_totalSelected > 1 ? 's' : ''}'
                  : 'Sélectionnez au moins 1 article',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        child: Icon(icon, size: 16, color: AppTheme.textPrimary),
      ),
    );
  }
}
