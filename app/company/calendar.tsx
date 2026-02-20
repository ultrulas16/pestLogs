import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Modal, useWindowDimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DesktopLayout } from '@/components/DesktopLayout';
import {
    ChevronLeft, ChevronRight, Search, X, ArrowLeft,
    User, Building2, Calendar, CheckCircle2, Clock, XCircle,
    MapPin, FileText, Package, TrendingUp
} from 'lucide-react-native';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    isToday, addMonths, subMonths, getDay, parseISO
} from 'date-fns';
import { tr } from 'date-fns/locale';

interface Visit {
    id: string;
    customer_id: string;
    branch_id: string | null;
    operator_id: string | null;
    visit_date: string;
    status: string;
    visit_type: string;
    notes: string | null;
    report_number: string | null;
    is_invoiced: boolean;
    is_checked: boolean;
    customer: { id: string; company_name: string } | null;
    branch: { id: string; branch_name: string } | null;
    operator: { id: string; full_name: string } | null;
    material_revenue: number;
    service_revenue: number;
    total_revenue: number;
}

interface DaySummary {
    date: string;
    visits: Visit[];
    completedCount: number;
    totalRevenue: number;
}

interface RevenueSummaryRow {
    id: string;
    name: string;
    subName?: string;
    visits: number;
    materialRevenue: number;
    serviceRevenue: number;
    total: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    completed: { label: 'Tamamlandı', color: '#10b981', bg: '#ecfdf5', icon: CheckCircle2 },
    planned:   { label: 'Planlandı',  color: '#3b82f6', bg: '#eff6ff', icon: Clock },
    cancelled: { label: 'İptal',      color: '#ef4444', bg: '#fef2f2', icon: XCircle },
    in_progress: { label: 'Devam Ediyor', color: '#f59e0b', bg: '#fffbeb', icon: Clock },
};

