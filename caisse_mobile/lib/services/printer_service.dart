import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../config/constants.dart';
import '../models/cart_item.dart';

class ReceiptData {
  final String numeroVente;
  final DateTime date;
  final String caissierNom;
  final String? clientNom;
  final List<CartItem> items;
  final double sousTotal;
  final double remiseGlobale;
  final double total;
  final String modePaiement;
  final double? montantRecu;
  final double? monnaieRendue;

  ReceiptData({
    required this.numeroVente,
    required this.date,
    required this.caissierNom,
    this.clientNom,
    required this.items,
    required this.sousTotal,
    required this.remiseGlobale,
    required this.total,
    required this.modePaiement,
    this.montantRecu,
    this.monnaieRendue,
  });
}

class PrinterService {
  // ─── IMPRESSION ANDROID DIRECTE (SPOOLER / SERVICE SYSTÈME) ─────────────────
  // Imprime sur l'imprimante thermique par défaut du terminal POS Android
  static Future<bool> printReceiptNative(ReceiptData data) async {
    try {
      final doc = pw.Document();

      // Largeur standard rouleau 58mm = 58 * 72 / 25.4 ≈ 164 points (marge 4 points)
      const pageFormat = PdfPageFormat(
        58 * PdfPageFormat.mm,
        double.infinity,
        marginAll: 3 * PdfPageFormat.mm,
      );

      doc.addPage(
        pw.Page(
          pageFormat: pageFormat,
          build: (pw.Context context) {
            return pw.Container(
              width: double.infinity,
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                mainAxisSize: pw.MainAxisSize.min,
                children: [
                  // En-tête
                  pw.Text(
                    'THE FAIRY CROCHETER',
                    style: pw.TextStyle(
                      fontSize: 11,
                      fontWeight: pw.FontWeight.bold,
                    ),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'Boutique de crochet & accessoires',
                    style: const pw.TextStyle(fontSize: 7),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 0.5, borderStyle: pw.BorderStyle.dashed),

                  // Métadonnées
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Ticket N°:', style: const pw.TextStyle(fontSize: 7.5)),
                      pw.Text(data.numeroVente, style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
                    ],
                  ),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Date:', style: const pw.TextStyle(fontSize: 7.5)),
                      pw.Text(AppConstants.formatDateTime(data.date), style: const pw.TextStyle(fontSize: 7.5)),
                    ],
                  ),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Caissier:', style: const pw.TextStyle(fontSize: 7.5)),
                      pw.Text(data.caissierNom, style: const pw.TextStyle(fontSize: 7.5)),
                    ],
                  ),
                  if (data.clientNom != null && data.clientNom!.isNotEmpty) ...[
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Client:', style: const pw.TextStyle(fontSize: 7.5)),
                        pw.Text(data.clientNom!, style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
                      ],
                    ),
                  ],

                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 0.5, borderStyle: pw.BorderStyle.dashed),

