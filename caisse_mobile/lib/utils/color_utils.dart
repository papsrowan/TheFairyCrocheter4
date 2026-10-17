import 'package:flutter/material.dart';

class ColorUtils {
  // Dictionnaire des noms de couleurs courants (Français et Anglais)
  static final Map<String, Color> _knownColors = {
    // Rouge / Rose / Bordeaux
    'rouge': const Color(0xFFE53935),
    'red': const Color(0xFFE53935),
    'bordeaux': const Color(0xFF880E4F),
    'burgundy': const Color(0xFF880E4F),
    'rose': const Color(0xFFEC407A),
    'pink': const Color(0xFFEC407A),
    'rose pale': const Color(0xFFF8BBD0),
    'rose poudré': const Color(0xFFF48FB1),
    'fuchsia': const Color(0xFFD81B60),
    'magenta': const Color(0xFFC2185B),
    'corail': const Color(0xFFFF7043),
    'coral': const Color(0xFFFF7043),
    'saumon': const Color(0xFFFA8072),
    'salmon': const Color(0xFFFA8072),

    // Bleu
    'bleu': const Color(0xFF1E88E5),
    'blue': const Color(0xFF1E88E5),
    'bleu ciel': const Color(0xFF81D4FA),
    'sky blue': const Color(0xFF81D4FA),
    'bleu marine': const Color(0xFF1A237E),
    'navy': const Color(0xFF1A237E),
    'bleu roi': const Color(0xFF2962FF),
    'bleu canard': const Color(0xFF00695C),
    'turquoise': const Color(0xFF00ACC1),
    'indigo': const Color(0xFF3F51B5),

    // Vert
    'vert': const Color(0xFF43A047),
    'green': const Color(0xFF43A047),
    'vert clair': const Color(0xFF81C784),
    'light green': const Color(0xFF81C784),
    'vert pomme': const Color(0xFF8BC34A),
    'lime': const Color(0xFFCDDC39),
    'vert émeraude': const Color(0xFF00897B),
    'emeraude': const Color(0xFF00897B),
    'kaki': const Color(0xFF689F38),
    'khaki': const Color(0xFF689F38),
    'vert olive': const Color(0xFF558B2F),
    'olive': const Color(0xFF558B2F),
    'menthe': const Color(0xFFA7FFEB),
    'mint': const Color(0xFFA7FFEB),

    // Jaune / Orange
    'jaune': const Color(0xFFFDD835),
    'yellow': const Color(0xFFFDD835),
    'jaune moutarde': const Color(0xFFD97706),
    'moutarde': const Color(0xFFD97706),
    'mustard': const Color(0xFFD97706),
    'orange': const Color(0xFFFB8C00),
    'pêche': const Color(0xFFFFCC80),
    'peach': const Color(0xFFFFCC80),
    'ocre': const Color(0xFFC17F24),
    'ambre': const Color(0xFFFFB300),
    'amber': const Color(0xFFFFB300),

    // Violet / Mauve
    'violet': const Color(0xFF8E24AA),
    'purple': const Color(0xFF8E24AA),
    'lilas': const Color(0xFFBA68C8),
    'lilac': const Color(0xFFBA68C8),
    'mauve': const Color(0xFFCE93D8),
    'lavande': const Color(0xFF9FA8DA),
    'lavender': const Color(0xFF9FA8DA),
    'prune': const Color(0xFF4A148C),

    // Neutres / Terre
    'marron': const Color(0xFF6D4C41),
    'brown': const Color(0xFF6D4C41),
    'chocolat': const Color(0xFF4E342E),
    'caramel': const Color(0xFFA16207),
    'beige': const Color(0xFFD7CCC8),
    'crème': const Color(0xFFFFFDD0),
    'cream': const Color(0xFFFFFDD0),
    'blanc': const Color(0xFFFFFFFF),
    'white': const Color(0xFFFFFFFF),
    'noir': const Color(0xFF212121),
    'black': const Color(0xFF212121),
    'gris': const Color(0xFF9E9E9E),
    'grey': const Color(0xFF9E9E9E),
    'gray': const Color(0xFF9E9E9E),
    'gris clair': const Color(0xFFE0E0E0),
    'gris anthracite': const Color(0xFF424242),
    'anthracite': const Color(0xFF37474F),
    'argent': const Color(0xFFB0BEC5),
    'silver': const Color(0xFFB0BEC5),
    'or': const Color(0xFFFFD700),
    'gold': const Color(0xFFFFD700),
  };

  /// Convertit une chaîne de couleur (ex: "#FF5722", "Rouge (#E53E3E)", "Bleu marine", "01-Moutarde")
  /// en un objet Color Flutter exploitable.
  static Color parseColor(String? colorStr) {
    if (colorStr == null || colorStr.trim().isEmpty) {
      return const Color(0xFFBDBDBD);
    }

    final raw = colorStr.trim();

    // 1. Chercher un code hexadécimal dans la chaîne (ex: "#C17F24", "#FFF", "C17F24")
    final hexRegex = RegExp(r'#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})');
    final match = hexRegex.firstMatch(raw);
    if (match != null) {
      String hex = match.group(0)!.replaceAll('#', '');
      if (hex.length == 6) {
        hex = 'FF$hex';
      }
      final intVal = int.tryParse(hex, radix: 16);
      if (intVal != null) {
        return Color(intVal);
      }
    }

    // 2. Normalisation du texte pour recherche dans le dictionnaire
    final cleaned = raw.toLowerCase()
        .replaceAll(RegExp(r'\(.*?\)'), '') // Supprimer parenthèses
        .replaceAll(RegExp(r'\[.*?\]'), '')
        .replaceAll(RegExp(r'^[0-9]+[-_\s]*'), '') // Supprimer numéro de référence initial
        .trim();

    // Recherche exacte
    if (_knownColors.containsKey(cleaned)) {
      return _knownColors[cleaned]!;
    }

    // Recherche par mot clé partiel (ex: "laine rouge" → "rouge")
    for (final entry in _knownColors.entries) {
      if (cleaned.contains(entry.key)) {
        return entry.value;
      }
    }

    // 3. Fallback : générer une couleur pastel élégante basée sur le hash du nom
    final hash = raw.codeUnits.fold(0, (prev, elem) => prev + elem);
    final hue = (hash * 137.5) % 360; // Nombre d'or pour bonne répartition
    return HSLColor.fromAHSL(1.0, hue, 0.65, 0.55).toColor();
  }

  /// Indique si la couleur est claire (nécessite une bordure sombre pour être visible sur blanc)
  static bool isLightColor(Color color) {
    return color.computeLuminance() > 0.75;
  }
}
