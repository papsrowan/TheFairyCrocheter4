import 'package:dio/dio.dart';
import '../models/product.dart';
import '../models/client.dart';
import '../models/user.dart';
import '../models/sale_response.dart';
import 'storage_service.dart';

class ApiService {
  final StorageService storageService;
  late Dio _dio;

  ApiService({required this.storageService}) {
    _initDio();
  }

  void _initDio() {
    _dio = Dio(
      BaseOptions(
        baseUrl: storageService.getBaseUrl(),
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = storageService.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  void updateBaseUrl() {
    _initDio();
  }

  // ─── AUTHENTIFICATION ────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _dio.post(
        '/api/auth/mobile-login',
        data: {'email': email.trim(), 'password': password},
      );

      final data = res.data as Map<String, dynamic>;
      final token = data['token'] as String;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);

      await storageService.setToken(token);
      await storageService.setUser(user);

      return {'success': true, 'user': user, 'token': token};
    } on DioException catch (e) {
      final msg = e.response?.data?['error'] ?? 'Échec de connexion au serveur (${e.message})';
      throw Exception(msg);
    }
  }

  // ─── CATALOGUE PRODUITS ──────────────────────────────────────────────────────

  Future<List<Product>> searchProducts({
    String query = '',
    int limit = 24,
    bool all = false,
  }) async {
    try {
      final params = <String, dynamic>{
        'limit': limit,
      };
      if (all || query.isEmpty) {
        params['all'] = 1;
        params['q'] = '';
      } else {
        params['q'] = query;
      }

      final res = await _dio.get('/api/produits/search', queryParameters: params);
      final rawList = res.data['data'] as List? ?? [];
      return rawList
          .map((item) => Product.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      final msg = e.response?.data?['error'] ?? 'Erreur lors du chargement des produits';
      throw Exception(msg);
    }
  }

  // ─── CLIENTS ─────────────────────────────────────────────────────────────────

  Future<List<Client>> searchClients(String query) async {
    if (query.trim().isEmpty) return [];
    try {
      final res = await _dio.get(
        '/api/clients',
        queryParameters: {'search': query, 'pageSize': 10},
      );
      final rawList = res.data['data'] as List? ?? [];
      return rawList
          .map((item) => Client.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      final msg = e.response?.data?['error'] ?? 'Erreur de recherche client';
      throw Exception(msg);
    }
  }

  Future<Client> createClient({
    required String nom,
    String? prenom,
    String? telephone,
    String? email,
  }) async {
    try {
      final res = await _dio.post(
        '/api/clients',
        data: {
          'nom': nom.trim(),
          if (prenom != null && prenom.trim().isNotEmpty) 'prenom': prenom.trim(),
          if (telephone != null && telephone.trim().isNotEmpty) 'telephone': telephone.trim(),
          if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
        },
      );
      final data = res.data['data'] as Map<String, dynamic>;
      return Client.fromJson(data);
    } on DioException catch (e) {
      final msg = e.response?.data?['error'] ?? 'Erreur lors de la création du client';
      throw Exception(msg);
    }
  }

  // ─── VENTES ──────────────────────────────────────────────────────────────────

  Future<SaleResponse> createSale(Map<String, dynamic> payload) async {
    try {
      final res = await _dio.post('/api/ventes', data: payload);
      return SaleResponse.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['error'] ?? 'Erreur lors de l\'enregistrement de la vente';
      throw Exception(msg);
    }
  }

  // ─── SYNCHRONISATION OFFLINE ─────────────────────────────────────────────────

  Future<bool> syncOfflineSales(List<Map<String, dynamic>> actions) async {
    if (actions.isEmpty) return true;
    try {
      final res = await _dio.post(
        '/api/sync',
        data: {'actions': actions},
      );
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
