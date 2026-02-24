import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/theme/app_theme.dart';
import '../../routes/app_pages.dart';
import 'profile_controller.dart';

class ProfileView extends GetView<ProfileController> {
  const ProfileView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: Obx(() {
        if (controller.isLoading.value && controller.member.value == null) {
          return const Center(child: CircularProgressIndicator());
        }

        final member = controller.member.value;
        if (member == null) {
          return const Center(child: Text('Profile not found'));
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _buildProfileHeader(member),
              const SizedBox(height: 24),
              _buildProfileDetails(member),
              const SizedBox(height: 24),
              _buildMenuItems(),
              const SizedBox(height: 24),
              _buildLogoutButton(),
              const SizedBox(height: 24),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildProfileHeader(member) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            CircleAvatar(
              radius: 50,
              backgroundColor: AppColors.primary.withOpacity(0.1),
              child: Text(
                member.initials,
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              member.fullName,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Member ID: ${member.memberId}',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            if (controller.organization.value != null) ...[
              const SizedBox(height: 4),
              Text(
                controller.organization.value!.name,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildProfileDetails(member) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Personal Information',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            _buildInfoRow(
              icon: Icons.email,
              label: 'Email',
              value: member.email ?? 'Not set',
            ),
            const Divider(height: 24),
            _buildInfoRow(
              icon: Icons.phone,
              label: 'Phone',
              value: member.phone ?? 'Not set',
            ),
            const Divider(height: 24),
            _buildInfoRow(
              icon: Icons.location_on,
              label: 'Address',
              value: member.address ?? 'Not set',
            ),
            if (member.idNumber != null) ...[
              const Divider(height: 24),
              _buildInfoRow(
                icon: Icons.badge,
                label: 'ID Number',
                value: member.idNumber!,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.primary, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAccountInfo(member) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Account Summary',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    label: 'Savings',
                    value: 'KSh ${member.savingsBalance.toStringAsFixed(0)}',
                    color: AppColors.success,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatCard(
                    label: 'Shares',
                    value: 'KSh ${member.sharesBalance.toStringAsFixed(0)}',
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            if (member.loanBalance > 0) ...[
              const SizedBox(height: 12),
              _buildStatCard(
                label: 'Loan Balance',
                value: 'KSh ${member.loanBalance.toStringAsFixed(0)}',
                color: AppColors.warning,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: color)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItems() {
    return Card(
      child: Column(
        children: [
          _buildMenuItem(
            icon: Icons.description,
            title: 'Statements',
            onTap: () => Get.toNamed(Routes.statements),
          ),
          const Divider(height: 1),
          _buildMenuItem(
            icon: Icons.notifications,
            title: 'Notifications',
            onTap: () => Get.toNamed(Routes.notifications),
          ),
          const Divider(height: 1),
          _buildMenuItem(
            icon: Icons.lock,
            title: 'Change Password',
            onTap: controller.showChangePasswordDialog,
          ),
          const Divider(height: 1),
          _buildMenuItem(
            icon: Icons.help_outline,
            title: 'Help & Support',
            onTap: () {},
          ),
          const Divider(height: 1),
          _buildMenuItem(
            icon: Icons.info_outline,
            title: 'About',
            onTap: () {
              Get.dialog(
                AlertDialog(
                  title: const Text('BANKY Mobile'),
                  content: const Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Version 1.0.0'),
                      SizedBox(height: 8),
                      Text('Member Portal for Sacco & Bank Management'),
                    ],
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Get.back(),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
      onTap: onTap,
    );
  }

  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: controller.logout,
        icon: const Icon(Icons.logout, color: Colors.red),
        label: const Text('Logout', style: TextStyle(color: Colors.red)),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Colors.red),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }
}
