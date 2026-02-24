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
    DateTime? _tryParse(String? s) {
      if (s == null) return null;
      try { return DateTime.parse(s); } catch (_) { return null; }
    }

    return LoanModel(
      id: json['id']?.toString() ?? '',
      loanNumber: json['loan_number'] ?? json['loanNumber'] ?? json['application_number'],
      loanProductId: json['loan_product_id']?.toString() ?? json['loanProductId']?.toString() ?? '',
      loanProductName: json['loan_product_name'] ?? json['loanProductName'] ?? json['product_name'] ?? json['product']?['name'],
      principalAmount: (json['principal_amount'] ?? json['principalAmount'] ?? json['principal'] ?? json['amount'] ?? 0).toDouble(),
      interestRate: (json['interest_rate'] ?? json['interestRate'] ?? 0).toDouble(),
      termMonths: json['term_months'] ?? json['termMonths'] ?? json['term'] ?? 0,
      totalAmount: (json['total_amount'] ?? json['totalAmount'] ?? json['total_repayment'] ?? 0).toDouble(),
      amountPaid: (json['amount_paid'] ?? json['amountPaid'] ?? json['paid_amount'] ?? json['amount_repaid'] ?? 0).toDouble(),
      outstandingBalance: (json['outstanding_balance'] ?? json['outstandingBalance'] ?? json['balance'] ?? 0).toDouble(),
      monthlyPayment: (json['monthly_payment'] ?? json['monthlyPayment'] ?? json['monthly_repayment'])?.toDouble(),
      status: _parseLoanStatus(json['status']),
      applicationDate: _tryParse(json['application_date'] ?? json['applied_at']),
      approvalDate: _tryParse(json['approval_date'] ?? json['approved_at']),
      disbursementDate: _tryParse(json['disbursement_date'] ?? json['disbursed_at']),
      maturityDate: _tryParse(json['maturity_date'] ?? json['maturity_date']),
      nextPaymentDate: _tryParse(json['next_payment_date']),
      daysOverdue: json['days_overdue'] ?? json['daysOverdue'],
      createdAt: _tryParse(json['created_at']),
      repaymentSchedule: (json['repayment_schedule'] as List<dynamic>?)
          ?.map((e) => LoanRepaymentSchedule.fromJson(e))
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
    return LoanRepaymentSchedule(
      installmentNumber: json['installment_number'] ?? json['installmentNumber'] ?? json['number'] ?? 0,
      dueDate: DateTime.parse(json['due_date'] ?? json['dueDate']),
      principalAmount: (json['principal_amount'] ?? json['principalAmount'] ?? json['principal'] ?? 0).toDouble(),
      interestAmount: (json['interest_amount'] ?? json['interestAmount'] ?? json['interest'] ?? 0).toDouble(),
      totalAmount: (json['total_amount'] ?? json['totalAmount'] ?? json['amount'] ?? 0).toDouble(),
      paidAmount: json['paid_amount']?.toDouble() ?? json['paidAmount']?.toDouble(),
      isPaid: json['is_paid'] ?? json['isPaid'] ?? json['paid'] ?? false,
      paidDate: json['paid_date'] != null ? DateTime.parse(json['paid_date']) : null,
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
