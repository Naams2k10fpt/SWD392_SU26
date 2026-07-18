class GiftTransaction {
  final String id;
  final String fromUserId;
  final String toCreatorId;
  final String roomId;
  final String message;
  final double amount;
  final DateTime createdAt;

  GiftTransaction({
    required this.id,
    required this.fromUserId,
    required this.toCreatorId,
    required this.roomId,
    required this.message,
    required this.amount,
    required this.createdAt,
  });

  factory GiftTransaction.fromJson(Map<String, dynamic> json) {
    return GiftTransaction(
      id: json['id'] as String,
      fromUserId: json['fromUserId'] as String,
      toCreatorId: json['toCreatorId'] as String,
      roomId: json['roomId'] as String,
      message: json['message'] as String? ?? '',
      amount: (json['amount'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fromUserId': fromUserId,
      'toCreatorId': toCreatorId,
      'roomId': roomId,
      'message': message,
      'amount': amount,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