const getCurrencySymbol = (code: string) =>
    ({ TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[code.toUpperCase()] || '₺');

export default function CompanyCalendar() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDay, setSelectedDay] = useState<DaySummary | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
    const [companyCurrency, setCompanyCurrency] = useState('TRY');
    const [companyId, setCompanyId] = useState<string | null>(null);

    const monthLabel = format(currentDate, 'MMMM yyyy', { locale: tr });
    const monthDays = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
    const startOffset = (getDay(startOfMonth(currentDate)) + 6) % 7;

    useEffect(() => {
        loadCompany();
    }, [user]);

    const loadCompany = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('companies')
            .select('id, currency')
            .eq('owner_id', user.id)
            .maybeSingle();
        if (data) {
            setCompanyCurrency(data.currency || 'TRY');
            setCompanyId(data.id);
        }
    };

    const fetchVisits = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();

            const { data: operators } = await supabase
                .from('operators')
                .select('id, full_name')
                .eq('company_id', companyId);

            if (!operators || operators.length === 0) {
                setVisits([]);
                setLoading(false);
                return;
            }

            const opIds = operators.map(o => o.id);
            const opMap = new Map(operators.map(o => [o.id, o]));

            const [visitsRes, pricingRes, branchPricingRes, materialsRes] = await Promise.all([
                supabase
                    .from('visits')
                    .select(`
                        id, customer_id, branch_id, operator_id, visit_date,
                        status, visit_type, notes, report_number, is_invoiced, is_checked,
                        customer:customers!visits_customer_id_fkey(id, company_name),
                        branch:customer_branches!visits_branch_id_fkey(id, branch_name)
                    `)
                    .in('operator_id', opIds)
                    .gte('visit_date', start)
                    .lte('visit_date', end)
                    .order('visit_date', { ascending: true }),

                supabase
                    .from('customer_pricing')
                    .select('customer_id, per_visit_price, monthly_price'),

                supabase
                    .from('branch_pricing')
                    .select('branch_id, per_visit_price, monthly_price'),

                supabase
                    .from('paid_material_sales')
                    .select('visit_id, total_amount')
                    .gte('sale_date', start.split('T')[0])
                    .lte('sale_date', end.split('T')[0]),
            ]);

            const pricing = pricingRes.data || [];
            const bPricing = branchPricingRes.data || [];
            const materials = materialsRes.data || [];

            const materialByVisit = new Map<string, number>();
            materials.forEach(m => {
                if (m.visit_id)
                    materialByVisit.set(m.visit_id, (materialByVisit.get(m.visit_id) || 0) + (m.total_amount || 0));
            });

            const processed: Visit[] = (visitsRes.data || []).map(v => {
                let serviceRev = 0;
                const bp = bPricing.find(p => p.branch_id === v.branch_id);
                const cp = pricing.find(p => p.customer_id === v.customer_id);
                const p = bp || cp;
                if (p?.per_visit_price) serviceRev = parseFloat(p.per_visit_price);
                else if (p?.monthly_price) serviceRev = parseFloat(p.monthly_price);

                const matRev = materialByVisit.get(v.id) || 0;
                const op = v.operator_id ? opMap.get(v.operator_id) : null;
                return {
                    ...v,
                    customer: Array.isArray(v.customer) ? v.customer[0] : v.customer,
                    branch: Array.isArray(v.branch) ? v.branch[0] : v.branch,
                    operator: op ? { id: op.id, full_name: op.full_name } : null,
                    material_revenue: matRev,
                    service_revenue: serviceRev,
                    total_revenue: matRev + serviceRev,
                };
            });

            setVisits(processed);
        } catch (err) {
            console.error('Calendar fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [currentDate, companyId]);

    useEffect(() => {
        fetchVisits();
    }, [fetchVisits]);

    const filteredVisits = useMemo(() => {
        if (!searchQuery.trim()) return visits;
        const q = searchQuery.toLowerCase();
        return visits.filter(v =>
            v.customer?.company_name?.toLowerCase().includes(q) ||
            v.branch?.branch_name?.toLowerCase().includes(q) ||
            v.operator?.full_name?.toLowerCase().includes(q)
        );
    }, [visits, searchQuery]);

    const visitsByDay = useMemo(() => {
        const map = new Map<string, Visit[]>();
        filteredVisits.forEach(v => {
            const key = format(parseISO(v.visit_date), 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(v);
        });
        return map;
    }, [filteredVisits]);

    const stats = useMemo(() => {
        const total = filteredVisits.length;
        const completed = filteredVisits.filter(v => v.status === 'completed').length;
        const revenue = filteredVisits
            .filter(v => v.status === 'completed')
            .reduce((sum, v) => sum + v.total_revenue, 0);
        const pending = filteredVisits.filter(v => v.status === 'planned' || v.status === 'in_progress').length;
        return { total, completed, revenue, pending };
    }, [filteredVisits]);

    const revenueSummary = useMemo(() => {
        const customerMap = new Map<string, RevenueSummaryRow>();
        const operatorMap = new Map<string, RevenueSummaryRow>();

        filteredVisits.filter(v => v.status === 'completed').forEach(v => {
            if (v.customer_id) {
                const key = v.branch_id ? `${v.customer_id}::${v.branch_id}` : v.customer_id;
                const ex = customerMap.get(key) || {
                    id: key,
                    name: v.customer?.company_name || '—',
                    subName: v.branch?.branch_name,
                    visits: 0, materialRevenue: 0, serviceRevenue: 0, total: 0,
                };
                ex.visits++;
                ex.materialRevenue += v.material_revenue;
                ex.serviceRevenue += v.service_revenue;
                ex.total += v.total_revenue;
                customerMap.set(key, ex);
            }
            if (v.operator_id && v.operator) {
                const ex = operatorMap.get(v.operator_id) || {
                    id: v.operator_id,
                    name: v.operator.full_name,
                    visits: 0, materialRevenue: 0, serviceRevenue: 0, total: 0,
                };
                ex.visits++;
                ex.materialRevenue += v.material_revenue;
                ex.serviceRevenue += v.service_revenue;
                ex.total += v.total_revenue;
                operatorMap.set(v.operator_id, ex);
            }
        });

        return {
            customers: Array.from(customerMap.values()).sort((a, b) => b.total - a.total),
            operators: Array.from(operatorMap.values()).sort((a, b) => b.total - a.total),
        };
    }, [filteredVisits]);

    const sym = getCurrencySymbol(companyCurrency);

    const openDay = (dateStr: string) => {
        const dayVisits = visitsByDay.get(dateStr) || [];
        if (dayVisits.length === 0) return;
        setSelectedDay({
            date: dateStr,
            visits: dayVisits,
            completedCount: dayVisits.filter(v => v.status === 'completed').length,
            totalRevenue: dayVisits.reduce((s, v) => s + v.total_revenue, 0),
        });
    };

    const toggleInvoiced = async (visitId: string, current: boolean) => {
        await supabase.from('visits').update({ is_invoiced: !current }).eq('id', visitId);
        fetchVisits();
    };

    const CalendarGrid = () => (
        <View style={styles.calendarCard}>
            <View style={styles.dayHeaders}>
                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
                    <Text key={d} style={styles.dayHeaderText}>{d}</Text>
                ))}
            </View>
            <View style={styles.calendarGrid}>
                {Array.from({ length: startOffset }).map((_, i) => (
                    <View key={`e${i}`} style={styles.cellEmpty} />
                ))}
                {monthDays.map(day => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayVisits = visitsByDay.get(key) || [];
                    const completed = dayVisits.filter(v => v.status === 'completed').length;
                    const planned = dayVisits.filter(v => v.status === 'planned' || v.status === 'in_progress').length;
                    const today = isToday(day);
                    return (
                        <TouchableOpacity
                            key={key}
                            style={[styles.cell, today && styles.cellToday, dayVisits.length > 0 && styles.cellHasVisit]}
                            onPress={() => openDay(key)}
                            activeOpacity={dayVisits.length > 0 ? 0.7 : 1}
                        >
                            <Text style={[styles.cellDayNum, today && styles.cellDayNumToday]}>
                                {format(day, 'd')}
                            </Text>
                            {dayVisits.length > 0 && (
                                <View style={styles.cellDots}>
                                    {completed > 0 && (
                                        <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
                                    )}
                                    {planned > 0 && (
                                        <View style={[styles.dot, { backgroundColor: '#3b82f6' }]} />
                                    )}
                                </View>
                            )}
                            {dayVisits.length > 0 && (
                                <Text style={styles.cellCount}>{dayVisits.length}</Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const RevenueTable = ({ rows, type }: { rows: RevenueSummaryRow[]; type: 'customer' | 'operator' }) => (
        <View style={styles.table}>
            <View style={styles.tableHead}>
                <Text style={[styles.thCell, { flex: 2 }]}>{type === 'customer' ? 'Müşteri / Şube' : 'Operatör'}</Text>
                <Text style={[styles.thCell, { flex: 0.7, textAlign: 'right' }]}>Ziyaret</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Hizmet</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'right' }]}>Malzeme</Text>
                <Text style={[styles.thCell, { flex: 1.1, textAlign: 'right' }]}>Toplam</Text>
            </View>
            {rows.length === 0 ? (
                <View style={styles.tableEmpty}>
                    <Text style={styles.tableEmptyText}>Bu ay tamamlanan ziyaret yok</Text>
                </View>
            ) : (
                rows.map((row, i) => (
                    <View key={row.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.tdMain} numberOfLines={1}>{row.name}</Text>
                            {row.subName && <Text style={styles.tdSub} numberOfLines={1}>{row.subName}</Text>}
                        </View>
                        <Text style={[styles.tdCell, { flex: 0.7, textAlign: 'right' }]}>{row.visits}</Text>
                        <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>
                            {row.serviceRevenue > 0 ? `${sym}${row.serviceRevenue.toFixed(0)}` : '—'}
                        </Text>
                        <Text style={[styles.tdCell, { flex: 1, textAlign: 'right' }]}>
                            {row.materialRevenue > 0 ? `${sym}${row.materialRevenue.toFixed(0)}` : '—'}
                        </Text>
                        <Text style={[styles.tdCell, styles.tdTotal, { flex: 1.1, textAlign: 'right' }]}>
                            {sym}{row.total.toFixed(0)}
                        </Text>
                    </View>
                ))
            )}
            {rows.length > 0 && (
                <View style={styles.tableFoot}>
                    <Text style={[styles.tfCell, { flex: 2 }]}>Toplam</Text>
                    <Text style={[styles.tfCell, { flex: 0.7, textAlign: 'right' }]}>
                        {rows.reduce((s, r) => s + r.visits, 0)}
                    </Text>
                    <Text style={[styles.tfCell, { flex: 1, textAlign: 'right' }]}>
                        {sym}{rows.reduce((s, r) => s + r.serviceRevenue, 0).toFixed(0)}
                    </Text>
                    <Text style={[styles.tfCell, { flex: 1, textAlign: 'right' }]}>
                        {sym}{rows.reduce((s, r) => s + r.materialRevenue, 0).toFixed(0)}
                    </Text>
                    <Text style={[styles.tfCell, styles.tfTotal, { flex: 1.1, textAlign: 'right' }]}>
                        {sym}{rows.reduce((s, r) => s + r.total, 0).toFixed(0)}
                    </Text>
                </View>
            )}
        </View>
    );

    const Content = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderTopColor: '#3b82f6' }]}>
                    <Text style={[styles.statNum, { color: '#3b82f6' }]}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Toplam Ziyaret</Text>
                </View>
                <View style={[styles.statCard, { borderTopColor: '#10b981' }]}>
                    <Text style={[styles.statNum, { color: '#10b981' }]}>{stats.completed}</Text>
                    <Text style={styles.statLabel}>Tamamlandı</Text>
                </View>
                <View style={[styles.statCard, { borderTopColor: '#f59e0b' }]}>
                    <Text style={[styles.statNum, { color: '#f59e0b' }]}>{stats.pending}</Text>
                    <Text style={styles.statLabel}>Bekliyor</Text>
                </View>
                <View style={[styles.statCard, { borderTopColor: '#0ea5e9' }]}>
                    <Text style={[styles.statNum, { color: '#0ea5e9' }]}>{sym}{stats.revenue.toFixed(0)}</Text>
                    <Text style={styles.statLabel}>Aylık Ciro</Text>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <View style={styles.searchBox}>
                    <Search size={16} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Müşteri, şube veya operatör ara..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.monthNav}>
                    <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentDate(subMonths(currentDate, 1))}>
                        <ChevronLeft size={20} color="#334155" />
                    </TouchableOpacity>
                    <Text style={styles.monthLabel}>{monthLabel}</Text>
                    <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentDate(addMonths(currentDate, 1))}>
                        <ChevronRight size={20} color="#334155" />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#10b981" />
                </View>
            ) : (
                <>
                    <CalendarGrid />

                    {/* Revenue Tables */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <TrendingUp size={20} color="#0f172a" />
                            <Text style={styles.sectionTitle}>Müşteri / Şube Ciro Dağılımı</Text>
                        </View>
                        <RevenueTable rows={revenueSummary.customers} type="customer" />
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <User size={20} color="#0f172a" />
                            <Text style={styles.sectionTitle}>Operatör Ciro Dağılımı</Text>
                        </View>
                        <RevenueTable rows={revenueSummary.operators} type="operator" />
                    </View>
                </>
            )}
        </ScrollView>
    );

    const inner = isDesktop
        ? <DesktopLayout><Content /></DesktopLayout>
        : (
            <View style={styles.mobileRoot}>
                <View style={styles.mobileHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.mobileHeaderTitle}>Operasyon Takvimi</Text>
                    <View style={{ width: 38 }} />
                </View>
                <Content />
            </View>
        );

    return (
        <>
            {inner}

            {/* Day Detail Modal */}
            <Modal visible={!!selectedDay} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.dayModal}>
                        <View style={styles.dayModalHeader}>
                            <View>
                                <Text style={styles.dayModalDate}>
                                    {selectedDay && format(parseISO(selectedDay.date), 'd MMMM yyyy', { locale: tr })}
                                </Text>
                                <Text style={styles.dayModalSub}>
                                    {selectedDay?.visits.length} ziyaret · {selectedDay?.completedCount} tamamlandı
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedDay(null)} style={styles.closeBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                            {selectedDay?.visits.map(v => {
                                const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.planned;
                                const StatusIcon = cfg.icon;
                                return (
                                    <TouchableOpacity
                                        key={v.id}
                                        style={styles.dayVisitRow}
                                        onPress={() => { setSelectedDay(null); setSelectedVisit(v); }}
                                    >
                                        <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.dvCustomer}>{v.customer?.company_name || '—'}</Text>
                                            {v.branch && <Text style={styles.dvBranch}>{v.branch.branch_name}</Text>}
                                            <View style={styles.dvMeta}>
                                                {v.operator && (
                                                    <Text style={styles.dvMetaText}>{v.operator.full_name}</Text>
                                                )}
                                                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                                                    <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        {v.total_revenue > 0 && (
                                            <Text style={styles.dvRevenue}>{sym}{v.total_revenue.toFixed(0)}</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Visit Detail Modal */}
            <Modal visible={!!selectedVisit} transparent animationType="slide" onRequestClose={() => setSelectedVisit(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.visitModal}>
                        <View style={styles.visitModalHeader}>
                            <Text style={styles.visitModalTitle}>{selectedVisit?.customer?.company_name}</Text>
                            <TouchableOpacity onPress={() => setSelectedVisit(null)} style={styles.closeBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        {selectedVisit && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {selectedVisit.branch && (
                                    <View style={styles.vmRow}>
                                        <Building2 size={15} color="#64748b" />
                                        <Text style={styles.vmText}>{selectedVisit.branch.branch_name}</Text>
                                    </View>
                                )}
                                <View style={styles.vmRow}>
                                    <Calendar size={15} color="#64748b" />
                                    <Text style={styles.vmText}>
                                        {format(parseISO(selectedVisit.visit_date), 'd MMMM yyyy HH:mm', { locale: tr })}
                                    </Text>
                                </View>
                                {selectedVisit.operator && (
                                    <View style={styles.vmRow}>
                                        <User size={15} color="#64748b" />
                                        <Text style={styles.vmText}>{selectedVisit.operator.full_name}</Text>
                                    </View>
                                )}
                                <View style={styles.vmRow}>
                                    <FileText size={15} color="#64748b" />
                                    <Text style={styles.vmText}>Tip: {selectedVisit.visit_type || '—'}</Text>
                                </View>
                                {selectedVisit.report_number && (
                                    <View style={styles.vmRow}>
                                        <FileText size={15} color="#64748b" />
                                        <Text style={styles.vmText}>Rapor No: {selectedVisit.report_number}</Text>
                                    </View>
                                )}
                                {selectedVisit.notes && (
                                    <View style={[styles.vmRow, { alignItems: 'flex-start' }]}>
                                        <FileText size={15} color="#64748b" style={{ marginTop: 2 }} />
                                        <Text style={[styles.vmText, { flex: 1 }]}>{selectedVisit.notes}</Text>
                                    </View>
                                )}
                                <View style={styles.vmRevBlock}>
                                    <View style={styles.vmRevRow}>
                                        <Text style={styles.vmRevLabel}>Hizmet Geliri</Text>
                                        <Text style={styles.vmRevValue}>{sym}{selectedVisit.service_revenue.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.vmRevRow}>
                                        <Text style={styles.vmRevLabel}>Malzeme Geliri</Text>
                                        <Text style={styles.vmRevValue}>{sym}{selectedVisit.material_revenue.toFixed(2)}</Text>
                                    </View>
                                    <View style={[styles.vmRevRow, styles.vmRevTotal]}>
                                        <Text style={styles.vmRevLabelBold}>Toplam Ciro</Text>
                                        <Text style={styles.vmRevValueBold}>{sym}{selectedVisit.total_revenue.toFixed(2)}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.invoiceBtn, selectedVisit.is_invoiced && styles.invoiceBtnDone]}
                                    onPress={() => {
                                        toggleInvoiced(selectedVisit.id, selectedVisit.is_invoiced);
                                        setSelectedVisit(null);
                                    }}
                                >
                                    <Text style={styles.invoiceBtnText}>
                                        {selectedVisit.is_invoiced ? 'Fatura Kesildi ✓' : 'Fatura Kesildi Olarak İşaretle'}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    mobileRoot: { flex: 1, backgroundColor: '#f8fafc' },
    mobileHeader: {
        backgroundColor: '#10b981',
        paddingTop: 52,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
    mobileHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

    scrollContent: { padding: 16, paddingBottom: 48 },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
    statCard: {
        flex: 1, minWidth: 90,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        borderTopWidth: 3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    statNum: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },

    controls: {
        flexDirection: 'row', alignItems: 'center',
        gap: 12, marginBottom: 16, flexWrap: 'wrap',
    },
    searchBox: {
        flex: 1, minWidth: 200,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 10,
        paddingHorizontal: 12, height: 44,
        borderWidth: 1, borderColor: '#e2e8f0',
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
    monthNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    navBtn: {
        width: 36, height: 36,
        backgroundColor: '#fff',
        borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
        justifyContent: 'center', alignItems: 'center',
    },
    monthLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a', minWidth: 150, textAlign: 'center' },

    loadingBox: { height: 300, justifyContent: 'center', alignItems: 'center' },

    calendarCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1, borderColor: '#e2e8f0',
        marginBottom: 28,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 8, elevation: 3,
    },
    dayHeaders: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    dayHeaderText: {
        flex: 1, textAlign: 'center',
        paddingVertical: 12, fontSize: 12,
        fontWeight: '700', color: '#64748b',
    },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
        width: '14.2857%',
        minHeight: 80,
        borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9',
        padding: 6,
        backgroundColor: '#fff',
    },
    cellEmpty: {
        width: '14.2857%', minHeight: 80,
        borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9',
        backgroundColor: '#fafafa',
    },
    cellToday: { backgroundColor: '#f0fdf4' },
    cellHasVisit: { backgroundColor: '#fafeff' },
    cellDayNum: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
    cellDayNumToday: { color: '#10b981' },
    cellDots: { flexDirection: 'row', gap: 3, marginBottom: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    cellCount: { fontSize: 10, color: '#64748b', fontWeight: '600' },

    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },

    table: {
        backgroundColor: '#fff', borderRadius: 12,
        borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden',
    },
    tableHead: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    thCell: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
    tableRowAlt: { backgroundColor: '#fafafa' },
    tableEmpty: { padding: 24, alignItems: 'center' },
    tableEmptyText: { color: '#94a3b8', fontSize: 14 },
    tdMain: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    tdSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
    tdCell: { fontSize: 13, color: '#334155' },
    tdTotal: { fontWeight: '700', color: '#10b981' },
    tableFoot: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        paddingVertical: 12, paddingHorizontal: 16,
        borderTopWidth: 1, borderTopColor: '#e2e8f0',
        alignItems: 'center',
    },
    tfCell: { fontSize: 13, fontWeight: '700', color: '#334155' },
    tfTotal: { color: '#10b981', fontSize: 14 },

    modalBackdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    dayModal: {
        backgroundColor: '#fff', borderRadius: 20,
        width: '100%', maxWidth: 540,
        padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    },
    dayModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 16,
    },
    dayModalDate: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    dayModalSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
    closeBtn: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
    },
    dayVisitRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, gap: 12,
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    dvCustomer: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    dvBranch: { fontSize: 12, color: '#64748b', marginTop: 1 },
    dvMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
    dvMetaText: { fontSize: 12, color: '#64748b' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    statusBadgeText: { fontSize: 11, fontWeight: '600' },
    dvRevenue: { fontSize: 14, fontWeight: '700', color: '#10b981' },

    visitModal: {
        backgroundColor: '#fff', borderRadius: 20,
        width: '100%', maxWidth: 480, maxHeight: '85%',
        padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    },
    visitModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16,
        paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    visitModalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 12 },
    vmRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 10, marginBottom: 10,
    },
    vmText: { fontSize: 14, color: '#334155' },
    vmRevBlock: {
        backgroundColor: '#f8fafc', borderRadius: 12,
        padding: 14, marginTop: 12, marginBottom: 16,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    vmRevRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    vmRevLabel: { fontSize: 13, color: '#64748b' },
    vmRevValue: { fontSize: 13, fontWeight: '600', color: '#334155' },
    vmRevTotal: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginBottom: 0 },
    vmRevLabelBold: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    vmRevValueBold: { fontSize: 16, fontWeight: '700', color: '#10b981' },
    invoiceBtn: {
        backgroundColor: '#f1f5f9', borderRadius: 10,
        paddingVertical: 12, alignItems: 'center',
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    invoiceBtnDone: { backgroundColor: '#ecfdf5', borderColor: '#10b981' },
    invoiceBtnText: { fontSize: 14, fontWeight: '600', color: '#334155' },
});
