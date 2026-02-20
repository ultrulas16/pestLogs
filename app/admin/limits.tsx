import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, TextInput, Alert, useWindowDimensions
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

const TRIAL_DEFAULTS = { max_operators: 1, max_customers: 3, max_branches: 3, max_warehouses: 2 };

const STATUS_COLORS: Record<string, string> = {
    active: '#10b981',
    trial: '#f59e0b',
    expired: '#ef4444',
    cancelled: '#94a3b8',
};

const STATUS_LABELS: Record<string, string> = {
    active: 'Aktif',
    trial: 'Deneme',
    expired: 'Süresi Doldu',
    cancelled: 'İptal',
};

export default function AdminLimitsPage() {
    const router = useRouter();
    const { profile } = useAuth();
    const { width } = useWindowDimensions();

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
            // 1) Planları çek
            const plansRes = await supabase
                .from('subscription_plans')
                .select('id, name, billing_period, price_weekly, price_monthly, price_yearly, max_operators, max_customers, max_branches, max_warehouses')
                .eq('is_active', true)
                .order('display_order');

            if (plansRes.error) console.error('Planları çekerken hata:', plansRes.error);
            const planList: SubscriptionPlan[] = plansRes.data || [];
            setPlans(planList);

            // Plan map: id -> plan
            const planMap: Record<string, SubscriptionPlan> = {};
            planList.forEach(p => { planMap[p.id] = p; });

            // 2) Abonelikleri çek (join YOK)
            const subsRes = await supabase
                .from('subscriptions')
                .select('id, company_id, status, trial_ends_at, current_period_end, plan_id, max_operators, max_customers, max_branches, max_warehouses')
                .order('created_at', { ascending: false });

            if (subsRes.error) {
                console.error('Abonelikleri çekerken hata:', subsRes.error);
                Alert.alert('Veri Hatası', 'Abonelik verileri çekilemedi: ' + subsRes.error.message);
                setLoading(false);
                return;
            }

            const subs = subsRes.data || [];

            if (subs.length === 0) {
                setCompanies([]);
                setLoading(false);
                return;
            }

            // 3) Profilleri ve Şirketleri (companies) aynı anda çek
            const companyProfileIds = [...new Set(subs.map((s: any) => s.company_id).filter(Boolean))];
            const safeProfileIds = companyProfileIds.length > 0 ? companyProfileIds : ['00000000-0000-0000-0000-000000000000'];

            const [profilesRes, companiesRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, email, company_name').in('id', safeProfileIds),
                supabase.from('companies').select('id, owner_id, name').in('owner_id', safeProfileIds)
            ]);

            const profileMap: Record<string, any> = {};
            (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = p; });

            const companyTableMap: Record<string, any> = {}; // owner_id üzerinden eşleşecek
            const tableIds: string[] = []; // Gerçek companies.id'ler

            (companiesRes.data || []).forEach((c: any) => { 
                companyTableMap[c.owner_id] = c; 
                if(c.id) tableIds.push(c.id);
            });

            // 4) Mevcut kullanım sayıları - ARTIK HEPSİ İÇİN GERÇEK COMPANY ID (safeTableIds) KULLANILIYOR
            const safeTableIds = tableIds.length > 0 ? tableIds : ['00000000-0000-0000-0000-000000000000'];

            const [opCounts, custCounts, branchCounts, whCounts] = await Promise.all([
                supabase.from('operators').select('company_id').in('company_id', safeTableIds),
                supabase.from('customers').select('created_by_company_id').in('created_by_company_id', safeTableIds),
                supabase.from('customer_branches').select('created_by_company_id').in('created_by_company_id', safeTableIds),
                supabase.from('warehouses').select('company_id').in('company_id', safeTableIds),
            ]);

            const opByTable = buildCountMap((opCounts.data || []).map((r: any) => r.company_id));
            const custByTable = buildCountMap((custCounts.data || []).map((r: any) => r.created_by_company_id));
            const branchByTable = buildCountMap((branchCounts.data || []).map((r: any) => r.created_by_company_id));
            const whByTable = buildCountMap((whCounts.data || []).map((r: any) => r.company_id));

            // 5) Birleştir
            const result: CompanyLimit[] = subs.map((s: any) => {
                const owner = profileMap[s.company_id];
                const companyRecord = companyTableMap[s.company_id]; // Companies tablosundaki veri
                const tableId = companyRecord?.id || ''; // Gerçek companies ID'si

                const plan = s.plan_id ? planMap[s.plan_id] : null;

                const effectiveOps = s.max_operators ?? plan?.max_operators ?? TRIAL_DEFAULTS.max_operators;
                const effectiveCust = s.max_customers ?? plan?.max_customers ?? TRIAL_DEFAULTS.max_customers;
                const effectiveBranch = s.max_branches ?? plan?.max_branches ?? TRIAL_DEFAULTS.max_branches;
                const effectiveWh = s.max_warehouses ?? plan?.max_warehouses ?? TRIAL_DEFAULTS.max_warehouses;

                // Firma adını öncelikli olarak companies tablosundan (name), yoksa profiles tablosundan al
                const finalCompanyName = companyRecord?.name || owner?.company_name || owner?.full_name || 'İsimsiz Firma';

                return {
                    subId: s.id,
                    companyProfileId: s.company_id || '',
                    companyName: finalCompanyName,
                    email: owner?.email || '—',
                    status: s.status,
                    trialEndsAt: s.trial_ends_at,
                    currentPeriodEnd: s.current_period_end,
                    planId: s.plan_id,
                    planName: plan?.name || null,
                    planBillingPeriod: plan?.billing_period || null,
                    maxOperators: effectiveOps,
                    maxCustomers: effectiveCust,
                    maxBranches: effectiveBranch,
                    maxWarehouses: effectiveWh,
                    overrideOperators: s.max_operators?.toString() || '',
                    overrideCustomers: s.max_customers?.toString() || '',
                    overrideBranches: s.max_branches?.toString() || '',
                    overrideWarehouses: s.max_warehouses?.toString() || '',
                    // Artık s.company_id (profile id) değil, gerçek veritabanı ID'si (tableId) kullanılıyor
                    currentOperators: opByTable[tableId] || 0,
                    currentCustomers: custByTable[tableId] || 0,
                    currentBranches: branchByTable[tableId] || 0,
                    currentWarehouses: whByTable[tableId] || 0,
                };
            });

            setCompanies(result);
        } catch (e: any) {
            console.error('Admin limits load error:', e);
            Alert.alert('Hata', 'Beklenmeyen bir hata oluştu: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const buildCountMap = (ids: string[]): Record<string, number> => {
        const map: Record<string, number> = {};
        ids.forEach(id => { if (id) map[id] = (map[id] || 0) + 1; });
        return map;
    };

    const computePeriodEnd = (billingPeriod: string | null): string => {
        const now = new Date();
        switch (billingPeriod) {
            case 'weekly': now.setDate(now.getDate() + 7); break;
            case 'yearly': now.setFullYear(now.getFullYear() + 1); break;
            case 'trial': now.setDate(now.getDate() + 7); break;
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
            Alert.alert('Başarılı', `${company.companyName} aboneliği güncellendi`);
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

    if (loading) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

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
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>{companies.length}</Text>
                        <Text style={styles.statLabel}>Toplam Firma</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, { color: '#10b981' }]}>
                            {companies.filter(c => c.status === 'active').length}
                        </Text>
                        <Text style={styles.statLabel}>Aktif</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, { color: '#f59e0b' }]}>
                            {companies.filter(c => c.status === 'trial').length}
                        </Text>
                        <Text style={styles.statLabel}>Deneme</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, { color: '#ef4444' }]}>
                            {companies.filter(c => c.status === 'expired').length}
                        </Text>
                        <Text style={styles.statLabel}>Doldu</Text>
                    </View>
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
                                        {company.planName && (
                                            <View style={styles.planBadge}>
                                                <Text style={styles.planBadgeText}>
                                                    {company.planName}
                                                    {company.planBillingPeriod === 'weekly' ? ' · Haftalık' : company.planBillingPeriod === 'yearly' ? ' · Yıllık' : company.planBillingPeriod === 'monthly' ? ' · Aylık' : ''}
                                                </Text>
                                            </View>
                                        )}
                                        {company.currentPeriodEnd && (
                                            <View style={styles.dateBadge}>
                                                <Text style={styles.dateBadgeText}>
                                                    Bitiş: {new Date(company.currentPeriodEnd).toLocaleDateString('tr-TR')}
                                                </Text>
                                            </View>
                                        )}
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
                                    {isOpen
                                        ? <ChevronUp size={18} color="#94a3b8" />
                                        : <ChevronDown size={18} color="#94a3b8" />
                                    }
                                </View>
                            </TouchableOpacity>

                            {isOpen && (
                                <View style={styles.cardBody}>
                                    <Text style={styles.sectionTitle}>Plan Seç</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planScroll}>
                                        <TouchableOpacity
                                            style={[styles.planChip, !company.planId && styles.planChipActive]}
                                            onPress={() => updateField(company.subId, 'planId', '')}
                                        >
                                            <Text style={[styles.planChipText, !company.planId && styles.planChipTextActive]}>
                                                Deneme
                                            </Text>
                                            <Text style={[styles.planChipSub, !company.planId && { color: '#fff' }]}>
                                                7 Gün
                                            </Text>
                                        </TouchableOpacity>
                                        {plans.map(p => (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={[styles.planChip, company.planId === p.id && styles.planChipActive]}
                                                onPress={() => updateField(company.subId, 'planId', p.id)}
                                            >
                                                <Text style={[styles.planChipText, company.planId === p.id && styles.planChipTextActive]}>
                                                    {p.name}
                                                </Text>
                                                <Text style={[styles.planChipSub, company.planId === p.id && { color: '#fff' }]}>
                                                    {p.billing_period === 'weekly'
                                                        ? `${p.price_weekly.toFixed(0)}₺/Hf`
                                                        : p.billing_period === 'yearly'
                                                        ? `${p.price_yearly.toFixed(0)}₺/Yıl`
                                                        : `${p.price_monthly.toFixed(0)}₺/Ay`}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {company.planId && (() => {
                                        const selectedPlan = plans.find(p => p.id === company.planId);
                                        if (!selectedPlan) return null;
                                        return (
                                            <View style={styles.planPreviewBox}>
                                                <Text style={styles.planPreviewTitle}>
                                                    {selectedPlan.name} — {selectedPlan.billing_period === 'weekly' ? 'Haftalık (7 gün)' : selectedPlan.billing_period === 'yearly' ? 'Yıllık' : 'Aylık'}
                                                </Text>
                                                <View style={styles.planPreviewLimits}>
                                                    {[
                                                        { label: 'Operatör', value: selectedPlan.max_operators },
                                                        { label: 'Müşteri', value: selectedPlan.max_customers },
                                                        { label: 'Şube', value: selectedPlan.max_branches },
                                                        { label: 'Depo', value: selectedPlan.max_warehouses },
                                                    ].map(item => (
                                                        <View key={item.label} style={styles.planPreviewChip}>
                                                            <Text style={styles.planPreviewNum}>{item.value}</Text>
                                                            <Text style={styles.planPreviewLabel}>{item.label}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        );
                                    })()}

                                    <Text style={styles.sectionTitle}>Özel Limitler <Text style={styles.sectionHint}>(boş = plan/deneme varsayılanı)</Text></Text>

                                    <View style={styles.limitsGrid}>
                                        {[
                                            { field: 'overrideOperators' as const, label: 'Operatör', icon: Users, current: company.currentOperators, max: company.maxOperators, color: '#10b981' },
                                            { field: 'overrideCustomers' as const, label: 'Müşteri', icon: Building2, current: company.currentCustomers, max: company.maxCustomers, color: '#3b82f6' },
                                            { field: 'overrideBranches' as const, label: 'Şube', icon: GitBranch, current: company.currentBranches, max: company.maxBranches, color: '#f59e0b' },
                                            { field: 'overrideWarehouses' as const, label: 'Depo', icon: Warehouse, current: company.currentWarehouses, max: company.maxWarehouses, color: '#f97316' },
                                        ].map(item => {
                                            const Icon = item.icon;
                                            const pct = item.max > 0 ? Math.min((item.current / item.max) * 100, 100) : 0;
                                            const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : item.color;
                                            return (
                                                <View key={item.field} style={styles.limitCard}>
                                                    <View style={styles.limitCardTop}>
                                                        <View style={[styles.limitIcon, { backgroundColor: item.color + '15' }]}>
                                                            <Icon size={14} color={item.color} />
                                                        </View>
                                                        <Text style={styles.limitLabel}>{item.label}</Text>
                                                        <Text style={[styles.limitCount, pct >= 100 && { color: '#ef4444' }]}>
                                                            {item.current}/{item.max}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.barTrack}>
                                                        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                                                    </View>
                                                    <TextInput
                                                        style={styles.limitInput}
                                                        value={(company as any)[item.field]}
                                                        onChangeText={v => updateField(company.subId, item.field, v)}
                                                        keyboardType="numeric"
                                                        placeholder={`Limit (şu an: ${item.max})`}
                                                        placeholderTextColor="#94a3b8"
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
                                            : <>
                                                <Save size={16} color="#fff" />
                                                <Text style={styles.saveBtnText}>Kaydet</Text>
                                            </>
                                        }
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}

                {filtered.length === 0 && (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>Firma bulunamadı</Text>
                    </View>
                )}

                <View style={{ height: 48 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        backgroundColor: '#10b981',
        paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14, marginBottom: 4,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    },
    searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
    scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statBox: {
        flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center',
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    statNum: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    card: {
        backgroundColor: '#fff', borderRadius: 14, marginBottom: 12,
        borderWidth: 1, borderColor: '#e2e8f0',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center',
        padding: 14, gap: 10,
    },
    cardHeaderLeft: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
    cardEmail: { fontSize: 12, color: '#94a3b8', marginBottom: 6 },
    badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    planBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' },
    planBadgeText: { fontSize: 11, fontWeight: '600', color: '#15803d' },
    dateBadge: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd' },
    dateBadgeText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    miniLimits: { alignItems: 'center' },
    miniLimit: { fontSize: 13, fontWeight: '700', color: '#334155' },
    miniLimitLabel: { fontSize: 10, color: '#94a3b8' },
    cardBody: {
        borderTopWidth: 1, borderTopColor: '#f1f5f9',
        padding: 14, gap: 12,
    },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
    sectionHint: { fontSize: 11, fontWeight: '400', color: '#94a3b8' },
    planScroll: { marginBottom: 4 },
    planChip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8,
        borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff',
    },
    planChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    planChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    planChipTextActive: { color: '#fff' },
    planChipSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
    planPreviewBox: {
        backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10,
        borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 4,
    },
    planPreviewTitle: { fontSize: 12, fontWeight: '700', color: '#15803d', marginBottom: 8 },
    planPreviewLimits: { flexDirection: 'row', gap: 8 },
    planPreviewChip: {
        flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 6,
        alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0',
    },
    planPreviewNum: { fontSize: 15, fontWeight: '800', color: '#15803d' },
    planPreviewLabel: { fontSize: 10, color: '#64748b', marginTop: 1 },
    limitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    limitCard: {
        width: '47%', backgroundColor: '#f8fafc',
        borderRadius: 10, padding: 10, gap: 6,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    limitCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    limitIcon: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    limitLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#475569' },
    limitCount: { fontSize: 12, fontWeight: '700', color: '#334155' },
    barTrack: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
    barFill: { height: 4, borderRadius: 2 },
    limitInput: {
        backgroundColor: '#fff', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7,
        fontSize: 13, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b',
    },
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: '#10b981', borderRadius: 10,
        paddingVertical: 12, marginTop: 4,
    },
    saveBtnDisabled: { backgroundColor: '#6ee7b7' },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    emptyBox: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 14, color: '#94a3b8' },
});