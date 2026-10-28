import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
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
  final String? notes;

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
    this.notes,
  });

  String get formattedModePaiement {
    switch (modePaiement.toUpperCase()) {
      case 'ESPECES':
        return 'Espèces';
      case 'CARTE':
        return 'Carte bancaire';
      case 'VIREMENT':
        return 'Virement';
      case 'CHEQUE':
        return 'Chèque';
      case 'MIXTE':
        return 'Paiement mixte';
      case 'CREDIT':
        return 'À crédit / Différé';
      default:
        return modePaiement;
    }
  }
}

class PrinterService {
  static const MethodChannel _nativeChannel =
      MethodChannel('com.thefairycrocheter.pos/scanner_config');

  /// Nettoie le nom de l'article en supprimant strictement tout détail ou parenthèse
  /// indiquant la couleur (ex: 'Pelote Coton (Bleu)' devient 'Pelote Coton').
  static String cleanItemTitle(CartItem item) {
    final name = item.nom
        .replaceAll(RegExp(r'\s*\(.*?\)'), '')
        .replaceAll(RegExp(r'\s*#[0-9a-fA-F]{3,8}'), '')
        .trim();
    return name.isNotEmpty ? name : item.nom;
  }

  static bool isHexColor(String str) {
    final s = str.trim();
    return RegExp(r'^#?[0-9a-fA-F]{3,8}$').hasMatch(s);
  }

