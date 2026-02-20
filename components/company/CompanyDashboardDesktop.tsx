import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building, Users, Calendar, FileText, Settings, DollarSign, Package, Warehouse, ArrowLeftRight, ChevronRight, CreditCard, Activity } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DesktopLayout } from '../DesktopLayout';
import { SubscriptionStatus } from '../SubscriptionStatus';
import SubscriptionLimits from './SubscriptionLimits';

export default function CompanyDashboardDesktop() {
    const router = useRouter();
    const { t } = useLanguage();
    const { profile } = useAuth();
    const [stats, setStats] = useState({
        operators: 0,
        customers: 0,
        activeJobs: 0,
    });

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const { data: companyData } = await supabase
                .from('companies')
                .select('id')
                .eq('owner_id', profile?.id)
                .maybeSingle();

            if (!companyData) {
                console.log('No company found for user:', profile?.id);
                return;
            }

            const { count: operatorsCount } = await supabase
                .from('operators')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyData.id);

            const { count: customersCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('created_by_company_id', companyData.id);

            const { count: activeJobsCount } = await supabase
                .from('service_requests')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyData.id)
                .in('status', ['pending', 'assigned', 'in_progress']);

            setStats({
                operators: operatorsCount || 0,
                customers: customersCount || 0,
                activeJobs: activeJobsCount || 0,
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const menuItems = [
        { icon: CreditCard, label: 'Abonelik Planları', route: '/company/subscription', color: '#7c3aed', gradient: ['#7c3aed', '#6d28d9'], description: 'Plan ve ödemeleri yönetin' },
        { icon: Users, label: t('manageOperators'), route: '/company/operators', color: '#10b981', gradient: ['#10b981', '#059669'], description: 'Personel ve yetkiler' },
        { icon: Building, label: t('manageCustomers'), route: '/company/customers', color: '#3b82f6', gradient: ['#3b82f6', '#2563eb'], description: 'Müşteri listesi ve detayları' },
        { icon: Building, label: t('manageBranches'), route: '/company/manage-branches', color: '#8b5cf6', gradient: ['#8b5cf6', '#7c3aed'], description: 'Şube tanımları' },
        { icon: Settings, label: t('companyDefinitions'), route: '/company/definitions', color: '#64748b', gradient: ['#64748b', '#475569'], description: 'Sistem tanımları' },
        { icon: Calendar, label: t('companySettings'), route: '/company/settings', color: '#f59e0b', gradient: ['#f59e0b', '#d97706'], description: 'Firma ayarları' },
        { icon: FileText, label: 'Ziyaretler ve Raporlar', route: '/company/visits', color: '#06b6d4', gradient: ['#06b6d4', '#0891b2'], description: 'Tamamlanan işler' },
        { icon: DollarSign, label: 'Ciro Raporları', route: '/company/revenue-reports', color: '#10b981', gradient: ['#10b981', '#059669'], description: 'Finansal durum' },
        { icon: Package, label: 'Ücretli Ürünler', route: '/company/paid-products', color: '#8b5cf6', gradient: ['#8b5cf6', '#7c3aed'], description: 'Ek hizmetler' },
        { icon: DollarSign, label: 'Müşteri Fiyatlandırma', route: '/company/pricing', color: '#14b8a6', gradient: ['#14b8a6', '#0d9488'], description: 'Fiyat listesi' },
        { icon: Warehouse, label: 'Ana Depo Yönetimi', route: '/company/warehouse', color: '#f97316', gradient: ['#f97316', '#ea580c'], description: 'Stok takibi' },
        { icon: ArrowLeftRight, label: 'Transfer Yönetimi', route: '/company/transfer-management', color: '#06b6d4', gradient: ['#06b6d4', '#0891b2'], description: 'Stok transferleri' },
    ];

    return (
        <DesktopLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Hoş Geldiniz, {profile?.full_name}</Text>
                    <Text style={styles.welcomeSubtitle}>İşte bugünün özeti ve hızlı işlemler</Text>
                </View>

                <View style={styles.subscriptionContainer}>
                    <SubscriptionStatus />
                </View>

                <View style={styles.limitsContainer}>
                    <SubscriptionLimits />
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#ecfdf5' }]}>
                            <Users size={24} color="#059669" />
                        </View>
                        <View>
                            <Text style={styles.statLabel}>{t('operators')}</Text>
                            <Text style={styles.statValue}>{stats.operators}</Text>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#eff6ff' }]}>
                            <Activity size={24} color="#2563eb" />
                        </View>
                        <View>
                            <Text style={styles.statLabel}>{t('activeJobs')}</Text>
                            <Text style={styles.statValue}>{stats.activeJobs}</Text>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#fff7ed' }]}>
                            <Building size={24} color="#d97706" />
                        </View>
                        <View>
                            <Text style={styles.statLabel}>{t('customers')}</Text>
                            <Text style={styles.statValue}>{stats.customers}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Hızlı Erişim</Text>

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
                                <ChevronRight size={16} color="#94a3b8" />
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
    subscriptionContainer: {
        marginBottom: 16,
    },
    limitsContainer: {
        marginBottom: 32,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 40,
        flexWrap: 'wrap',
    },
    statCard: {
        flex: 1,
        minWidth: 200,
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
        width: '30%', // Approx 3 columns
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
        // Hover effect simulation would need Pressable or more complex native-web handling
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
