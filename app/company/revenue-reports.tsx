import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, useWindowDimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DesktopLayout } from '@/components/DesktopLayout';
import {
    ChevronLeft, ChevronRight, ArrowLeft,
    TrendingUp, Users, Building2, Download,
    DollarSign, Package, CheckCircle2
} from 'lucide-react-native';

interface CustomerRow {
    key: string;
    customerId: string;
    customerName: string;
    branchId?: string;
    branchName?: string;
    visitCount: number;
    serviceRevenue: number;
    materialRevenue: number;
    total: number;
    pricingType: 'per_visit' | 'monthly' | 'none';
}

interface OperatorRow {
    operatorId: string;
    operatorName: string;
    visitCount: number;
    serviceRevenue: number;
    materialRevenue: number;
    total: number;
}

type ViewType = 'customer' | 'operator';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const getCurrencySymbol = (code: string) =>
    ({ TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[(code || '').toUpperCase()] || '₺');

export default function RevenueReports() {
    const router = useRouter();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [viewType, setViewType] = useState<ViewType>('customer');
    const [loading, setLoading] = useState(true);

    const [customerRows, setCustomerRows] = useState<CustomerRow[]>([]);
    const [operatorRows, setOperatorRows] = useState<OperatorRow[]>([]);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [currency, setCurrency] = useState('TRY');

    const sym = getCurrencySymbol(currency);

    useEffect(() => {
        if (!user) return;
        supabase
            .from('companies')
            .select('id, currency, owner_id')
            .eq('owner_id', user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    setCompanyId(data.id);
                    setCurrency(data.currency || 'TRY');
                }
            });
    }, [user]);

    const changeMonth = (dir: -1 | 1) => {
        let m = month + dir;
        let y = year;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        setMonth(m);
        setYear(y);
    };

    const loadCustomer = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

            const { data: operators } = await supabase
                .from('operators')
                .select('id')
                .eq('company_id', companyId);

            if (!operators || operators.length === 0) {
                setCustomerRows([]);
                setLoading(false);
                return;
            }

            const opIds = operators.map(o => o.id);

            const [visitsRes, cpRes, bpRes, matsRes] = await Promise.all([
                supabase
                    .from('visits')
                    .select(`
                        id, customer_id, branch_id, status, visit_date,
                        customer:customers!visits_customer_id_fkey(id, company_name),
                        branch:customer_branches!visits_branch_id_fkey(id, branch_name)
                    `)
                    .in('operator_id', opIds)
                    .eq('status', 'completed')
                    .gte('visit_date', startDate)
                    .lte('visit_date', endDate),

                supabase.from('customer_pricing').select('customer_id, per_visit_price, monthly_price'),
                supabase.from('branch_pricing').select('branch_id, per_visit_price, monthly_price'),

                supabase
                    .from('paid_material_sales')
                    .select('visit_id, customer_id, branch_id, total_amount')
                    .gte('sale_date', startDate.split('T')[0])
                    .lte('sale_date', endDate.split('T')[0]),
            ]);

            const visits = visitsRes.data || [];
            const cPricing = cpRes.data || [];
            const bPricing = bpRes.data || [];
            const mats = matsRes.data || [];

            const matByKey = new Map<string, number>();
            mats.forEach(m => {
                const k = m.branch_id ? `${m.customer_id}::${m.branch_id}` : m.customer_id;
                matByKey.set(k, (matByKey.get(k) || 0) + (m.total_amount || 0));
            });

            const rowMap = new Map<string, CustomerRow>();

            visits.forEach(v => {
                const customer = Array.isArray(v.customer) ? v.customer[0] : v.customer;
                const branch = Array.isArray(v.branch) ? v.branch[0] : v.branch;
                if (!customer) return;

                const key = v.branch_id ? `${v.customer_id}::${v.branch_id}` : v.customer_id;

                if (!rowMap.has(key)) {
                    const bp = bPricing.find(p => p.branch_id === v.branch_id);
                    const cp = cPricing.find(p => p.customer_id === v.customer_id);
                    const p = bp || cp;

                    let pricingType: CustomerRow['pricingType'] = 'none';
                    if (p?.monthly_price) pricingType = 'monthly';
                    else if (p?.per_visit_price) pricingType = 'per_visit';

                    rowMap.set(key, {
                        key,
                        customerId: v.customer_id,
                        customerName: customer.company_name || '—',
                        branchId: v.branch_id ?? undefined,
                        branchName: branch?.branch_name,
                        visitCount: 0,
                        serviceRevenue: 0,
                        materialRevenue: 0,
                        total: 0,
                        pricingType,
                    });
                }

                const row = rowMap.get(key)!;
                row.visitCount++;

                const bp = bPricing.find(p => p.branch_id === v.branch_id);
                const cp = cPricing.find(p => p.customer_id === v.customer_id);
                const p = bp || cp;

                if (p) {
                    if (row.pricingType === 'per_visit' && p.per_visit_price) {
                        row.serviceRevenue += parseFloat(p.per_visit_price);
                    } else if (row.pricingType === 'monthly' && p.monthly_price) {
                        row.serviceRevenue = parseFloat(p.monthly_price);
                    }
                }
            });

            rowMap.forEach((row, key) => {
                row.materialRevenue = matByKey.get(key) || 0;
                row.total = row.serviceRevenue + row.materialRevenue;
            });

            setCustomerRows(
                Array.from(rowMap.values()).sort((a, b) => b.total - a.total)
            );
        } catch (e) {
            console.error('Revenue customer error:', e);
        } finally {
            setLoading(false);
        }
    }, [companyId, month, year]);

    const loadOperator = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

            const { data: operators } = await supabase
                .from('operators')
                .select('id, full_name')
                .eq('company_id', companyId);

            if (!operators || operators.length === 0) {
                setOperatorRows([]);
                setLoading(false);
                return;
            }

            const opIds = operators.map(o => o.id);

            const [visitsRes, cpRes, bpRes, matsRes] = await Promise.all([
                supabase
                    .from('visits')
                    .select('id, operator_id, customer_id, branch_id, status')
                    .in('operator_id', opIds)
                    .eq('status', 'completed')
                    .gte('visit_date', startDate)
                    .lte('visit_date', endDate),

                supabase.from('customer_pricing').select('customer_id, per_visit_price, monthly_price'),
                supabase.from('branch_pricing').select('branch_id, per_visit_price, monthly_price'),

                supabase
                    .from('paid_material_sales')
                    .select('visit_id, total_amount')
                    .gte('sale_date', startDate.split('T')[0])
                    .lte('sale_date', endDate.split('T')[0]),
            ]);

            const visits = visitsRes.data || [];
            const cPricing = cpRes.data || [];
            const bPricing = bpRes.data || [];
            const mats = matsRes.data || [];

            const matByVisit = new Map<string, number>();
            mats.forEach(m => {
                if (m.visit_id) matByVisit.set(m.visit_id, (matByVisit.get(m.visit_id) || 0) + (m.total_amount || 0));
            });

            const rowMap = new Map<string, OperatorRow>();

            visits.forEach(v => {
                const op = operators.find(o => o.id === v.operator_id);
                if (!op) return;

                if (!rowMap.has(op.id)) {
                    rowMap.set(op.id, {
                        operatorId: op.id,
                        operatorName: op.full_name || '—',
                        visitCount: 0,
                        serviceRevenue: 0,
                        materialRevenue: 0,
                        total: 0,
                    });
                }

                const row = rowMap.get(op.id)!;
                row.visitCount++;

                const bp = bPricing.find(p => p.branch_id === v.branch_id);
                const cp = cPricing.find(p => p.customer_id === v.customer_id);
                const p = bp || cp;

                if (p?.per_visit_price) {
                    row.serviceRevenue += parseFloat(p.per_visit_price);
                } else if (p?.monthly_price) {
                    row.serviceRevenue = parseFloat(p.monthly_price);
                }

                row.materialRevenue += matByVisit.get(v.id) || 0;
                row.total = row.serviceRevenue + row.materialRevenue;
            });

            setOperatorRows(
                Array.from(rowMap.values()).sort((a, b) => b.total - a.total)
            );
        } catch (e) {
            console.error('Revenue operator error:', e);
        } finally {
            setLoading(false);
        }
    }, [companyId, month, year]);

    useEffect(() => {
        if (!companyId) return;
        if (viewType === 'customer') loadCustomer();
        else loadOperator();
    }, [viewType, companyId, month, year]);

    const totalRevenue = viewType === 'customer'
        ? customerRows.reduce((s, r) => s + r.total, 0)
        : operatorRows.reduce((s, r) => s + r.total, 0);

    const totalVisits = viewType === 'customer'
        ? customerRows.reduce((s, r) => s + r.visitCount, 0)
        : operatorRows.reduce((s, r) => s + r.visitCount, 0);

    const totalService = viewType === 'customer'
        ? customerRows.reduce((s, r) => s + r.serviceRevenue, 0)
        : operatorRows.reduce((s, r) => s + r.serviceRevenue, 0);

    const totalMaterial = viewType === 'customer'
        ? customerRows.reduce((s, r) => s + r.materialRevenue, 0)
        : operatorRows.reduce((s, r) => s + r.materialRevenue, 0);

    const handleExport = () => {
        if (Platform.OS !== 'web') return;
        let html = `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>`;

        if (viewType === 'customer') {
            html += `<th>Müşteri</th><th>Şube</th><th>Ziyaret</th><th>Hizmet</th><th>Malzeme</th><th>Toplam</th></tr></thead><tbody>`;
            customerRows.forEach(r => {
                html += `<tr><td>${r.customerName}</td><td>${r.branchName || '-'}</td><td>${r.visitCount}</td><td>${r.serviceRevenue.toFixed(2)}</td><td>${r.materialRevenue.toFixed(2)}</td><td>${r.total.toFixed(2)}</td></tr>`;
            });
        } else {
            html += `<th>Operatör</th><th>Ziyaret</th><th>Hizmet</th><th>Malzeme</th><th>Toplam</th></tr></thead><tbody>`;
            operatorRows.forEach(r => {
                html += `<tr><td>${r.operatorName}</td><td>${r.visitCount}</td><td>${r.serviceRevenue.toFixed(2)}</td><td>${r.materialRevenue.toFixed(2)}</td><td>${r.total.toFixed(2)}</td></tr>`;
            });
        }

        html += `</tbody></table></body></html>`;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ciro_${MONTHS[month]}_${year}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const Header = () => (
        <View style={styles.pageHeader}>
            <View>
                <Text style={styles.pageTitle}>Ciro Raporları</Text>
                <Text style={styles.pageSubtitle}>{MONTHS[month]} {year}</Text>
            </View>
            {Platform.OS === 'web' && (
                <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                    <Download size={16} color="#fff" />
                    <Text style={styles.exportBtnText}>Excel İndir</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const MonthSelector = () => (
        <View style={styles.monthRow}>
            <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
                <ChevronLeft size={18} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.monthText}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
                <ChevronRight size={18} color="#334155" />
            </TouchableOpacity>
        </View>
    );

    const ViewToggle = () => (
        <View style={styles.toggleRow}>
            <TouchableOpacity
                style={[styles.toggleBtn, viewType === 'customer' && styles.toggleBtnActive]}
                onPress={() => setViewType('customer')}
            >
                <Building2 size={15} color={viewType === 'customer' ? '#fff' : '#64748b'} />
                <Text style={[styles.toggleBtnText, viewType === 'customer' && styles.toggleBtnTextActive]}>
                    Müşteri / Şube
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.toggleBtn, viewType === 'operator' && styles.toggleBtnActive]}
                onPress={() => setViewType('operator')}
            >
                <Users size={15} color={viewType === 'operator' ? '#fff' : '#64748b'} />
                <Text style={[styles.toggleBtnText, viewType === 'operator' && styles.toggleBtnTextActive]}>
                    Operatör
                </Text>
            </TouchableOpacity>
        </View>
    );

    const SummaryCards = () => (
        <View style={styles.summaryCards}>
            <View style={[styles.summaryCard, { borderTopColor: '#10b981' }]}>
                <View style={styles.summaryIconBox}>
                    <TrendingUp size={18} color="#10b981" />
                </View>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>{sym}{totalRevenue.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>Toplam Ciro</Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#3b82f6' }]}>
                <View style={styles.summaryIconBox}>
                    <CheckCircle2 size={18} color="#3b82f6" />
                </View>
                <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>{totalVisits}</Text>
                <Text style={styles.summaryLabel}>Tamamlanan Ziyaret</Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#0ea5e9' }]}>
                <View style={styles.summaryIconBox}>
                    <DollarSign size={18} color="#0ea5e9" />
                </View>
                <Text style={[styles.summaryValue, { color: '#0ea5e9' }]}>{sym}{totalService.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>Hizmet Geliri</Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#f59e0b' }]}>
                <View style={styles.summaryIconBox}>
                    <Package size={18} color="#f59e0b" />
                </View>
                <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{sym}{totalMaterial.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>Malzeme Geliri</Text>
            </View>
        </View>
    );

    const CustomerTable = () => (
        <View style={styles.tableCard}>
            <View style={styles.tableCardHeader}>
                <Building2 size={17} color="#1e293b" />
                <Text style={styles.tableCardTitle}>Müşteri / Şube Bazlı Ciro</Text>
            </View>
            <View style={styles.tableHead}>
                <Text style={[styles.thCell, { flex: 2 }]}>Müşteri</Text>
                <Text style={[styles.thCell, { flex: 0.7, textAlign: 'center' }]}>Ziyaret</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Hizmet</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Malzeme</Text>
                <Text style={[styles.thCell, { flex: 1.1, textAlign: 'right' }]}>Toplam</Text>
            </View>
            {customerRows.length === 0 ? (
                <View style={styles.emptyBox}>
                    <DollarSign size={40} color="#cbd5e1" />
                    <Text style={styles.emptyText}>Bu ay için ciro kaydı bulunamadı</Text>
                </View>
            ) : (
                <>
                    {customerRows.map((row, i) => (
                        <View key={row.key} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                            <View style={{ flex: 2 }}>
                                <Text style={styles.tdMain} numberOfLines={1}>{row.customerName}</Text>
                                {row.branchName && (
                                    <Text style={styles.tdSub} numberOfLines={1}>{row.branchName}</Text>
                                )}
                                {row.pricingType !== 'none' && (
                                    <View style={[styles.pricingBadge,
                                        row.pricingType === 'monthly' ? styles.pricingBadgeMonthly : styles.pricingBadgePerVisit
                                    ]}>
                                        <Text style={[styles.pricingBadgeText,
                                            row.pricingType === 'monthly' ? styles.pricingBadgeTextMonthly : styles.pricingBadgeTextPerVisit
                                        ]}>
                                            {row.pricingType === 'monthly' ? 'Aylık' : 'Sefer Başı'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.tdCell, { flex: 0.7, textAlign: 'center' }]}>{row.visitCount}</Text>
                            <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>
                                {row.serviceRevenue > 0 ? `${sym}${row.serviceRevenue.toFixed(2)}` : '—'}
                            </Text>
                            <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>
                                {row.materialRevenue > 0 ? `${sym}${row.materialRevenue.toFixed(2)}` : '—'}
                            </Text>
                            <Text style={[styles.tdCell, styles.tdTotal, { flex: 1.1, textAlign: 'right' }]}>
                                {sym}{row.total.toFixed(2)}
                            </Text>
                        </View>
                    ))}
                    <View style={styles.tableFoot}>
                        <Text style={[styles.tfCell, { flex: 2 }]}>Genel Toplam</Text>
                        <Text style={[styles.tfCell, { flex: 0.7, textAlign: 'center' }]}>{totalVisits}</Text>
                        <Text style={[styles.tfCell, { flex: 1, textAlign: 'right' }]}>{sym}{totalService.toFixed(2)}</Text>
                        <Text style={[styles.tfCell, { flex: 1, textAlign: 'right' }]}>{sym}{totalMaterial.toFixed(2)}</Text>
                        <Text style={[styles.tfCell, styles.tfTotal, { flex: 1.1, textAlign: 'right' }]}>
                            {sym}{totalRevenue.toFixed(2)}
                        </Text>
                    </View>
                </>
            )}
        </View>
    );

    const OperatorTable = () => (
        <View style={styles.tableCard}>
            <View style={styles.tableCardHeader}>
                <Users size={17} color="#1e293b" />
                <Text style={styles.tableCardTitle}>Operatör Bazlı Ciro</Text>
            </View>
            <View style={styles.tableHead}>
                <Text style={[styles.thCell, { flex: 2 }]}>Operatör</Text>
                <Text style={[styles.thCell, { flex: 0.7, textAlign: 'center' }]}>Ziyaret</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Hizmet</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Malzeme</Text>
                <Text style={[styles.thCell, { flex: 1.1, textAlign: 'right' }]}>Toplam</Text>
            </View>
            {operatorRows.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Users size={40} color="#cbd5e1" />
                    <Text style={styles.emptyText}>Bu ay için operatör cirosu bulunamadı</Text>
                </View>
            ) : (
                <>
                    {operatorRows.map((row, i) => (
                        <View key={row.operatorId} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                            <Text style={[styles.tdMain, { flex: 2 }]} numberOfLines={1}>{row.operatorName}</Text>
                            <Text style={[styles.tdCell, { flex: 0.7, textAlign: 'center' }]}>{row.visitCount}</Text>
                            <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>
                                {row.serviceRevenue > 0 ? `${sym}${row.serviceRevenue.toFixed(2)}` : '—'}
                            </Text>
                            <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>
                                {row.materialRevenue > 0 ? `${sym}${row.materialRevenue.toFixed(2)}` : '—'}
                            </Text>
                            <Text style={[styles.tdCell, styles.tdTotal, { flex: 1.1, textAlign: 'right' }]}>
                                {sym}{row.total.toFixed(2)}
                            </Text>
                        </View>
                    ))}
                    <View style={styles.tableFoot}>
                        <Text style={[styles.tfCell, { flex: 2 }]}>Genel Toplam</Text>
                        <Text style={[styles.tfCell, { flex: 0.7, textAlign: 'center' }]}>{totalVisits}</Text>
                        <Text style={[styles.tfCell, { flex: 1, textAlign: 'right' }]}>{sym}{totalService.toFixed(2)}</Text>
                        <Text style={[styles.tfCell, { flex: 1, textAlign: 'right' }]}>{sym}{totalMaterial.toFixed(2)}</Text>
                        <Text style={[styles.tfCell, styles.tfTotal, { flex: 1.1, textAlign: 'right' }]}>
                            {sym}{totalRevenue.toFixed(2)}
                        </Text>
                    </View>
                </>
            )}
        </View>
    );

    const Content = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Header />
            <View style={styles.controlsRow}>
                <MonthSelector />
                <ViewToggle />
            </View>
            <SummaryCards />
            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Yükleniyor...</Text>
                </View>
            ) : viewType === 'customer' ? <CustomerTable /> : <OperatorTable />}
        </ScrollView>
    );

    if (isDesktop) {
        return <DesktopLayout><Content /></DesktopLayout>;
    }

    return (
        <View style={styles.mobileRoot}>
            <View style={styles.mobileHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.mobileHeaderTitle}>Ciro Raporları</Text>
                {Platform.OS === 'web' ? (
                    <TouchableOpacity onPress={handleExport} style={styles.backBtn}>
                        <Download size={20} color="#fff" />
                    </TouchableOpacity>
                ) : <View style={{ width: 38 }} />}
            </View>
            <Content />
        </View>
    );
}