  /// ─── IMPRESSION HARDWARE DIRECTE (PORTS SÉRIES ESC/POS / DEV / BROADCAST) ───
  /// Envoie le flux d'octets ESC/POS directement aux périphériques thermiques internes
  static Future<bool> printReceiptDirectHardware(ReceiptData data) async {
    try {
      final bytes = await generateEscPos58(data);
      final res = await _nativeChannel.invokeMethod<bool>(
        'printRawEscPos',
        {'bytes': Uint8List.fromList(bytes)},
      );
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  /// ─── IMPRESSION UNIFIÉE INTELLIGENTE (AUTO HARDWARE -> FALLBACK SPOOLER) ────
  static Future<bool> printReceiptSmart(ReceiptData data, {String? mode}) async {
    // Si le mode 'esc_pos' est explicitement configuré, tenter le matériel direct
    if (mode == 'esc_pos') {
      final hwOk = await printReceiptDirectHardware(data);
      if (hwOk) return true;
    }

    // Par défaut et pour le terminal POS (service 'LocalPrinter' 58mm),
    // on utilise l'impression native système garantie :
    return await printReceiptNative(data);
  }

  // ─── IMPRESSION ANDROID DIRECTE (SPOOLER / SERVICE SYSTÈME) ─────────────────
  // Imprime sur l'imprimante thermique par défaut du terminal POS Android (localPrinter)
  // Format et graphisme identiques au ticket officiel du site web (ticketTemplate.tsx)
  static Future<bool> printReceiptNative(ReceiptData data) async {
    try {
      final doc = pw.Document();

      // Charger le logo officiel (assets/images/logo.png)
      pw.MemoryImage? logoImage;
      try {
        final logoBytes = await rootBundle.load('assets/images/logo.png');
        logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
      } catch (e) {
        debugPrint('Logo load error: $e');
      }

      final int barcodesCount = data.items.where((it) => it.codeBarres != null && it.codeBarres!.isNotEmpty).length;
      final double calculatedHeightMm = (165.0 +
              (data.items.length * 18.0) +
              (barcodesCount * 8.0) +
              (data.remiseGlobale > 0 ? 12.0 : 0.0) +
              (data.montantRecu != null ? 18.0 : 0.0) +
              (data.notes != null ? 10.0 : 0.0))
          .clamp(185.0, 950.0);

      final pageFormat = PdfPageFormat(
        58 * PdfPageFormat.mm,
        calculatedHeightMm * PdfPageFormat.mm,
        marginAll: 1.5 * PdfPageFormat.mm,
      );

      pw.ThemeData? unicodeTheme;
      try {
        final fontRegular = await PdfGoogleFonts.robotoRegular();
        final fontBold = await PdfGoogleFonts.robotoBold();
        unicodeTheme = pw.ThemeData.withFont(
          base: fontRegular,
          bold: fontBold,
        );
      } catch (_) {}

      doc.addPage(
        pw.Page(
          theme: unicodeTheme,
          pageFormat: pageFormat,
          build: (pw.Context context) {
            return pw.Container(
              width: double.infinity,
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                mainAxisSize: pw.MainAxisSize.min,
                children: [
                  // Logo de la boutique (identique au site web)
                  if (logoImage != null) ...[
                    pw.Center(
                      child: pw.Image(
                        logoImage,
                        width: 44,
                        height: 44,
                        fit: pw.BoxFit.contain,
                      ),
                    ),
                    pw.SizedBox(height: 3),
                  ],

                  // En-tête officiel
                  pw.Text(
                    'THE FAIRY CROCHETER',
                    style: pw.TextStyle(
                      fontSize: 12.5,
                      fontWeight: pw.FontWeight.bold,
                    ),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 1),
                  pw.Text(
                    'Akwa à la borne fontaine bebe-eyidi face la clinique le gros chêne.',
                    style: const pw.TextStyle(fontSize: 7.5),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.Text(
                    '15521 Douala',
                    style: const pw.TextStyle(fontSize: 7.5),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.Text(
                    '+237 676996717',
                    style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 0.8, borderStyle: pw.BorderStyle.dashed, color: PdfColors.grey600),

                  // Infos ticket
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Ticket', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
                      pw.Text(data.numeroVente, style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                    ],
                  ),
                  pw.SizedBox(height: 1),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Date', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
                      pw.Text(AppConstants.formatDateTime(data.date), style: const pw.TextStyle(fontSize: 8.5)),
                    ],
                  ),
                  pw.SizedBox(height: 1),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Vendeur', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
                      pw.Text(data.caissierNom, style: const pw.TextStyle(fontSize: 8.5)),
                    ],
                  ),
                  if (data.clientNom != null && data.clientNom!.trim().isNotEmpty) ...[
                    pw.SizedBox(height: 1),
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Client', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
                        pw.Text(data.clientNom!, style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                      ],
                    ),
                  ],

                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 0.8, borderStyle: pw.BorderStyle.dashed, color: PdfColors.grey600),

                  // Articles
                  ...data.items.map((item) {
                    final desc = cleanItemTitle(item);
                    return pw.Padding(
                      padding: const pw.EdgeInsets.symmetric(vertical: 2.0),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            desc,
                            style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold),
                            maxLines: 2,
                          ),
                          pw.SizedBox(height: 1),
                          pw.Row(
                            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                            children: [
                              pw.Text(
                                '${item.quantite} × ${AppConstants.formatCurrency(item.prixUnitaire)}${item.remise > 0 ? '  -${item.remise.toInt()} XAF' : ''}',
                                style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey800),
                              ),
                              pw.Text(
                                AppConstants.formatCurrency(item.total),
                                style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold),
                              ),
                            ],
                          ),
                          // Code-barres individuel de l'article (si disponible comme sur le web)
                          if (item.codeBarres != null && item.codeBarres!.trim().isNotEmpty) ...[
                            pw.Padding(
                              padding: const pw.EdgeInsets.only(top: 2, bottom: 2),
                              child: pw.Column(
                                crossAxisAlignment: pw.CrossAxisAlignment.start,
                                children: [
                                  pw.BarcodeWidget(
                                    barcode: pw.Barcode.code128(),
                                    data: item.codeBarres!,
                                    width: 85,
                                    height: 16,
                                    drawText: false,
                                  ),
                                  pw.Text(
                                    item.codeBarres!,
                                    style: const pw.TextStyle(fontSize: 6, color: PdfColors.grey700),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  }),

                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 0.8, borderStyle: pw.BorderStyle.dashed, color: PdfColors.grey600),

                  // Totaux
                  if (data.remiseGlobale > 0 || data.sousTotal != data.total) ...[
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Sous-total', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
                        pw.Text(AppConstants.formatCurrency(data.sousTotal), style: const pw.TextStyle(fontSize: 8.5)),
                      ],
                    ),
                  ],
                  if (data.remiseGlobale > 0) ...[
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Remise globale', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.green700)),
                        pw.Text('-${AppConstants.formatCurrency(data.remiseGlobale)}', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.green700)),
                      ],
                    ),
                  ],

