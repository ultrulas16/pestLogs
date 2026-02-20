import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Users, Building, FileText, Warehouse, CreditCard, Package, Sliders } from 'lucide-react-native';
import { DesktopLayout } from '../DesktopLayout';
import AdminSubscriptionOverview from './AdminSubscriptionOverview';

export default function AdminDashboardDesktop() {
    const router = useRouter();
    const { t } = useLanguage();
    const { profile } = useAuth();

    const stats = [
        { icon: Shield, label: t('totalCompanies'), value: 0, color: '#10b981', bg: '#ecfdf5' },
        { icon: Users, label: t('totalUsers'), value: 0, color: '#3b82f6', bg: '#eff6ff' },
    ];

    const menuItems = [
        {
            icon: CreditCard,
            label: 'Abonelik Paketleri',
            route: '/admin/subscription-plans',
            color: '#7c3aed',
            description: 'Paketleri ve özellikleri yönetin'
        },
        {
            icon: Building,
            label: t('registerNewCompany'),
            route: '/auth/register',
            color: '#10b981',
            description: 'Yeni firma kaydı oluşturun'
        },
        {
            icon: Users,
            label: t('manageUsers'),
            route: '/admin/users',
            color: '#3b82f6',
            description: 'Kullanıcıları ve rollerini yönetin'
        },
        {
            icon: Warehouse,
            label: 'Depo Yönetimi',
            route: '/admin/warehouses',
            color: '#f59e0b',
            description: 'Depo tanımlarını yönetin'
        },
        {
            icon: Sliders,
            label: 'Limit Yönetimi',
            route: '/admin/limits',
            color: '#10b981',
            description: 'Firma abonelik ve kaynak limitlerini yönetin'
        },
        {
            icon: FileText,
            label: t('serviceReports'),
            route: '/admin/reports',
            color: '#ec4899',
            description: 'Servis ve hizmet raporlarını inceleyin'
        },
    ];

    return (
        <DesktopLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Admin Paneli</Text>
                    <Text style={styles.welcomeSubtitle}>Sistem yönetimi ve istatistikler</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {stats.map((stat, index) => {
                        const Icon = stat.icon;
                        return (
                            <View key={index} style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: stat.bg }]}>
                                    <Icon size={24} color={stat.color} />
                                </View>
                                <View>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                    <Text style={styles.statValue}>{stat.value}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                <View style={{ marginBottom: 40 }}>
                    <AdminSubscriptionOverview />
                </View>

                <Text style={styles.sectionTitle}>Yönetim Araçları</Text>

                {/* Menu Grid */}
                <View style={styles.menuGrid}>
                    {menuItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.menuCard}
                                onPress={() => router.push(item.route as any)}
                            >
                                <View style={[styles.menuIconContainer, { backgroundColor: item.color + '15' }]}>
                                    <Icon size={24} color={item.color} />
                                </View>
                                <View style={styles.menuContent}>
                                    <Text style={styles.menuLabel} numberOfLines={1}>{item.label}</Text>
                                    <Text style={styles.menuDescription} numberOfLines={2}>{item.description}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

            </ScrollView>
        </DesktopLayout>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: 40,
    },
    welcomeSection: {
        marginBottom: 32,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    welcomeSubtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 40,
        flexWrap: 'wrap',
    },
    statCard: {
        flex: 1,
        minWidth: 240,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    statLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 24,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
    },
    menuCard: {
        width: '30%',
        minWidth: 280,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    menuIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuContent: {
        flex: 1,
        marginRight: 12,
    },
    menuLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    menuDescription: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
});
