import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Building2, GitBranch, Warehouse, ArrowRight, TrendingUp } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface Summary {
    total: number;
    active: number;
    trial: number;
    expired: number;
    totalOperators: number;
    totalCustomers: number;
    totalBranches: number;
    totalWarehouses: number;
}

const TRIAL_DEFAULTS = { max_operators: 3, max_customers: 10, max_branches: 5, max_warehouses: 1 };

export default function AdminSubscriptionOverview() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<Summary>({
        total: 0, active: 0, trial: 0, expired: 0,
        totalOperators: 0, totalCustomers: 0, totalBranches: 0, totalWarehouses: 0,
    });

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const { data: subs } = await supabase
                .from('subscriptions')
                .select('status, company_id');

            if (!subs) { setLoading(false); return; }

            const ownerIds = subs.map(s => s.company_id);

            const [opRes, custRes, branchRes, whRes] = await Promise.all([
                supabase.from('operators').select('id', { count: 'exact', head: true }),
                supabase.from('customers').select('id', { count: 'exact', head: true }).in('created_by_company_id', ownerIds),
                supabase.from('customer_branches').select('id', { count: 'exact', head: true }).in('created_by_company_id', ownerIds),
                supabase.from('warehouses').select('id', { count: 'exact', head: true }),
            ]);

            setSummary({
                total: subs.length,
                active: subs.filter(s => s.status === 'active').length,
                trial: subs.filter(s => s.status === 'trial').length,
                expired: subs.filter(s => s.status === 'expired' || s.status === 'cancelled').length,
                totalOperators: opRes.count || 0,
                totalCustomers: custRes.count || 0,
                totalBranches: branchRes.count || 0,
                totalWarehouses: whRes.count || 0,
            });
        } catch (e) {
            console.error('AdminSubscriptionOverview error:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#10b981" />
            </View>
        );
    }

    const statusItems = [
        { label: 'Aktif', value: summary.active, color: '#10b981', bg: '#ecfdf5' },
        { label: 'Deneme', value: summary.trial, color: '#f59e0b', bg: '#fffbeb' },
        { label: 'Süresi Doldu', value: summary.expired, color: '#ef4444', bg: '#fef2f2' },
    ];

    const resourceItems = [
        { label: 'Operatörler', value: summary.totalOperators, icon: Users, color: '#10b981' },
        { label: 'Müşteriler', value: summary.totalCustomers, icon: Building2, color: '#3b82f6' },
        { label: 'Şubeler', value: summary.totalBranches, icon: GitBranch, color: '#f59e0b' },
        { label: 'Depolar', value: summary.totalWarehouses, icon: Warehouse, color: '#f97316' },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.titleRow}>
                <View style={styles.titleLeft}>
                    <TrendingUp size={16} color="#10b981" />
                    <Text style={styles.title}>Abonelik Durumu</Text>
                </View>
                <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/admin/limits' as any)}>
                    <Text style={styles.linkText}>Tümünü Yönet</Text>
                    <ArrowRight size={13} color="#10b981" />
                </TouchableOpacity>
            </View>

            <View style={styles.statusRow}>
                <View style={styles.totalBox}>
                    <Text style={styles.totalNum}>{summary.total}</Text>
                    <Text style={styles.totalLabel}>Toplam Firma</Text>
                </View>
                {statusItems.map(item => (
                    <View key={item.label} style={[styles.statusBox, { backgroundColor: item.bg }]}>
                        <Text style={[styles.statusNum, { color: item.color }]}>{item.value}</Text>
                        <Text style={[styles.statusLabel, { color: item.color }]}>{item.label}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.resourcesTitle}>Toplam Kaynak Kullanımı</Text>
            <View style={styles.resourcesGrid}>
                {resourceItems.map(item => {
                    const Icon = item.icon;
                    return (
                        <View key={item.label} style={styles.resourceCard}>
                            <View style={[styles.resourceIcon, { backgroundColor: item.color + '15' }]}>
                                <Icon size={14} color={item.color} />
                            </View>
                            <Text style={styles.resourceNum}>{item.value}</Text>
                            <Text style={styles.resourceLabel}>{item.label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingBox: { padding: 24, alignItems: 'center' },
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    titleRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 14,
    },
    titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    linkText: { fontSize: 12, fontWeight: '600', color: '#10b981' },
    statusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    totalBox: {
        flex: 1.2, backgroundColor: '#f8fafc',
        borderRadius: 10, padding: 10, alignItems: 'center',
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    totalNum: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
    totalLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
    statusBox: {
        flex: 1, borderRadius: 10, padding: 10, alignItems: 'center',
    },
    statusNum: { fontSize: 18, fontWeight: '800' },
    statusLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
    resourcesTitle: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase' },
    resourcesGrid: { flexDirection: 'row', gap: 8 },
    resourceCard: {
        flex: 1, alignItems: 'center', gap: 4,
        backgroundColor: '#f8fafc', borderRadius: 10, padding: 10,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    resourceIcon: {
        width: 28, height: 28, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
    },
    resourceNum: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    resourceLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '500', textAlign: 'center' },
});
