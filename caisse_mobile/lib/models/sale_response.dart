class SaleResponse {
  final String id;
  final String numero;
  final bool isOffline;

  SaleResponse({
    required this.id,
    required this.numero,
    this.isOffline = false,
  });

  factory SaleResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return SaleResponse(
      id: data['id'] as String? ?? '',
      numero: data['numero'] as String? ?? '',
      isOffline: json['isOffline'] as bool? ?? false,
    );
  }
}