const styles = StyleSheet.create({
    mobileRoot: { flex: 1, backgroundColor: '#f8fafc' },
    mobileHeader: {
        backgroundColor: '#10b981',
        paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
    mobileHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

    scrollContent: { padding: 16, paddingBottom: 48 },

    pageHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 20,
    },
    pageTitle: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
    pageSubtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
    exportBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 16,
        borderRadius: 10,
    },
    exportBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    controlsRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
        marginBottom: 20, flexWrap: 'wrap',
    },
    monthRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 10,
        borderWidth: 1, borderColor: '#e2e8f0',
        paddingVertical: 4,
    },
    monthNavBtn: {
        width: 36, height: 36,
        justifyContent: 'center', alignItems: 'center',
    },
    monthText: { fontSize: 14, fontWeight: '700', color: '#1e293b', minWidth: 130, textAlign: 'center' },

    toggleRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9', borderRadius: 10,
        padding: 4, gap: 4,
    },
    toggleBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 8, paddingHorizontal: 14,
        borderRadius: 8,
    },
    toggleBtnActive: { backgroundColor: '#10b981' },
    toggleBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    toggleBtnTextActive: { color: '#fff' },

    summaryCards: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
    summaryCard: {
        flex: 1, minWidth: 130,
        backgroundColor: '#fff', borderRadius: 14,
        padding: 16, borderTopWidth: 3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    summaryIconBox: { marginBottom: 8 },
    summaryValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    summaryLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },

    loadingBox: { height: 300, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#64748b' },

    tableCard: {
        backgroundColor: '#fff', borderRadius: 16,
        borderWidth: 1, borderColor: '#e2e8f0',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
        marginBottom: 24,
    },
    tableCardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
        backgroundColor: '#fafafa',
    },
    tableCardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    tableHead: {
        flexDirection: 'row', backgroundColor: '#f8fafc',
        paddingVertical: 10, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    thCell: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
    tableRow: {
        flexDirection: 'row', paddingVertical: 12,
        paddingHorizontal: 16, alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: '#f8fafc',
    },
    tableRowAlt: { backgroundColor: '#fafafa' },
    tdMain: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    tdSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
    tdCell: { fontSize: 13, color: '#334155' },
    tdTotal: { fontWeight: '700', color: '#10b981' },
    pricingBadge: {
        alignSelf: 'flex-start', marginTop: 3,
        paddingHorizontal: 6, paddingVertical: 1,
        borderRadius: 4,
    },
    pricingBadgeMonthly: { backgroundColor: '#eff6ff' },
    pricingBadgePerVisit: { backgroundColor: '#ecfdf5' },
    pricingBadgeText: { fontSize: 10, fontWeight: '600' },
    pricingBadgeTextMonthly: { color: '#3b82f6' },
    pricingBadgeTextPerVisit: { color: '#10b981' },
    tableFoot: {
        flexDirection: 'row', backgroundColor: '#f1f5f9',
        paddingVertical: 12, paddingHorizontal: 16,
        borderTopWidth: 1, borderTopColor: '#e2e8f0',
        alignItems: 'center',
    },
    tfCell: { fontSize: 13, fontWeight: '700', color: '#334155' },
    tfTotal: { color: '#10b981', fontSize: 14 },
    emptyBox: {
        paddingVertical: 48, alignItems: 'center', gap: 12,
    },
    emptyText: { fontSize: 14, color: '#94a3b8' },
});
