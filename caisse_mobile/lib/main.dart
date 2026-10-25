import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'config/theme.dart';
import 'config/constants.dart';
import 'services/storage_service.dart';
import 'services/scanner_service.dart';
import 'services/api_service.dart';
import 'providers/auth_provider.dart';
import 'providers/catalog_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/terminal_settings_provider.dart';
import 'providers/sales_history_provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'screens/login_screen.dart';
import 'screens/pos_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr_FR', null);

  // Bloquer l'orientation en portrait pour les terminaux de poche POS
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  final storageService = StorageService();
  await storageService.init();

  final scannerService = ScannerService();
  final apiService = ApiService(storageService: storageService);

  runApp(
    CaisseApp(
      storageService: storageService,
      scannerService: scannerService,
      apiService: apiService,
    ),
  );
}

class CaisseApp extends StatelessWidget {
  final StorageService storageService;
  final ScannerService scannerService;
  final ApiService apiService;

  const CaisseApp({
    super.key,
    required this.storageService,
    required this.scannerService,
    required this.apiService,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<StorageService>.value(value: storageService),
        Provider<ScannerService>.value(value: scannerService),
        Provider<ApiService>.value(value: apiService),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(
            apiService: apiService,
            storageService: storageService,
          ),
        ),
        ChangeNotifierProvider(
          create: (_) => CatalogProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => CartProvider(),
        ),
        ChangeNotifierProvider(
          create: (_) => TerminalSettingsProvider(
            storageService: storageService,
            scannerService: scannerService,
          ),
        ),
        ChangeNotifierProvider(
          create: (_) => SalesHistoryProvider(apiService: apiService),
        ),
      ],
      child: MaterialApp(
        title: AppConstants.appTitle,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isAuthenticated) {
      return const PosScreen();
    }
    return const LoginScreen();
  }
}
