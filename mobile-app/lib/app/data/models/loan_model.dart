enum LoanStatus { pending, approved, disbursed, active, completed, defaulted, rejected, cancelled }

class LoanModel {
  final String id;
  final String? loanNumber;
  final String loanProductId;
  final String? loanProductName;
  final double principalAmount;
  final double interestRate;
  final int termMonths;
  final double totalAmount;
  final double amountPaid;
  final double outstandingBalance;
  final double? monthlyPayment;
  final LoanStatus status;
  final DateTime? applicationDate;
  final DateTime? approvalDate;
  final DateTime? disbursementDate;
  final DateTime? maturityDate;
  final DateTime? nextPaymentDate;
  final int? daysOverdue;
  final DateTime? createdAt;
  final List<LoanRepaymentSchedule> repaymentSchedule;

  LoanModel({
    required this.id,
    this.loanNumber,
    required this.loanProductId,
    this.loanProductName,
    required this.principalAmount,
    required this.interestRate,
    required this.termMonths,
    required this.totalAmount,
    this.amountPaid = 0.0,
    required this.outstandingBalance,
    this.monthlyPayment,
    required this.status,
    this.applicationDate,
    this.approvalDate,
    this.disbursementDate,
    this.maturityDate,
    this.nextPaymentDate,
    this.daysOverdue,
    this.createdAt,
    this.repaymentSchedule = const [],
  });

  double get progressPercentage => totalAmount > 0 ? (amountPaid / totalAmount) * 100 : 0;
  bool get isActive => status == LoanStatus.active || status == LoanStatus.disbursed;
  bool get isOverdue => daysOverdue != null && daysOverdue! > 0;

  String get statusLabel {
    switch (status) {
      case LoanStatus.pending:
        return 'Pending';
      case LoanStatus.approved:
        return 'Approved';
      case LoanStatus.disbursed:
        return 'Disbursed';
      case LoanStatus.active:
        return 'Active';
      case LoanStatus.completed:
        return 'Completed';
      case LoanStatus.defaulted:
        return 'Defaulted';
      case LoanStatus.rejected:
        return 'Rejected';
      case LoanStatus.cancelled:
        return 'Cancelled';
    }
  }

