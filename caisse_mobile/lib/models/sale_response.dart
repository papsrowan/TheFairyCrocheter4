class SaleResponse {
  final String id;
  final String numero;

  SaleResponse({
    required this.id,
    required this.numero,
  });

  factory SaleResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return SaleResponse(
      id: data['id'] as String? ?? '',
      numero: data['numero'] as String? ?? '',
    );
  }
}
