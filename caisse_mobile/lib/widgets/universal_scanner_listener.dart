import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Ce composant intercepte les événements de frappe matérielle du scanner
/// lorsqu'il fonctionne en mode "Keyboard Wedge / Émulation Clavier".
/// Les lecteurs laser injectent généralement les caractères en moins de 50ms,
/// suivis d'un caractère de validation (Entrée / Tabulation).
class UniversalScannerListener extends StatefulWidget {
  final Widget child;
  final Function(String barcode) onBarcodeScanned;

  const UniversalScannerListener({
    super.key,
    required this.child,
    required this.onBarcodeScanned,
  });

  @override
  State<UniversalScannerListener> createState() => _UniversalScannerListenerState();
}

class _UniversalScannerListenerState extends State<UniversalScannerListener> {
  final FocusNode _focusNode = FocusNode();
  final StringBuffer _buffer = StringBuffer();
  DateTime _lastKeyEventTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  void _handleKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return;

    final now = DateTime.now();
    final elapsed = now.difference(_lastKeyEventTime).inMilliseconds;
    _lastKeyEventTime = now;

    // Si plus de 500ms s'est écoulé depuis la dernière touche, réinitialiser le buffer
    if (elapsed > 500) {
      _buffer.clear();
    }

    if (event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.numpadEnter ||
        event.logicalKey == LogicalKeyboardKey.tab) {
      final code = _buffer.toString().trim();
      _buffer.clear();
      if (code.isNotEmpty) {
        widget.onBarcodeScanned(code);
      }
      return;
    }

    // Caractères imprimables
    final char = event.character;
    if (char != null && char.isNotEmpty) {
      _buffer.write(char);
    }
  }

  @override
  Widget build(BuildContext context) {
    return KeyboardListener(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _handleKeyEvent,
      child: widget.child,
    );
  }
}
