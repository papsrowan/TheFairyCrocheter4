import 'package:flutter/material.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/product.dart';
import '../utils/color_utils.dart';
import '../widgets/product_image.dart';

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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
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
          // En-tête avec Photo et Titre
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProductImage(
                imageUrl: widget.product.imageUrl,
                width: 58,
                height: 58,
                borderRadius: 10,
              ),
              const SizedBox(width: 12),
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
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          AppConstants.formatCurrency(widget.product.prixVente),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.primaryColor,
                          ),
                        ),
                        if (widget.product.categorieNom != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            '• ${widget.product.categorieNom}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                visualDensity: VisualDensity.compact,
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Sous-titre explicatif
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.palette_outlined, size: 16, color: AppTheme.primaryDark),
                const SizedBox(width: 6),
                Text(
                  'Sélectionnez les couleurs (${widget.product.variantes.length} disponibles) :',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryDark,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Liste des variantes avec pastille couleur visible et description
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: widget.product.variantes.length,
              separatorBuilder: (_, _) => const Divider(height: 1, color: AppTheme.borderColor),
              itemBuilder: (context, index) {
                final v = widget.product.variantes[index];
                final qte = _quantities[v.id] ?? 0;
                final enRupture = v.stockActuel <= 0;
                final parsedColor = ColorUtils.parseColor(v.couleur);
                final isLight = ColorUtils.isLightColor(parsedColor);

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Pastille visuelle de couleur
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: parsedColor,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isLight ? Colors.grey.shade400 : Colors.black.withValues(alpha: 0.15),
                            width: isLight ? 1.5 : 1,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: qte > 0
                            ? Center(
                                child: Icon(
                                  Icons.check,
                                  size: 18,
                                  color: isLight ? Colors.black87 : Colors.white,
                                ),
                              )
                            : null,
                      ),

                      const SizedBox(width: 12),

                      // Nom de la couleur, description détaillée et stock
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              v.couleur,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: enRupture ? AppTheme.textSecondary : AppTheme.textPrimary,
                              ),
                            ),

                            // Description détaillée de la couleur
                            if (v.description != null && v.description!.trim().isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                v.description!.trim(),
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontStyle: FontStyle.italic,
                                  color: enRupture ? Colors.grey : AppTheme.textSecondary,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],

                            const SizedBox(height: 2),

                            // Indicateur de stock
                            Row(
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    color: enRupture ? AppTheme.errorColor : AppTheme.secondaryColor,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  enRupture ? 'Rupture de stock' : '${v.stockActuel} en stock',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: enRupture ? AppTheme.errorColor : AppTheme.secondaryColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      // Contrôleur de quantité tactile
                      if (!enRupture)
                        Container(
                          decoration: BoxDecoration(
                            color: AppTheme.backgroundColor,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: qte > 0 ? AppTheme.primaryColor : AppTheme.borderColor,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
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
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: qte > 0 ? AppTheme.primaryDark : AppTheme.textPrimary,
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

          const SizedBox(height: 14),

          // Bouton d'ajout
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: _totalSelected == 0
                ? null
                : () {
                    final Map<VarianteCouleur, int> result = {};
                    for (final v in widget.product.variantes) {
                      final q = _quantities[v.id] ?? 0;
                      if (q > 0) {
                        result[v] = q;
                      }
                    }
                    widget.onConfirm(result);
                    Navigator.pop(context);
                  },
            child: Text(
              _totalSelected == 0
                  ? 'Sélectionnez au moins une couleur'
                  : 'Ajouter au panier ($_totalSelected article${_totalSelected > 1 ? 's' : ''})',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
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
      child: Padding(
        padding: const EdgeInsets.all(7.0),
        child: Icon(icon, size: 18, color: AppTheme.textPrimary),
      ),
    );
  }
}
