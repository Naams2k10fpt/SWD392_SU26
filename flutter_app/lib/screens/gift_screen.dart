import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucy_app/services/auth_provider.dart';
import 'package:lucy_app/services/wallet_service.dart';
import 'package:lucy_app/models/gift_transaction.dart';

class GiftScreen extends StatefulWidget {
  const GiftScreen({super.key});

  @override
  State<GiftScreen> createState() => _GiftScreenState();
}

class _GiftScreenState extends State<GiftScreen> {
  final _fromUserIdController = TextEditingController();
  final _toCreatorIdController = TextEditingController();
  final _amountController = TextEditingController();
  final _messageController = TextEditingController();

  List<GiftTransaction> _gifts = [];
  bool _loading = false;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadGifts();
  }

  @override
  void dispose() {
    _fromUserIdController.dispose();
    _toCreatorIdController.dispose();
    _amountController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadGifts() async {
    final auth = context.read<AuthProvider>();
    if (auth.token == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final gifts = await WalletService.getGifts(auth.token!);
      if (!mounted) return;
      setState(() {
        _gifts = gifts;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _sendGift() async {
    final fromUserId = _fromUserIdController.text.trim();
    final toCreatorId = _toCreatorIdController.text.trim();
    final amountText = _amountController.text.trim();
    final message = _messageController.text.trim();

    if (fromUserId.isEmpty ||
        toCreatorId.isEmpty ||
        amountText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Vui lòng điền đầy đủ thông tin')),
      );
      return;
    }

    final amount = double.tryParse(amountText);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Số tiền không hợp lệ')),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    if (auth.token == null) return;

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      await WalletService.sendGift(
        fromUserId: fromUserId,
        toCreatorId: toCreatorId,
        amount: amount,
        message: message,
        token: auth.token!,
      );
      if (!mounted) return;
      setState(() {
        _sending = false;
        _fromUserIdController.clear();
        _toCreatorIdController.clear();
        _amountController.clear();
        _messageController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gửi quà thành công!')),
      );
      _loadGifts();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _sending = false;
      });
    }
  }

  String _formatCurrency(double amount) {
    if (amount == amount.roundToDouble()) {
      return '${amount.toInt()} ₫';
    }
    return '${amount.toStringAsFixed(2)} ₫';
  }

  String _formatDate(DateTime date) {
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '${date.day}/${date.month}/${date.year} $hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('🎁 Quà tặng'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadGifts,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Send gift form
              Text(
                'Gửi quà',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _fromUserIdController,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Từ User ID',
                  prefixIcon: const Icon(Icons.person_outline),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _toCreatorIdController,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Đến Creator ID',
                  prefixIcon: const Icon(Icons.person),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Số tiền',
                  prefixIcon:
                      const Icon(Icons.monetization_on_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _messageController,
                textInputAction: TextInputAction.done,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Lời nhắn',
                  hintText: 'Viết lời nhắn...',
                  alignLabelWithHint: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Error
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    _error!,
                    style: TextStyle(color: theme.colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                ),

              // Send button
              FilledButton.icon(
                onPressed: _sending ? null : _sendGift,
                icon: _sending
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send),
                label: Text(_sending ? 'Đang gửi...' : 'Gửi quà'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Gift history
              Text(
                'Lịch sử quà tặng',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              if (_loading)
                const Center(child: CircularProgressIndicator())
              else if (_gifts.isEmpty)
                Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Text(
                        'Chưa có giao dịch nào',
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                )
              else
                ..._gifts.map(
                  (gift) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor:
                            theme.colorScheme.primaryContainer,
                        child: Text(
                          gift.fromUserId[0].toUpperCase(),
                          style: TextStyle(
                            color:
                                theme.colorScheme.onPrimaryContainer,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      title: Text(
                        '${gift.fromUserId} → ${gift.toCreatorId}',
                        style:
                            const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (gift.message.isNotEmpty)
                            Text(gift.message),
                          Text(
                            _formatDate(gift.createdAt),
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                      trailing: Text(
                        _formatCurrency(gift.amount),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.primary,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
