import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, TextInput, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
    ArrowLeft, Users, Building2, GitBranch, Warehouse,
    Search, ChevronDown, ChevronUp, Save, RefreshCw
} from 'lucide-react-native';

interface SubscriptionPlan {
    id: string;
    name: string;
    billing_period: string;
    price_weekly: number;
    price_monthly: number;
    price_yearly: number;
    max_operators: number;
    max_customers: number;
    max_branches: number;
    max_warehouses: number;
}

interface CompanyLimit {
    subId: string;
    companyId: string;
    companyProfileId: string;
    companyName: string;
    email: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    planId: string | null;
    planName: string | null;
    planBillingPeriod: string | null;
    maxOperators: number;
    maxCustomers: number;
    maxBranches: number;
    maxWarehouses: number;
    overrideOperators: string;
    overrideCustomers: string;
    overrideBranches: string;
    overrideWarehouses: string;
    currentOperators: number;
    currentCustomers: number;
    currentBranches: number;
    currentWarehouses: number;
}

const STATUS_COLORS: Record<string, string> = {
    active: '#10b981', trial: '#f59e0b', expired: '#ef4444', cancelled: '#94a3b8',
};
const STATUS_LABELS: Record<string, string> = {
    active: 'Aktif', trial: 'Deneme', expired: 'Süresi Doldu', cancelled: 'İptal',
};

