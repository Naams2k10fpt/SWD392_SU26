import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucy_app/services/auth_provider.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        final user = auth.user;
        final isPro = user?.role == 'Pro';
        final isSuper = user?.role == 'Super';

        return Scaffold(
          appBar: AppBar(
            title: Text('Xin chào, ${user?.displayName ?? 'User'}'),
            actions: [
              IconButton(
                icon: const Icon(Icons.logout),
                tooltip: 'Đăng xuất',
                onPressed: () async {
                  await auth.logout();
                  if (context.mounted) {
                    Navigator.pushReplacementNamed(context, '/login');
                  }
                },
              ),
            ],
          ),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: GridView.count(
              crossAxisCount: 2,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 1,
              children: [
                _MenuCard(
                  icon: Icons.mic,
                  label: '🎙️ Phòng học',
                  color: theme.colorScheme.primary,
                  onTap: () => Navigator.pushNamed(context, '/room'),
                ),
                _MenuCard(
                  icon: Icons.account_balance_wallet,
                  label: '💰 Ví',
                  color: theme.colorScheme.tertiary,
                  onTap: () => Navigator.pushNamed(context, '/wallet'),
                ),
                _MenuCard(
                  icon: Icons.card_giftcard,
                  label: '🎁 Quà tặng',
                  color: theme.colorScheme.secondary,
                  onTap: () => Navigator.pushNamed(context, '/gift'),
                ),
                _MenuCard(
                  icon: Icons.podcasts,
                  label: '📻 Podcast',
                  color: theme.colorScheme.error,
                  onTap: () => Navigator.pushNamed(context, '/podcast'),
                ),
                if (isPro)
                  _MenuCard(
                    icon: Icons.dashboard,
                    label: '📊 Dashboard Mentor',
                    color: theme.colorScheme.primaryContainer,
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content:
                              Text('Dashboard Mentor - Đang phát triển'),
                        ),
                      );
                    },
                  ),
                if (isSuper)
                  _MenuCard(
                    icon: Icons.add_circle,
                    label: '🎙️ Tạo Podcast',
                    color: theme.colorScheme.tertiaryContainer,
                    onTap: () =>
                        Navigator.pushNamed(context, '/podcast'),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MenuCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _MenuCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 40, color: color),
              const SizedBox(height: 12),
              Text(
                label,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
