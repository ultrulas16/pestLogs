import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Users, Building, Warehouse, GitBranch } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface LimitItem {
    label: string;
    current: number;
    max: number;
    icon: React.ComponentType<{ size: number; color: string }>;
    color: string;
}

const TRIAL_DEFAULTS = {
    max_operators: 3,
    max_customers: 10,
    max_branches: 5,
    max_warehouses: 1,
};

export default function SubscriptionLimits() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [limits, setLimits] = useState<LimitItem[]>([]);

    useEffect(() => {
        if (profile?.role === 'company') {
            loadLimits();
        } else {
            setLoading(false);
        }
    }, [profile]);

    const loadLimits = async () => {
        try {
            const { data: companyData } = await supabase
                .from('companies')
                .select('id')
                .eq('owner_id', profile?.id)
                .maybeSingle();

            if (!companyData) {
                setLoading(false);
                return;
            }

            const companyId = companyData.id;

            const [subRes, operatorsRes, customersRes, branchesRes, warehousesRes] = await Promise.all([
                supabase
                    .from('subscriptions')
                    .select(`
                        status, trial_ends_at,
                        max_operators, max_customers, max_branches, max_warehouses,
                        plan:subscription_plans(max_operators, max_customers, max_branches, max_warehouses)
                    `)
                    .eq('company_id', profile!.id)
                    .maybeSingle(),
                supabase.from('operators').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
                supabase.from('customers').select('*', { count: 'exact', head: true }).eq('created_by_company_id', companyId),
                supabase.from('customer_branches').select('*', { count: 'exact', head: true }).eq('created_by_company_id', companyId),
                supabase.from('warehouses').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
            ]);

            const sub = subRes.data;
            const plan = sub?.plan && !Array.isArray(sub.plan) ? sub.plan : (Array.isArray(sub?.plan) ? sub.plan[0] : null);

            const maxOps = sub?.max_operators ?? plan?.max_operators ?? TRIAL_DEFAULTS.max_operators;
            const maxCust = sub?.max_customers ?? plan?.max_customers ?? TRIAL_DEFAULTS.max_customers;
            const maxBranch = sub?.max_branches ?? plan?.max_branches ?? TRIAL_DEFAULTS.max_branches;
            const maxWh = sub?.max_warehouses ?? plan?.max_warehouses ?? TRIAL_DEFAULTS.max_warehouses;

            setLimits([
                { label: 'Operatörler', current: operatorsRes.count || 0, max: maxOps, icon: Users, color: '#10b981' },
                { label: 'Müşteriler', current: customersRes.count || 0, max: maxCust, icon: Building, color: '#3b82f6' },
                { label: 'Şubeler', current: branchesRes.count || 0, max: maxBranch, icon: GitBranch, color: '#f59e0b' },
                { label: 'Depolar', current: warehousesRes.count || 0, max: maxWh, icon: Warehouse, color: '#f97316' },
            ]);
        } catch (error) {
            console.error('Error loading limits:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#10b981" />
            </View>
        );
    }

    if (limits.length === 0 || profile?.role !== 'company') {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Plan Kullanımı</Text>
            <View style={styles.grid}>
                {limits.map((item, index) => {
                    const Icon = item.icon;
                    const percent = item.max > 0 ? Math.min((item.current / item.max) * 100, 100) : 0;
                    const isNearLimit = percent >= 80;
                    const isAtLimit = percent >= 100;
                    const barColor = isAtLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : item.color;

                    return (
                        <View key={index} style={styles.limitCard}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconWrapper, { backgroundColor: item.color + '15' }]}>
                                    <Icon size={16} color={item.color} />
                                </View>
                                <Text style={styles.limitLabel}>{item.label}</Text>
                                <Text style={[styles.limitCount, isAtLimit && styles.limitCountDanger]}>
                                    {item.current}/{item.max}
                                </Text>
                            </View>
                            <View style={styles.barTrack}>
                                <View
                                    style={[
                                        styles.barFill,
                                        {
                                            width: `${percent}%` as any,
                                            backgroundColor: barColor,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        padding: 16,
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 14,
    },
    grid: {
        gap: 12,
    },
    limitCard: {
        gap: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconWrapper: {
        width: 28,
        height: 28,
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    limitLabel: {
        flex: 1,
        fontSize: 13,
        color: '#475569',
        fontWeight: '500',
    },
    limitCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    limitCountDanger: {
        color: '#ef4444',
    },
    barTrack: {
        height: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    barFill: {
        height: 6,
        borderRadius: 3,
    },
});
