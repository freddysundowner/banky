class MemberModel {
  final String id;
  final String memberId;
  final String firstName;
  final String lastName;
  final String email;
  final String? phone;
  final String? idNumber;
  final String? address;
  final String? avatar;
  final double savingsBalance;
  final double sharesBalance;
  final double loanBalance;
  final bool isActive;
  final DateTime? joinDate;
  final DateTime? createdAt;

  MemberModel({
    required this.id,
    required this.memberId,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.phone,
    this.idNumber,
    this.address,
    this.avatar,
    this.savingsBalance = 0.0,
    this.sharesBalance = 0.0,
    this.loanBalance = 0.0,
    this.isActive = true,
    this.joinDate,
    this.createdAt,
  });

  String get fullName => '$firstName $lastName';
  String get initials => '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();
  double get totalBalance => savingsBalance + sharesBalance;

  factory MemberModel.fromJson(Map<String, dynamic> json) {
    return MemberModel(
      id: json['id']?.toString() ?? '',
      memberId: json['member_id'] ?? json['memberId'] ?? '',
      firstName: json['first_name'] ?? json['firstName'] ?? '',
      lastName: json['last_name'] ?? json['lastName'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'],
      idNumber: json['id_number'] ?? json['idNumber'],
      address: json['address'],
      avatar: json['avatar'],
      savingsBalance: (json['savings_balance'] ?? json['savingsBalance'] ?? 0).toDouble(),
      sharesBalance: (json['shares_balance'] ?? json['sharesBalance'] ?? 0).toDouble(),
      loanBalance: (json['loan_balance'] ?? json['loanBalance'] ?? 0).toDouble(),
      isActive: json['is_active'] ?? json['isActive'] ?? true,
      joinDate: json['join_date'] != null ? DateTime.parse(json['join_date']) : null,
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'member_id': memberId,
      'first_name': firstName,
      'last_name': lastName,
      'email': email,
      'phone': phone,
      'id_number': idNumber,
      'address': address,
      'avatar': avatar,
      'savings_balance': savingsBalance,
      'shares_balance': sharesBalance,
      'loan_balance': loanBalance,
      'is_active': isActive,
      'join_date': joinDate?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