                  // Cadre TOTAL avec ligne supérieure
                  pw.Container(
                    margin: const pw.EdgeInsets.only(top: 3),
                    padding: const pw.EdgeInsets.only(top: 4),
                    decoration: const pw.BoxDecoration(
                      border: pw.Border(top: pw.BorderSide(width: 1.5, color: PdfColors.black)),
                    ),
                    child: pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('TOTAL', style: pw.TextStyle(fontSize: 12.5, fontWeight: pw.FontWeight.bold)),
                        pw.Text(
                          AppConstants.formatCurrency(data.total),
                          style: pw.TextStyle(fontSize: 12.5, fontWeight: pw.FontWeight.bold),
                        ),
                      ],
                    ),
                  ),

                  // Détail paiement
                  pw.SizedBox(height: 4),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Paiement', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
                      pw.Text(data.formattedModePaiement, style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                    ],
                  ),
                  if (data.montantRecu != null && data.montantRecu! > 0) ...[
                    pw.SizedBox(height: 1),
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text('Reçu (Espèces)', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700)),
                        pw.Text(AppConstants.formatCurrency(data.montantRecu!), style: const pw.TextStyle(fontSize: 8.5)),
                      ],
                    ),
                    if (data.monnaieRendue != null && data.monnaieRendue! > 0) ...[
                      pw.SizedBox(height: 1),
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                        children: [
                          pw.Text('Monnaie rendue', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                          pw.Text(AppConstants.formatCurrency(data.monnaieRendue!), style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold)),
                        ],
                      ),
                    ],
                  ],

                  if (data.notes != null && data.notes!.trim().isNotEmpty) ...[
                    pw.SizedBox(height: 3),
                    pw.Align(
                      alignment: pw.Alignment.centerLeft,
                      child: pw.Text('Notes : ${data.notes!}', style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700)),
                    ),
                  ],

                  pw.SizedBox(height: 5),
                  pw.Divider(thickness: 0.8, borderStyle: pw.BorderStyle.dashed, color: PdfColors.grey600),

                  // Code-barres du ticket (comme sur le site web)
                  pw.Padding(
                    padding: const pw.EdgeInsets.symmetric(vertical: 4),
                    child: pw.Column(
                      children: [
                        pw.BarcodeWidget(
                          barcode: pw.Barcode.code128(),
                          data: data.numeroVente,
                          width: 130,
                          height: 26,
                          drawText: false,
                        ),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          data.numeroVente,
                          style: pw.TextStyle(
                            fontSize: 7.5,
                            fontWeight: pw.FontWeight.bold,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Mentions légales sous le code-barres
                  pw.SizedBox(height: 5),
                  pw.Text(
                    'Après validation de la facture ou de la commande, aucun changement de couleur,model, ou reference ne sera accepté. Ls articles vendus ne sont ni repris ni remboursés.',
                    style: const pw.TextStyle(fontSize: 6.8, color: PdfColors.grey800),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text(
                    'Merci pour votre confiance',
                    style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    "conservez ce ticket comme preuve d'achat.",
                    style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 12),
                ],
              ),
            );
          },
        ),
      );

      // Envoi direct au service d'impression
      return await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => doc.save(),
        name: 'Ticket_${data.numeroVente}',
      );
    } catch (e, stack) {
      debugPrint('Printing error: $e\n$stack');
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
      styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2, width: PosTextSize.size1),
    );
    bytes += generator.text('Akwa a la borne fontaine bebe-eyidi', styles: const PosStyles(align: PosAlign.center));
    bytes += generator.text('face la clinique le gros chene.', styles: const PosStyles(align: PosAlign.center));
    bytes += generator.text('15521 Douala - +237 676996717', styles: const PosStyles(align: PosAlign.center, bold: true));
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
      final desc = cleanItemTitle(item);
      bytes += generator.text(desc, styles: const PosStyles(bold: true));
      bytes += generator.row([
        PosColumn(text: '${item.quantite}x ${item.prixUnitaire.toInt()}', width: 6),
        PosColumn(text: '${item.total.toInt()} XAF', width: 6, styles: const PosStyles(align: PosAlign.right, bold: true)),
      ]);
    }

    bytes += generator.hr();
    bytes += generator.row([
      PosColumn(text: 'TOTAL', width: 5, styles: const PosStyles(bold: true, height: PosTextSize.size2)),
      PosColumn(text: '${data.total.toInt()} XAF', width: 7, styles: const PosStyles(align: PosAlign.right, bold: true, height: PosTextSize.size2)),
    ]);
    bytes += generator.row([
      PosColumn(text: 'Mode:', width: 6),
      PosColumn(text: data.formattedModePaiement, width: 6, styles: const PosStyles(align: PosAlign.right, bold: true)),
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
    bytes += generator.text('Apres validation de la facture ou de la commande, aucun changement de couleur,model, ou reference ne sera accepte. Ls articles vendus ne sont ni repris ni rembourses.', styles: const PosStyles(align: PosAlign.center));
    bytes += generator.feed(1);
    bytes += generator.text('Merci pour votre confiance', styles: const PosStyles(align: PosAlign.center, bold: true));
    bytes += generator.text("conservez ce ticket comme preuve d'achat.", styles: const PosStyles(align: PosAlign.center));
    bytes += generator.feed(2);
    bytes += generator.cut();

    return bytes;
  }
}
