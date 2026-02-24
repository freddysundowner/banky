enum TransactionType { deposit, withdrawal, transfer, loanDisbursement, loanRepayment, interest, fee, dividend }
enum TransactionStatus { pending, completed, failed, reversed }
enum AccountType { savings, shares, loan, fixedDeposit }

class TransactionModel {
  final String id;
  final String? referenceNumber;
  final TransactionType type;
  final TransactionStatus status;
  final AccountType accountType;
  final double amount;
  final double? balanceBefore;
  final double? balanceAfter;
  final String? description;
  final String? narration;
  final String? paymentMethod;
  final DateTime transactionDate;
  final DateTime? createdAt;

  TransactionModel({
    required this.id,
    this.referenceNumber,
    required this.type,
    required this.status,
    required this.accountType,
    required this.amount,
    this.balanceBefore,
    this.balanceAfter,
    this.description,
    this.narration,
    this.paymentMethod,
    required this.transactionDate,
    this.createdAt,
  });

  bool get isCredit => type == TransactionType.deposit || 
                        type == TransactionType.loanDisbursement || 
                        type == TransactionType.interest || 
                        type == TransactionType.dividend;

  bool get isDebit => type == TransactionType.withdrawal || 
                       type == TransactionType.transfer || 
                       type == TransactionType.loanRepayment || 
                       type == TransactionType.fee;

  String get typeLabel {
    switch (type) {
      case TransactionType.deposit:
        return 'Deposit';
      case TransactionType.withdrawal:
        return 'Withdrawal';
      case TransactionType.transfer:
        return 'Transfer';
      case TransactionType.loanDisbursement:
        return 'Loan Disbursement';
      case TransactionType.loanRepayment:
        return 'Loan Repayment';
      case TransactionType.interest:
        return 'Interest';
      case TransactionType.fee:
        return 'Fee';
      case TransactionType.dividend:
        return 'Dividend';
    }
  }

  String get statusLabel {
    switch (status) {
      case TransactionStatus.pending:
        return 'Pending';
      case TransactionStatus.completed:
        return 'Completed';
      case TransactionStatus.failed:
        return 'Failed';
      case TransactionStatus.reversed:
        return 'Reversed';
    }
  }

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    return TransactionModel(
      id: json['id']?.toString() ?? '',
      referenceNumber: json['transaction_number'] ?? json['reference_number'] ?? json['referenceNumber'] ?? json['reference'],
      type: _parseTransactionType(json['type'] ?? json['transaction_type']),
      status: _parseTransactionStatus(json['status']),
      accountType: _parseAccountType(json['account_type'] ?? json['accountType']),
      amount: (json['amount'] ?? 0).toDouble(),
      balanceBefore: json['balance_before']?.toDouble(),
      balanceAfter: json['balance_after']?.toDouble(),
      description: json['description'],
      narration: json['narration'],
      paymentMethod: json['payment_method'],
      transactionDate: DateTime.parse(json['transaction_date'] ?? json['transactionDate'] ?? json['created_at'] ?? DateTime.now().toIso8601String()),
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : null,
    );
  }

  static TransactionType _parseTransactionType(String? type) {
    switch (type?.toLowerCase()) {
      case 'deposit':
        return TransactionType.deposit;
      case 'withdrawal':
        return TransactionType.withdrawal;
      case 'transfer':
        return TransactionType.transfer;
      case 'loan_disbursement':
      case 'loandisbursement':
        return TransactionType.loanDisbursement;
      case 'loan_repayment':
      case 'loanrepayment':
      case 'repayment':
        return TransactionType.loanRepayment;
      case 'interest':
        return TransactionType.interest;
      case 'fee':
        return TransactionType.fee;
      case 'dividend':
        return TransactionType.dividend;
      default:
        return TransactionType.deposit;
    }
  }

  static TransactionStatus _parseTransactionStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return TransactionStatus.pending;
      case 'completed':
      case 'success':
        return TransactionStatus.completed;
      case 'failed':
        return TransactionStatus.failed;
      case 'reversed':
        return TransactionStatus.reversed;
      default:
        return TransactionStatus.completed;
    }
  }

  static AccountType _parseAccountType(String? type) {
    switch (type?.toLowerCase()) {
      case 'savings':
        return AccountType.savings;
      case 'shares':
        return AccountType.shares;
      case 'loan':
        return AccountType.loan;
      case 'fixed_deposit':
      case 'fixeddeposit':
        return AccountType.fixedDeposit;
      default:
        return AccountType.savings;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'transaction_number': referenceNumber,
      'type': type.name,
      'status': status.name,
      'account_type': accountType.name,
      'amount': amount,
      'balance_before': balanceBefore,
      'balance_after': balanceAfter,
      'description': description,
      'narration': narration,
      'payment_method': paymentMethod,
      'transaction_date': transactionDate.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
