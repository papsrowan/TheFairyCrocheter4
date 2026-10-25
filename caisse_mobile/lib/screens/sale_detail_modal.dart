import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';
import '../models/sale.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/printer_service.dart';
import '../utils/color_utils.dart';
import '../widgets/product_image.dart';

class SaleDetailModal extends StatefulWidget {
  final VenteItem sale;

  const SaleDetailModal({super.key, required this.sale});

  @override
  State<SaleDetailModal> createState() => _SaleDetailModalState();
}

class _SaleDetailModalState extends State<SaleDetailModal> {
  bool _isPrinting = false;

  Future<void> _handlePrint(BuildContext context) async {
    setState(() => _isPrinting = true);
    final auth = context.read<AuthProvider>();
    final messenger = ScaffoldMessenger.of(context);

    VenteItem currentSale = widget.sale;
    if (widget.sale.lignes.any((l) => l.codeBarres == null || l.codeBarres!.isEmpty)) {
      try {
        final api = context.read<ApiService>();
        currentSale = await api.getSaleDetails(widget.sale.id);
      } catch (_) {}
    }

    final receiptData = currentSale.toReceiptData(auth.user?.nomComplet ?? 'Caisse');

    try {
      final success = await PrinterService.printReceiptSmart(receiptData);

      if (mounted) {
        setState(() => _isPrinting = false);
        messenger.showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  success ? Icons.check_circle : Icons.warning_amber,
                  color: Colors.white,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  success
                      ? 'Ticket N° ${widget.sale.numero} imprimé avec succès !'
                      : 'Impossible d\'imprimer sur l\'imprimante thermique.',
                ),
              ],
            ),
            backgroundColor: success ? AppTheme.secondaryColor : AppTheme.errorColor,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isPrinting = false);
        messenger.showSnackBar(
          SnackBar(
            content: Text('Erreur d\'impression : $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.sale;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── EN-TÊTE ─────────────────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          v.numero,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _buildStatusBadge(v.statut),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      DateFormat('dd/MM/yyyy à HH:mm').format(v.dateFacture ?? v.createdAt),
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
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

          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 10),

          // ─── BLOC CLIENT ET CAISSIER ─────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.backgroundColor,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Client :',
                        style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        v.clientNom ?? 'Client de passage',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (v.clientTelephone != null)
                        Text(
                          v.clientTelephone!,
                          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                        ),
                    ],
                  ),
                ),
                Container(width: 1, height: 36, color: AppTheme.borderColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Caissier / Vendeur :',
                        style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        v.vendeurNom ?? 'Caisse Principale',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // ─── ARTICLES DE LA VENTE ────────────────────────────────────────
          const Text(
            'Articles commandés :',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 6),

          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: v.lignes.length,
              separatorBuilder: (_, _) => const Divider(height: 1, color: AppTheme.borderColor),
              itemBuilder: (context, index) {
                final ligne = v.lignes[index];
                final clr = ligne.couleur != null ? ColorUtils.parseColor(ligne.couleur) : null;
                final isLight = clr != null ? ColorUtils.isLightColor(clr) : false;

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Miniature photo
                      ProductImage(
                        imageUrl: ligne.imageUrl,
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                      ),
                      const SizedBox(width: 10),

                      // Description article
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              ligne.nomProduit,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (ligne.couleur != null) ...[
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  if (clr != null)
                                    Container(
                                      width: 10,
                                      height: 10,
                                      margin: const EdgeInsets.only(right: 4),
                                      decoration: BoxDecoration(
                                        color: clr,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: isLight ? Colors.grey.shade400 : Colors.black.withValues(alpha: 0.15),
                                          width: 0.8,
                                        ),
                                      ),
                                    ),
                                  Text(
                                    ligne.couleur!,
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.primaryDark),
                                  ),
                                  if (ligne.couleurDescription != null && ligne.couleurDescription!.isNotEmpty)
                                    Expanded(
                                      child: Text(
                                        ' (${ligne.couleurDescription})',
                                        style: const TextStyle(fontSize: 10.5, fontStyle: FontStyle.italic, color: AppTheme.textSecondary),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 2),
                            Text(
                              '${ligne.quantite} × ${AppConstants.formatCurrency(ligne.prixUnitaire)}'
                              '${ligne.remise > 0 ? ' (Remise: -${AppConstants.formatCurrency(ligne.remise)})' : ''}',
                              style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),

                      // Total ligne
                      Text(
                        AppConstants.formatCurrency(ligne.total),
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppTheme.primaryColor),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 10),

          // ─── TOTAL & MODES DE PAIEMENT ───────────────────────────────────
          Column(
            children: [
              if (v.remiseGlobale > 0 || v.sousTotal != v.total) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Sous-total :', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                    Text(AppConstants.formatCurrency(v.sousTotal), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 3),
              ],
              if (v.remiseGlobale > 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Remise globale :', style: TextStyle(fontSize: 12, color: AppTheme.secondaryColor)),
                    Text('-${AppConstants.formatCurrency(v.remiseGlobale)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.secondaryColor)),
                  ],
                ),
                const SizedBox(height: 3),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('TOTAL TTC :', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                  Text(
                    AppConstants.formatCurrency(v.total),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.primaryDark),
                  ),
                ],
              ),

              // Informations spécifiques crédit / acompte
              if (v.isCredit) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Modalité : VENTE À CRÉDIT',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                          ),
                          if (v.dateEcheance != null)
                            Text(
                              'Échéance : ${DateFormat('dd/MM/yyyy').format(v.dateEcheance!)}',
                              style: const TextStyle(fontSize: 10.5, color: Color(0xFF2563EB)),
                            ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (v.montantPaye != null && v.montantPaye! > 0)
                            Text(
                              'Payé : ${AppConstants.formatCurrency(v.montantPaye!)}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF16A34A)),
                            ),
                          Text(
                            'Reste dû : ${AppConstants.formatCurrency(v.resteDu)}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFB91C1C)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),

          const SizedBox(height: 14),

          // ─── BOUTON IMPRESSION REÇU ──────────────────────────────────────
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: _isPrinting ? null : () => _handlePrint(context),
            icon: _isPrinting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Icon(Icons.print, size: 20),
            label: Text(
              _isPrinting ? 'Impression en cours...' : 'Imprimer le ticket de caisse (58 mm)',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String statut) {
    Color bg;
    Color fg;
    String label;

    switch (statut) {
      case 'COMPLETEE':
        bg = const Color(0xFFD1FAE5);
        fg = const Color(0xFF065F46);
        label = 'Complétée';
        break;
      case 'ANNULEE':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFF991B1B);
        label = 'Annulée';
        break;
      default:
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFF92400E);
        label = statut;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }
}
