class User {
  final String id;
  final String email;
  final String nom;
  final String prenom;
  final String role;

  User({
    required this.id,
    required this.email,
    required this.nom,
    required this.prenom,
    required this.role,
  });

  String get nomComplet => '$prenom $nom'.trim();

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      nom: json['nom'] as String? ?? '',
      prenom: json['prenom'] as String? ?? '',
      role: json['role'] as String? ?? 'CAISSIER',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'nom': nom,
    'prenom': prenom,
    'role': role,
  };
}
