import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut, Building, Users, Calendar, FileText, Settings, DollarSign, Package, Warehouse, ArrowLeftRight, CreditCard, ChevronRight, Menu, Home, Calendar as CalendarIcon } from 'lucide-react-native'; // Added missing icons
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface DesktopLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function DesktopLayout({ children, showSidebar = true }: DesktopLayoutProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // Simple breakpoint
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/welcome');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Define menu items based on role
  const getMenuItems = () => {
    if (profile?.role === 'admin') {
      return [
        { icon: Home, label: t('dashboard'), route: '/(tabs)/admin_dashboard' },
        { icon: Building, label: t('registerNewCompany'), route: '/auth/register' }, // Or a list of companies
        { icon: Users, label: t('manageUsers'), route: '/admin/users' },
        { icon: Warehouse, label: 'Depo Yönetimi', route: '/admin/warehouses' },
        { icon: CreditCard, label: 'Abonelik Paketleri', route: '/admin/subscription-plans' },
        { icon: FileText, label: t('serviceReports'), route: '/admin/reports' }, // Placeholder if needed
      ];
    }

    // Default to company menu
    return [
      { icon: Home, label: t('dashboard'), route: '/(tabs)/company' },
      { icon: CreditCard, label: 'Abonelik Planları', route: '/company/subscription-plans' },
      { icon: Users, label: t('manageOperators'), route: '/company/operators' },
      { icon: Building, label: t('manageCustomers'), route: '/company/customers' },
      { icon: Building, label: t('manageBranches'), route: '/company/manage-branches' },
      { icon: Settings, label: t('companyDefinitions'), route: '/company/definitions' },
      { icon: Calendar, label: t('companySettings'), route: '/company/settings' },
      { icon: CalendarIcon, label: t('calendar') || 'Takvim', route: '/company/calendar' },
      { icon: FileText, label: 'Ziyaretler ve Raporlar', route: '/company/visits' },
      { icon: DollarSign, label: 'Ciro Raporları', route: '/company/revenue-reports' },
      { icon: Package, label: 'Ücretli Ürünler', route: '/company/paid-products' },
      { icon: DollarSign, label: 'Müşteri Fiyatlandırma', route: '/company/pricing' },
      { icon: Warehouse, label: 'Ana Depo Yönetimi', route: '/company/warehouse' },
      { icon: ArrowLeftRight, label: 'Transfer Yönetimi', route: '/company/transfer-management' },
      { icon: FileText, label: 'Yıllık Rapor', route: '/company/annual-report' },
    ];
  };

  const menuItems = getMenuItems();

  if (!isDesktop) {
    return <>{children}</>; // Fallback to mobile view (usually handled by parent, but safe here)
  }

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      {showSidebar && (
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <View style={styles.logoContainer}>
              <Building size={24} color="#10b981" />
            </View>
            <Text style={styles.sidebarTitle}>Pest360</Text>
          </View>

          <ScrollView style={styles.sidebarContent} showsVerticalScrollIndicator={false}>
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.route;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                  onPress={() => router.push(item.route as any)}
                >
                  <Icon size={20} color={isActive ? '#10b981' : '#64748b'} />
                  <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                    {item.label}
                  </Text>
                  {isActive && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sidebarFooter}>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userInitials}>{profile?.full_name?.charAt(0) || 'U'}</Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName} numberOfLines={1}>{profile?.full_name}</Text>
                <Text style={styles.userRole} numberOfLines={1}>{profile?.company_name || 'Firma'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Top Header (Desktop) */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{menuItems.find(i => i.route === pathname)?.label || 'Dashboard'}</Text>
          {/* Add top right actions here if needed */}
        </View>

        <View style={styles.contentWrapper}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    height: '100%', // Ensure full height for web
  },
  sidebar: {
    width: 260,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  sidebarContent: {
    flex: 1,
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 4,
    position: 'relative',
  },
  menuItemActive: {
    backgroundColor: '#ecfdf5',
  },
  menuText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  menuTextActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 6, // Centered roughly
    bottom: 6,
    width: 4,
    backgroundColor: '#10b981',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  userRole: {
    fontSize: 11,
    color: '#64748b',
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden', // Prevent duplicate scrolling
  },
  header: {
    height: 70,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  contentWrapper: {
    flex: 1,
    padding: 32,
    overflow: 'scroll', // Allow scrolling inside content area
  },
});
