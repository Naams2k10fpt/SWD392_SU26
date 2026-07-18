class Wallet {
  final String id;
  final String userId;
  final String currencyCode;
  final double balance;

  Wallet({
    required this.id,
    required this.userId,
    required this.currencyCode,
    required this.balance,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      id: json['id'] as String,
      userId: json['userId'] as String,
      currencyCode: json['currencyCode'] as String,
      balance: (json['balance'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'currencyCode': currencyCode,
      'balance': balance,
    };
  }
}
