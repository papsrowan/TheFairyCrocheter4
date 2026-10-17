import 'package:flutter/material.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/product.dart';
import '../utils/color_utils.dart';
import 'product_image.dart';

class ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;

  const ProductCard({
    super.key,
    required this.product,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.borderColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── PHOTO DU PRODUIT AVEC BADGES ─────────────────────────────
            Expanded(
              flex: 11,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ProductImage(
                      imageUrl: product.imageUrl,
                      borderRadius: 0,
                      fit: BoxFit.cover,
                    ),
                  ),

                  // Badge Catégorie (en haut à gauche)
                  if (product.categorieNom != null)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          product.categorieNom!,
                          style: const TextStyle(
                            fontSize: 9.5,
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),

                  // Badge Stock (en haut à droite)
                  Positioned(
                    top: 6,
                    right: 6,
                    child: _buildStockBadge(),
                  ),
                ],
              ),
            ),

            // ─── INFORMATIONS PRODUIT ──────────────────────────────────────
            Expanded(
              flex: 12,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 6.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Nom du produit
                    Text(
                      product.nom,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                        height: 1.15,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    // Variantes avec pastilles de couleurs visibles
                    if (product.hasVariantes)
                      _buildVariantColorRow()
                    else
                      const SizedBox(height: 2),

                    // Ligne Prix et Bouton Ajout
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            AppConstants.formatCurrency(product.prixVente),
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryColor,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: const Icon(
                            Icons.add_shopping_cart,
                            size: 15,
                            color: AppTheme.primaryColor,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVariantColorRow() {
    final vars = product.variantes;
    const maxDots = 3;
    final displayDots = vars.take(maxDots).toList();
    final remaining = vars.length - maxDots;

    return Row(
      children: [
        ...displayDots.map((v) {
          final c = ColorUtils.parseColor(v.couleur);
          final isLight = ColorUtils.isLightColor(c);
          return Container(
            margin: const EdgeInsets.only(right: 3),
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: c,
              shape: BoxShape.circle,
              border: Border.all(
                color: isLight ? Colors.grey.shade400 : Colors.black.withValues(alpha: 0.15),
                width: 0.8,
              ),
            ),
          );
        }),
        if (remaining > 0)
          Text(
            '+$remaining',
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppTheme.textSecondary,
            ),
          ),
      ],
    );
  }

  Widget _buildStockBadge() {
    Color bg;
    Color fg;
    String label;

    if (product.enRupture) {
      bg = const Color(0xFFFEE2E2);
      fg = AppTheme.errorColor;
      label = 'Rupture';
    } else if (product.stockFaible) {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFFD97706);
      label = '${product.stockActuel}';
    } else {
      bg = const Color(0xFFD1FAE5);
      fg = AppTheme.secondaryColor;
      label = '${product.stockActuel}';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 2,
          ),
        ],
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
