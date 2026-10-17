import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../services/storage_service.dart';

class ProductImage extends StatelessWidget {
  final String? imageUrl;
  final double? width;
  final double? height;
  final double borderRadius;
  final BoxFit fit;

  const ProductImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.borderRadius = 8,
    this.fit = BoxFit.cover,
  });

  /// Résout l'URL relative (ex: "/uploads/produits/prod_123.jpg") en URL absolue
  static String resolveUrl(String? rawUrl, BuildContext context) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final trimmed = rawUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    String base;
    try {
      base = context.read<StorageService>().getBaseUrl();
    } catch (_) {
      base = AppConstants.defaultBaseUrl;
    }

    final cleanBase = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$cleanBase$cleanPath';
  }

  @override
  Widget build(BuildContext context) {
    final fullUrl = resolveUrl(imageUrl, context);

    if (fullUrl.isEmpty) {
      return _buildPlaceholder();
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Image.network(
        fullUrl,
        width: width,
        height: height,
        fit: fit,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Container(
            width: width,
            height: height,
            color: AppTheme.backgroundColor,
            child: Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  value: loadingProgress.expectedTotalBytes != null
                      ? loadingProgress.cumulativeBytesLoaded /
                          loadingProgress.expectedTotalBytes!
                      : null,
                  color: AppTheme.primaryColor.withValues(alpha: 0.5),
                ),
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) {
          return _buildPlaceholder();
        },
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppTheme.primaryLight.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: AppTheme.primaryColor.withValues(alpha: 0.15),
          width: 1,
        ),
      ),
      child: Center(
        child: Icon(
          Icons.shopping_bag_outlined,
          size: (height != null && height! < 50) ? 20 : 28,
          color: AppTheme.primaryColor.withValues(alpha: 0.4),
        ),
      ),
    );
  }
}