                  // Articles
                  ...data.items.map((item) {
                    final desc = item.couleur != null ? '${item.nom} (${item.couleur})' : item.nom;
                    return pw.Padding(
                      padding: const pw.EdgeInsets.symmetric(vertical: 1.5),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            desc,
                            style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
                            maxLines: 2,
                          ),
                          pw.Row(
                            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                            children: [
                              pw.Text(
                                '${item.quantite} x ${AppConstants.formatCurrency(item.prixUnitaire)}',
                                style: const pw.TextStyle(fontSize: 7),
                              ),
                              pw.Text(
                                AppConstants.formatCurrency(item.total),
                                style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
                              ),
                            ],
                          ),
                          if (item.remise > 0) ...[
                            pw.Row(
                              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                              children: [
                                pw.Text('Remise:', style: const pw.TextStyle(fontSize: 6.5)),
                                pw.Text('-${AppConstants.formatCurrency(item.remise)}', style: const pw.TextStyle(fontSize: 6.5)),
                              ],
                            ),
                          ],
                        ],
                      ),
                    );
                  }),

                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 0.5, borderStyle: pw.BorderStyle.dashed),

                  // Totaux
                  if (data.remiseGlobale > 0 || data.sousTotal != data.total) ...[
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Sous-total:', style: const pw.TextStyle(fontSize: 7.5)),
                        pw.Text(AppConstants.formatCurrency(data.sousTotal), style: const pw.TextStyle(fontSize: 7.5)),
                      ],
                    ),
                  ],
                  if (data.remiseGlobale > 0) ...[
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Remise globale:', style: const pw.TextStyle(fontSize: 7.5)),
                        pw.Text('-${AppConstants.formatCurrency(data.remiseGlobale)}', style: const pw.TextStyle(fontSize: 7.5)),
                      ],
                    ),
                  ],
                  pw.SizedBox(height: 2),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('TOTAL:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                      pw.Text(
                        AppConstants.formatCurrency(data.total),
                        style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                      ),
                    ],
                  ),

                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 0.5, borderStyle: pw.BorderStyle.dashed),

                  // Détail paiement
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Paiement:', style: const pw.TextStyle(fontSize: 7.5)),
                      pw.Text(data.modePaiement, style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
                    ],
                  ),
                  if (data.montantRecu != null && data.montantRecu! > 0) ...[
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Reçu (Espèces):', style: const pw.TextStyle(fontSize: 7.5)),
                        pw.Text(AppConstants.formatCurrency(data.montantRecu!), style: const pw.TextStyle(fontSize: 7.5)),
                      ],
                    ),
                    if (data.monnaieRendue != null && data.monnaieRendue! > 0) ...[
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                        children: [
                          pw.Text('Monnaie rendue:', style: const pw.TextStyle(fontSize: 7.5)),
                          pw.Text(AppConstants.formatCurrency(data.monnaieRendue!), style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
                        ],
                      ),
                    ],
                  ],

                  pw.SizedBox(height: 8),
                  pw.Text(
                    'Merci pour votre visite !',
                    style: const pw.TextStyle(fontSize: 7.5),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.Text(
                    'thefairycrocheter.fr',
                    style: const pw.TextStyle(fontSize: 6.5),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 12),
                ],
              ),
            );
          },
        ),
      );

      // Envoi direct à l'imprimante
      return await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => doc.save(),
        name: 'Ticket_${data.numeroVente}',
      );
    } catch (_) {
      return false;
    }
  }

  // ─── GÉNÉRATION OCTETS ESC/POS 58MM ──────────────────────────────────────────
  // Pour connexion directe Bluetooth, USB ou Socket
  static Future<List<int>> generateEscPos58(ReceiptData data) async {
    final profile = await CapabilityProfile.load();
    final generator = Generator(PaperSize.mm58, profile);
    List<int> bytes = [];

    bytes += generator.reset();
    bytes += generator.text(
      'THE FAIRY CROCHETER',
      styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size1, width: PosTextSize.size1),
    );
    bytes += generator.text('Boutique de crochet & accessoires', styles: const PosStyles(align: PosAlign.center));
    bytes += generator.feed(1);
    bytes += generator.hr();

    bytes += generator.row([
      PosColumn(text: 'Ticket:', width: 4),
      PosColumn(text: data.numeroVente, width: 8, styles: const PosStyles(align: PosAlign.right, bold: true)),
    ]);
    bytes += generator.row([
      PosColumn(text: 'Date:', width: 4),
      PosColumn(text: AppConstants.formatDateTime(data.date), width: 8, styles: const PosStyles(align: PosAlign.right)),
    ]);
    bytes += generator.row([
      PosColumn(text: 'Caissier:', width: 4),
      PosColumn(text: data.caissierNom, width: 8, styles: const PosStyles(align: PosAlign.right)),
    ]);
    if (data.clientNom != null && data.clientNom!.isNotEmpty) {
      bytes += generator.row([
        PosColumn(text: 'Client:', width: 4),
        PosColumn(text: data.clientNom!, width: 8, styles: const PosStyles(align: PosAlign.right, bold: true)),
      ]);
    }
    bytes += generator.hr();

    // Articles
    for (final item in data.items) {
      final desc = item.couleur != null ? '${item.nom} (${item.couleur})' : item.nom;
      bytes += generator.text(desc, styles: const PosStyles(bold: true));
      bytes += generator.row([
        PosColumn(text: '${item.quantite}x ${item.prixUnitaire.toInt()}', width: 6),
        PosColumn(text: '${item.total.toInt()} XAF', width: 6, styles: const PosStyles(align: PosAlign.right)),
      ]);
    }

    bytes += generator.hr();
    bytes += generator.row([
      PosColumn(text: 'TOTAL', width: 6, styles: const PosStyles(bold: true)),
      PosColumn(text: '${data.total.toInt()} XAF', width: 6, styles: const PosStyles(align: PosAlign.right, bold: true)),
    ]);
    bytes += generator.row([
      PosColumn(text: 'Mode:', width: 6),
      PosColumn(text: data.modePaiement, width: 6, styles: const PosStyles(align: PosAlign.right)),
    ]);

    if (data.montantRecu != null && data.montantRecu! > 0) {
      bytes += generator.row([
        PosColumn(text: 'Recu:', width: 6),
        PosColumn(text: '${data.montantRecu!.toInt()} XAF', width: 6, styles: const PosStyles(align: PosAlign.right)),
      ]);
      if (data.monnaieRendue != null && data.monnaieRendue! > 0) {
        bytes += generator.row([
          PosColumn(text: 'Monnaie:', width: 6, styles: const PosStyles(bold: true)),
          PosColumn(text: '${data.monnaieRendue!.toInt()} XAF', width: 6, styles: const PosStyles(align: PosAlign.right, bold: true)),
        ]);
      }
    }

    bytes += generator.feed(1);
    bytes += generator.text('Merci pour votre visite !', styles: const PosStyles(align: PosAlign.center));
    bytes += generator.feed(2);
    bytes += generator.cut();

    return bytes;
  }
}
