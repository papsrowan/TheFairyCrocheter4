class Client {
  final String id;
  final String nom;
  final String? prenom;
  final String? telephone;
  final String? email;
  final double totalAchats;

  Client({
    required this.id,
    required this.nom,
    this.prenom,
    this.telephone,
    this.email,
    required this.totalAchats,
  });

  String get nomComplet {
    if (prenom != null && prenom!.isNotEmpty) {
      return '$prenom $nom'.trim();
    }
    return nom;
  }

  factory Client.fromJson(Map<String, dynamic> json) {
    return Client(
      id: json['id'] as String? ?? '',
      nom: json['nom'] as String? ?? '',
      prenom: json['prenom'] as String?,
      telephone: json['telephone'] as String?,
      email: json['email'] as String?,
      totalAchats: (json['totalAchats'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'nom': nom,
    'prenom': prenom,
    'telephone': telephone,
    'email': email,
    'totalAchats': totalAchats,
  };
}
