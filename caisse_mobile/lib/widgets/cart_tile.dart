import 'package:flutter/material.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/cart_item.dart';
import '../utils/color_utils.dart';
import 'product_image.dart';

class CartTile extends StatelessWidget {
  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onDelete;
  final Function(double discount) onDiscount;

  const CartTile({
    super.key,
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
    required this.onDelete,
    required this.onDiscount,
  });

  void _showDiscountDialog(BuildContext context) {
    final ctrl = TextEditingController(
      text: item.remise > 0 ? item.remise.toStringAsFixed(0) : '',
    );
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.percent, color: AppTheme.primaryColor, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Remise sur ${item.nom}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sous-total ligne : ${AppConstants.formatCurrency(item.sousTotal)}',
              style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Montant de remise (XAF)',
                hintText: 'Ex: 500',
                suffixText: 'XAF',
              ),
            ),
            const SizedBox(height: 10),
            // Raccourcis de remise
            Wrap(
              spacing: 6,
              children: [
                _buildQuickDiscountChip(ctx, ctrl, 200),
                _buildQuickDiscountChip(ctx, ctrl, 500),
                _buildQuickDiscountChip(ctx, ctrl, 1000),
                _buildQuickDiscountChip(ctx, ctrl, 2000),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              onDiscount(0);
              Navigator.pop(ctx);
            },
            child: const Text('Effacer', style: TextStyle(color: AppTheme.errorColor)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(ctrl.text.replaceAll(',', '.')) ?? 0.0;
              onDiscount(val);
              Navigator.pop(ctx);
            },
            child: const Text('Appliquer'),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickDiscountChip(BuildContext ctx, TextEditingController ctrl, int amount) {
    return ActionChip(
      label: Text('-$amount', style: const TextStyle(fontSize: 11)),
      onPressed: () {
        ctrl.text = amount.toString();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final parsedColor = item.couleur != null ? ColorUtils.parseColor(item.couleur) : null;
    final isLight = parsedColor != null ? ColorUtils.isLightColor(parsedColor) : false;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Titre, Photo, Variante et suppression
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Miniature Photo Produit
              ProductImage(
                imageUrl: item.imageUrl,
                width: 46,
                height: 46,
                borderRadius: 8,
              ),

              const SizedBox(width: 10),

              // Détails article
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.nom,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    // Pastille et nom de variante si présente
                    if (item.couleur != null) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          if (parsedColor != null)
                            Container(
                              width: 12,
                              height: 12,
                              margin: const EdgeInsets.only(right: 5),
                              decoration: BoxDecoration(
                                color: parsedColor,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isLight ? Colors.grey.shade400 : Colors.black.withValues(alpha: 0.15),
                                  width: 0.8,
                                ),
                              ),
                            ),
                          Text(
                            item.couleur!,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                          if (item.couleurDescription != null && item.couleurDescription!.isNotEmpty)
                            Expanded(
                              child: Text(
                                ' (${item.couleurDescription!})',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontStyle: FontStyle.italic,
                                  color: AppTheme.textSecondary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              IconButton(
                icon: const Icon(Icons.delete_outline, size: 20, color: AppTheme.errorColor),
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: onDelete,
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Ligne des contrôles de quantité, remise et prix
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Sélecteur de quantité tactile
              Container(
                decoration: BoxDecoration(
                  color: AppTheme.backgroundColor,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: Row(
                  children: [
                    _buildQtyBtn(Icons.remove, onDecrement),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        '${item.quantite}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    _buildQtyBtn(Icons.add, onIncrement),
                  ],
                ),
              ),

              // Bouton remise sur article
              InkWell(
                onTap: () => _showDiscountDialog(context),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: item.remise > 0
                        ? AppTheme.secondaryLight
                        : AppTheme.backgroundColor,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: item.remise > 0
                          ? AppTheme.secondaryColor
                          : AppTheme.borderColor,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.percent,
                        size: 13,
                        color: item.remise > 0
                            ? AppTheme.secondaryColor
                            : AppTheme.textSecondary,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        item.remise > 0
                            ? '-${AppConstants.formatCurrency(item.remise)}'
                            : 'Remise',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: item.remise > 0
                              ? AppTheme.secondaryColor
                              : AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Prix
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    AppConstants.formatCurrency(item.total),
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                  Text(
                    '${item.quantite} × ${AppConstants.formatCurrency(item.prixUnitaire)}',
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQtyBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.all(6.0),
        child: Icon(icon, size: 16, color: AppTheme.textPrimary),
      ),
    );
  }
}