  factory LoanModel.fromJson(Map<String, dynamic> json) {
    DateTime? _tryParse(dynamic s) {
      if (s == null) return null;
      try { return DateTime.parse(s.toString()); } catch (_) { return null; }
    }
    int _int(dynamic v) {
      if (v == null) return 0;
      if (v is int) return v;
      return int.tryParse(v.toString()) ?? 0;
    }
    double _dbl(dynamic v) {
      if (v == null) return 0.0;
      if (v is double) return v;
      if (v is int) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0.0;
    }

    final raw = json;
    return LoanModel(
      id: raw['id']?.toString() ?? '',
      loanNumber: raw['loan_number']?.toString() ?? raw['loanNumber']?.toString() ?? raw['application_number']?.toString(),
      loanProductId: raw['loan_product_id']?.toString() ?? raw['loanProductId']?.toString() ?? '',
      loanProductName: raw['loan_product_name']?.toString() ?? raw['loanProductName']?.toString() ?? raw['product_name']?.toString() ?? raw['product']?['name']?.toString(),
      principalAmount: _dbl(raw['principal_amount'] ?? raw['principalAmount'] ?? raw['principal'] ?? raw['amount']),
      interestRate: _dbl(raw['interest_rate'] ?? raw['interestRate']),
      termMonths: _int(raw['term_months'] ?? raw['termMonths'] ?? raw['term']),
      totalAmount: _dbl(raw['total_amount'] ?? raw['totalAmount'] ?? raw['total_repayment']),
      amountPaid: _dbl(raw['amount_paid'] ?? raw['amountPaid'] ?? raw['paid_amount'] ?? raw['amount_repaid']),
      outstandingBalance: _dbl(raw['outstanding_balance'] ?? raw['outstandingBalance'] ?? raw['balance']),
      monthlyPayment: raw['monthly_payment'] != null || raw['monthlyPayment'] != null || raw['monthly_repayment'] != null
          ? _dbl(raw['monthly_payment'] ?? raw['monthlyPayment'] ?? raw['monthly_repayment'])
          : null,
      status: _parseLoanStatus(raw['status']?.toString()),
      applicationDate: _tryParse(raw['application_date'] ?? raw['applied_at']),
      approvalDate: _tryParse(raw['approval_date'] ?? raw['approved_at']),
      disbursementDate: _tryParse(raw['disbursement_date'] ?? raw['disbursed_at']),
      maturityDate: _tryParse(raw['maturity_date']),
      nextPaymentDate: _tryParse(raw['next_payment_date']),
      daysOverdue: raw['days_overdue'] != null ? _int(raw['days_overdue']) : raw['daysOverdue'] != null ? _int(raw['daysOverdue']) : null,
      createdAt: _tryParse(raw['created_at']),
      repaymentSchedule: (raw['repayment_schedule'] as List<dynamic>?)
          ?.map((e) => LoanRepaymentSchedule.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
    );
  }

  static LoanStatus _parseLoanStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return LoanStatus.pending;
      case 'approved':
        return LoanStatus.approved;
      case 'disbursed':
        return LoanStatus.disbursed;
      case 'active':
        return LoanStatus.active;
      case 'completed':
      case 'paid':
        return LoanStatus.completed;
      case 'defaulted':
        return LoanStatus.defaulted;
      case 'rejected':
        return LoanStatus.rejected;
      case 'cancelled':
        return LoanStatus.cancelled;
      default:
        return LoanStatus.pending;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'loan_number': loanNumber,
      'loan_product_id': loanProductId,
      'loan_product_name': loanProductName,
      'principal_amount': principalAmount,
      'interest_rate': interestRate,
      'term_months': termMonths,
      'total_amount': totalAmount,
      'amount_paid': amountPaid,
      'outstanding_balance': outstandingBalance,
      'monthly_payment': monthlyPayment,
      'status': status.name,
      'application_date': applicationDate?.toIso8601String(),
      'approval_date': approvalDate?.toIso8601String(),
      'disbursement_date': disbursementDate?.toIso8601String(),
      'maturity_date': maturityDate?.toIso8601String(),
      'next_payment_date': nextPaymentDate?.toIso8601String(),
      'days_overdue': daysOverdue,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}

class LoanRepaymentSchedule {
  final int installmentNumber;
  final DateTime dueDate;
  final double principalAmount;
  final double interestAmount;
  final double totalAmount;
  final double? paidAmount;
  final bool isPaid;
  final DateTime? paidDate;

  LoanRepaymentSchedule({
    required this.installmentNumber,
    required this.dueDate,
    required this.principalAmount,
    required this.interestAmount,
    required this.totalAmount,
    this.paidAmount,
    this.isPaid = false,
    this.paidDate,
  });

  double get outstandingAmount => isPaid ? 0 : totalAmount - (paidAmount ?? 0);

  factory LoanRepaymentSchedule.fromJson(Map<String, dynamic> json) {
    int _int(dynamic v) => v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;
    double _dbl(dynamic v) {
      if (v == null) return 0.0;
      if (v is double) return v;
      if (v is int) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0.0;
    }
    DateTime? _tryDate(dynamic s) {
      if (s == null) return null;
      try { return DateTime.parse(s.toString()); } catch (_) { return null; }
    }
    return LoanRepaymentSchedule(
      installmentNumber: _int(json['installment_number'] ?? json['installmentNumber'] ?? json['number']),
      dueDate: _tryDate(json['due_date'] ?? json['dueDate']) ?? DateTime.now(),
      principalAmount: _dbl(json['principal_amount'] ?? json['principalAmount'] ?? json['principal']),
      interestAmount: _dbl(json['interest_amount'] ?? json['interestAmount'] ?? json['interest']),
      totalAmount: _dbl(json['total_amount'] ?? json['totalAmount'] ?? json['amount']),
      paidAmount: json['paid_amount'] != null ? _dbl(json['paid_amount']) : json['paidAmount'] != null ? _dbl(json['paidAmount']) : null,
      isPaid: json['is_paid'] == true || json['isPaid'] == true || json['paid'] == true,
      paidDate: _tryDate(json['paid_date'] ?? json['paidDate']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'installment_number': installmentNumber,
      'due_date': dueDate.toIso8601String(),
      'principal_amount': principalAmount,
      'interest_amount': interestAmount,
      'total_amount': totalAmount,
      'paid_amount': paidAmount,
      'is_paid': isPaid,
      'paid_date': paidDate?.toIso8601String(),
    };
  }
}
