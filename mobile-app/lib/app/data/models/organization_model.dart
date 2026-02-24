class OrganizationModel {
  final String id;
  final String name;
  final String? code;
  final String? email;
  final String? phone;
  final String? address;
  final String? logo;
  final String? currency;
  final String? currencySymbol;
  final bool isActive;
  final DateTime? createdAt;

  OrganizationModel({
    required this.id,
    required this.name,
    this.code,
    this.email,
    this.phone,
    this.address,
    this.logo,
    this.currency = 'USD',
    this.currencySymbol = '\$',
    this.isActive = true,
    this.createdAt,
  });

  factory OrganizationModel.fromJson(Map<String, dynamic> json) {
    return OrganizationModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      code: json['code'],
      email: json['email'],
      phone: json['phone'],
      address: json['address'],
      logo: json['logo'],
      currency: json['currency'] ?? 'USD',
      currencySymbol: json['currency_symbol'] ?? json['currencySymbol'] ?? '\$',
      isActive: json['is_active'] ?? json['isActive'] ?? true,
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'email': email,
      'phone': phone,
      'address': address,
      'logo': logo,
      'currency': currency,
      'currency_symbol': currencySymbol,
      'is_active': isActive,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