export default function AdminLimitsPage() {
    const router = useRouter();
    const { profile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [companies, setCompanies] = useState<CompanyLimit[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.role !== 'admin') { router.replace('/'); return; }
        loadData();
    }, [profile]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Planları Çek
            const { data: planData, error: planErr } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('is_active', true)
                .order('display_order');

            if (planErr) console.error('Plan hatası:', planErr);
            setPlans(planData || []);

            const planMap: Record<string, SubscriptionPlan> = {};
            (planData || []).forEach((p: any) => { planMap[p.id] = p; });

            // 2. Abonelikleri Çek
            const { data: subs, error: subErr } = await supabase
                .from('subscriptions')
                .select('*')
                .order('created_at', { ascending: false });

            if (subErr) { Alert.alert('Hata', subErr.message); setLoading(false); return; }
            if (!subs || subs.length === 0) { setCompanies([]); setLoading(false); return; }

            // 3. Şirket ve Profil Eşleştirmesi
            const profileIds = [...new Set(subs.map((s: any) => s.company_id).filter(Boolean))] as string[];
            const safeProfileIds = profileIds.length > 0 ? profileIds : ['00000000-0000-0000-0000-000000000000'];

            const { data: companiesData } = await supabase
                .from('companies')
                .select('id, owner_id, name')
                .in('owner_id', safeProfileIds);

            const profileToCompanyMap: Record<string, any> = {};
            const realCompanyIds: string[] = [];
            (companiesData || []).forEach((c: any) => { 
                profileToCompanyMap[c.owner_id] = c; 
                if(c.id) realCompanyIds.push(c.id);
            });

            const safeCompanyIds = realCompanyIds.length > 0 ? realCompanyIds : ['00000000-0000-0000-0000-000000000000'];

            // 4. Profil Bilgileri
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, full_name, email, company_name')
                .in('id', safeProfileIds);

            const profileMap: Record<string, any> = {};
            (profilesData || []).forEach((p: any) => { profileMap[p.id] = p; });

            // 5. KULLANIM VERİLERİNİ ÇEKME (OR SORGUSU İLE ÇİFT DİKİŞ)
            const [opRes, custRes, brRes, whRes] = await Promise.all([
                supabase.from('operators').select('company_id').or(`company_id.in.(${safeCompanyIds.join(',')}),company_id.in.(${safeProfileIds.join(',')})`),
                supabase.from('customers').select('created_by_company_id').or(`created_by_company_id.in.(${safeCompanyIds.join(',')}),created_by_company_id.in.(${safeProfileIds.join(',')})`),
                supabase.from('customer_branches').select('created_by_company_id').or(`created_by_company_id.in.(${safeCompanyIds.join(',')}),created_by_company_id.in.(${safeProfileIds.join(',')})`),
                supabase.from('warehouses').select('company_id').or(`company_id.in.(${safeCompanyIds.join(',')}),company_id.in.(${safeProfileIds.join(',')})`),
            ]);

            // Güvenli Sayma Fonksiyonu
            const getCounts = (data: any[], key: string) => {
                const map: Record<string, number> = {};
                (data || []).forEach(r => { if (r[key]) map[r[key]] = (map[r[key]] || 0) + 1; });
                return map;
            };

            const opCounts = getCounts(opRes.data, 'company_id');
            const custCounts = getCounts(custRes.data, 'created_by_company_id');
            const brCounts = getCounts(brRes.data, 'created_by_company_id');
            const whCounts = getCounts(whRes.data, 'company_id');

            // 6. Verileri Birleştir
            const result: CompanyLimit[] = subs.map((s: any) => {
                const pId = s.company_id;
                const co = profileToCompanyMap[pId];
                const realCoId = co?.id;
                const own = profileMap[pId];
                const plan = s.plan_id ? planMap[s.plan_id] : null;

                // Hem profile_id hem real_company_id üzerinden gelenleri topla
                const currentOps = (opCounts[pId] || 0) + (realCoId ? (opCounts[realCoId] || 0) : 0);
                const currentCusts = (custCounts[pId] || 0) + (realCoId ? (custCounts[realCoId] || 0) : 0);
                const currentBrs = (brCounts[pId] || 0) + (realCoId ? (brCounts[realCoId] || 0) : 0);
                const currentWhs = (whCounts[pId] || 0) + (realCoId ? (whCounts[realCoId] || 0) : 0);

                return {
                    subId: s.id,
                    companyId: realCoId || '',
                    companyProfileId: pId || '',
                    companyName: co?.name || own?.company_name || own?.full_name || 'İsimsiz Firma',
                    email: own?.email || '—',
                    status: s.status,
                    trialEndsAt: s.trial_ends_at,
                    currentPeriodEnd: s.current_period_end,
                    planId: s.plan_id,
                    planName: plan?.name || null,
                    planBillingPeriod: plan?.billing_period || null,
                    maxOperators: s.max_operators ?? plan?.max_operators ?? 1,
                    maxCustomers: s.max_customers ?? plan?.max_customers ?? 3,
                    maxBranches: s.max_branches ?? plan?.max_branches ?? 3,
                    maxWarehouses: s.max_warehouses ?? plan?.max_warehouses ?? 2,
                    overrideOperators: s.max_operators?.toString() || '',
                    overrideCustomers: s.max_customers?.toString() || '',
                    overrideBranches: s.max_branches?.toString() || '',
                    overrideWarehouses: s.max_warehouses?.toString() || '',
                    currentOperators: currentOps,
                    currentCustomers: currentCusts,
                    currentBranches: currentBrs,
                    currentWarehouses: currentWhs,
                };
            });

            setCompanies(result);
        } catch (e: any) {
            Alert.alert('Hata', e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const computePeriodEnd = (billingPeriod: string | null): string => {
        const now = new Date();
        switch (billingPeriod) {
            case 'weekly': now.setDate(now.getDate() + 7); break;
            case 'yearly': now.setFullYear(now.getFullYear() + 1); break;
            default: now.setMonth(now.getMonth() + 1);
        }
        return now.toISOString();
    };

    const handleSave = async (company: CompanyLimit) => {
        setSaving(company.subId);
        try {
            const selectedPlan = plans.find(p => p.id === company.planId);
            const newPeriodEnd = selectedPlan ? computePeriodEnd(selectedPlan.billing_period) : null;

            const { error } = await supabase
                .from('subscriptions')
                .update({
                    plan_id: company.planId || null,
                    max_operators: company.overrideOperators ? parseInt(company.overrideOperators) : null,
                    max_customers: company.overrideCustomers ? parseInt(company.overrideCustomers) : null,
                    max_branches: company.overrideBranches ? parseInt(company.overrideBranches) : null,
                    max_warehouses: company.overrideWarehouses ? parseInt(company.overrideWarehouses) : null,
                    current_period_end: newPeriodEnd,
                    status: company.planId ? 'active' : company.status,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', company.subId);

            if (error) throw error;
            Alert.alert('Başarılı', company.companyName + ' güncellendi');
            loadData();
        } catch (e: any) {
            Alert.alert('Hata', e.message);
        } finally {
            setSaving(null);
        }
    };

    const updateField = (subId: string, field: keyof CompanyLimit, value: string) => {
        setCompanies(prev => prev.map(c => c.subId === subId ? { ...c, [field]: value } : c));
    };

    const filtered = companies.filter(c =>
        c.companyName.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <View style={styles.loadingBox}><ActivityIndicator size="large" color="#10b981" /></View>;

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Limit Yönetimi</Text>
                <TouchableOpacity style={styles.backBtn} onPress={loadData}>
                    <RefreshCw size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Firma ara..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor="#94a3b8"
                />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.statsRow}>
                    {[
                        { label: 'Toplam', val: companies.length, color: '#1e293b' },
                        { label: 'Aktif', val: companies.filter(c => c.status === 'active').length, color: '#10b981' },
                        { label: 'Deneme', val: companies.filter(c => c.status === 'trial').length, color: '#f59e0b' },
                        { label: 'Doldu', val: companies.filter(c => c.status === 'expired').length, color: '#ef4444' },
                    ].map(s => (
                        <View key={s.label} style={styles.statBox}>
                            <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
                            <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {filtered.map(company => {
                    const isOpen = expanded === company.subId;
                    const statusColor = STATUS_COLORS[company.status] || '#94a3b8';
                    return (
                        <View key={company.subId} style={styles.card}>
                            <TouchableOpacity
                                style={styles.cardHeader}
                                onPress={() => setExpanded(isOpen ? null : company.subId)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.cardHeaderLeft}>
                                    <Text style={styles.cardName} numberOfLines={1}>{company.companyName}</Text>
                                    <Text style={styles.cardEmail} numberOfLines={1}>{company.email}</Text>
                                    <View style={styles.badgeRow}>
                                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                                            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                                                {STATUS_LABELS[company.status] || company.status}
                                            </Text>
                                        </View>
                                        {company.planName ? (
                                            <View style={styles.planBadge}>
                                                <Text style={styles.planBadgeText}>
                                                    {company.planName}
                                                    {company.planBillingPeriod === 'weekly' ? ' · Hf' : company.planBillingPeriod === 'yearly' ? ' · Yıl' : ' · Ay'}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                                <View style={styles.cardHeaderRight}>
                                    <View style={styles.miniLimits}>
                                        <Text style={styles.miniLimit}>{company.currentOperators}/{company.maxOperators}</Text>
                                        <Text style={styles.miniLimitLabel}>Op</Text>
                                    </View>
                                    <View style={styles.miniLimits}>
                                        <Text style={styles.miniLimit}>{company.currentCustomers}/{company.maxCustomers}</Text>
                                        <Text style={styles.miniLimitLabel}>Müş</Text>
                                    </View>
                                    {isOpen ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                </View>
                            </TouchableOpacity>

                            {isOpen ? (
                                <View style={styles.cardBody}>
                                    <Text style={styles.sectionTitle}>Plan Seçimi</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planScroll}>
                                        <TouchableOpacity
                                            style={[styles.planChip, !company.planId && styles.planChipActive]}
                                            onPress={() => updateField(company.subId, 'planId', '')}
                                        >
                                            <Text style={[styles.planChipText, !company.planId && styles.planChipTextActive]}>Deneme</Text>
                                        </TouchableOpacity>
                                        {plans.map(p => (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={[styles.planChip, company.planId === p.id && styles.planChipActive]}
                                                onPress={() => updateField(company.subId, 'planId', p.id)}
                                            >
                                                <Text style={[styles.planChipText, company.planId === p.id && styles.planChipTextActive]}>{p.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    <Text style={styles.sectionTitle}>Limit Düzenleme</Text>
                                    <View style={styles.limitsGrid}>
                                        {[
                                            { field: 'overrideOperators' as const, label: 'Operatör', icon: Users, current: company.currentOperators, max: company.maxOperators, color: '#10b981' },
                                            { field: 'overrideCustomers' as const, label: 'Müşteri', icon: Building2, current: company.currentCustomers, max: company.maxCustomers, color: '#3b82f6' },
                                            { field: 'overrideBranches' as const, label: 'Şube', icon: GitBranch, current: company.currentBranches, max: company.maxBranches, color: '#f59e0b' },
                                            { field: 'overrideWarehouses' as const, label: 'Depo', icon: Warehouse, current: company.currentWarehouses, max: company.maxWarehouses, color: '#f97316' },
                                        ].map(item => {
                                            const Icon = item.icon;
                                            return (
                                                <View key={item.field} style={styles.limitCard}>
                                                    <View style={styles.limitCardTop}>
                                                        <Icon size={14} color={item.color} />
                                                        <Text style={styles.limitLabel}>{item.label}</Text>
                                                        <Text style={styles.limitCount}>{item.current}/{item.max}</Text>
                                                    </View>
                                                    <TextInput
                                                        style={styles.limitInput}
                                                        value={(company as any)[item.field]}
                                                        onChangeText={v => updateField(company.subId, item.field, v)}
                                                        keyboardType="numeric"
                                                        placeholder={item.max.toString()}
                                                    />
                                                </View>
                                            );
                                        })}
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.saveBtn, saving === company.subId && styles.saveBtnDisabled]}
                                        onPress={() => handleSave(company)}
                                        disabled={saving === company.subId}
                                    >
                                        {saving === company.subId
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <><Save size={16} color="#fff" /><Text style={styles.saveBtnText}>Kaydet</Text></>
                                        }
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                        </View>
                    );
                })}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { backgroundColor: '#10b981', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
    scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    statNum: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    cardHeaderLeft: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
    cardEmail: { fontSize: 12, color: '#94a3b8', marginBottom: 6 },
    badgeRow: { flexDirection: 'row', gap: 6 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    planBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' },
    planBadgeText: { fontSize: 11, fontWeight: '600', color: '#15803d' },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    miniLimits: { alignItems: 'center' },
    miniLimit: { fontSize: 13, fontWeight: '700', color: '#334155' },
    miniLimitLabel: { fontSize: 10, color: '#94a3b8' },
    cardBody: { borderTopWidth: 1, borderTopColor: '#f1f5f9', padding: 14, gap: 12 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
    planScroll: { marginBottom: 4 },
    planChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
    planChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    planChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    planChipTextActive: { color: '#fff' },
    limitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    limitCard: { width: '47%', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    limitCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    limitLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#475569' },
    limitCount: { fontSize: 11, fontWeight: '700', color: '#334155' },
    limitInput: { backgroundColor: '#fff', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 12, marginTop: 4 },
    saveBtnDisabled: { backgroundColor: '#6ee7b7' },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});