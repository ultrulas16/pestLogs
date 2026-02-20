    import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
    import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, useWindowDimensions, Image, Linking, ActivityIndicator, Platform, Alert, Animated } from 'react-native';
    import { useRouter } from 'expo-router';
    import { useAuth } from '@/contexts/AuthContext';
    import { useLanguage } from '@/contexts/LanguageContext';
    import { supabase } from '@/lib/supabase';
    import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, getDay } from 'date-fns';
    import { tr, enUS } from 'date-fns/locale';
    import { DesktopLayout } from '@/components/DesktopLayout';
    import { LinearGradient } from 'expo-linear-gradient';
    import {
        ArrowLeft, ChevronLeft, ChevronRight, X, User, Building, Calendar as CalendarIcon,
        Tag, MapPin, ClipboardX, DollarSign, TrendingUp, Users, MessageSquare, Info,
        CheckCircle, AlertCircle, Camera, Bug, Activity, Megaphone, Package, Image as ImageIcon,
        Loader, Filter, CheckSquare
    } from 'lucide-react-native';

    // --- INTERFACES ---
    interface Visit {
        id: string;
        customer_id: string;
        branch_id: string | null;
        customer: { company_name: string } | null;
        branch: { sube_adi: string; latitude?: number; longitude?: number; } | null;
        operator: { full_name: string; id: string } | null;
        visit_date: string;
        status: 'planned' | 'completed' | 'cancelled';
        visit_type: string | string[];
        is_checked: boolean;

        rapor_no?: string;
        aciklama?: string;
        musteri_aciklamasi?: string;
        yonetici_notu?: string;
        yogunluk?: string;
        pest_types?: string[];
        image_url?: string;

        total_visit_revenue?: number;
        material_sales_revenue?: number;
        service_per_visit_revenue?: number;

        paid_material_sales?: Array<{
            id: string;
            total_amount: number;
            customer_id: string;
            branch_id: string | null;
            paid_material_sale_items?: Array<{
                quantity: number;
                unit_price?: number;
                company_materials?: {
                    id: string;
                    name: string;
                    unit_type?: string;
                };
            }>;
        }>;
    }

    interface Operator {
        id: string;
        full_name: string;
        profile_id?: string;
    }

    interface Customer {
        id: string;
        company_name: string;
    }

    interface Branch {
        id: string;
        sube_adi: string;
        customer_id: string;
        customer?: {
            company_name: string;
        } | null;
        latitude?: number;
        longitude?: number;
    }

    interface MaterialDisplayItem {
        material_name: string;
        quantity: number;
        unit?: string;
        unit_price: number;
        total_price: number;
    }

    interface MaterialBreakdownItem {
        total_quantity: number;
        unit_type?: string;
        total_item_amount: number;
    }

    interface BranchMaterialSummary {
        branch_id: string;
        branch_name: string;
        total_sales_amount: number;
        total_visits_with_sales: number;
        materials_breakdown: {
            [materialName: string]: MaterialBreakdownItem;
        };
    }

    interface CustomerMaterialSummary {
        customer_id: string;
        customer_name: string;
        total_sales_amount: number;
        total_visits_with_sales: number;
        materials_breakdown: {
            [materialName: string]: MaterialBreakdownItem;
        };
        branches_summary: Map<string, BranchMaterialSummary>;
    }

    interface CustomerPricing {
        id: string;
        customer_id: string;
        monthly_price: number | null;
        per_visit_price: number | null;
    }

    interface BranchPricing {
        id: string;
        branch_id: string;
        monthly_price: number | null;
        per_visit_price: number | null;
    }

    interface OperatorRevenueSummary {
        operator_id: string;
        operator_name: string;
        total_monthly_revenue: number;
        daily_revenue_breakdown: Map<string, { total_daily_revenue: number; visit_count: number }>;
    }

    interface AggregatedRevenueItem {
        id: string;
        name: string;
        material: number;
        service: number;
        total: number;
        visits: number;
    }


    // --- HELPER COMPONENTS ---

    const getVisitTypeLabel = (type: string | string[] | undefined, t: any): string => {
        if (!type) return '';
        const typeId = Array.isArray(type) ? type[0] : type;
        const types: { [key: string]: string } = {
            'ilk': t('firstVisit') || 'İlk Ziyaret',
            'ucretli': t('paid') || 'Ücretli',
            'acil': t('emergency') || 'Acil Müdahale',
            'teknik': t('technicalService') || 'Teknik Servis',
            'periyodik': t('periodicControl') || 'Periyodik Kontrol',
            'isyeri': t('workplaceSpraying') || 'İşyeri İlaçlama',
            'gozlem': t('observation') || 'Gözlem Ziyareti',
            'son': t('finalControl') || 'Son Kontrol'
        };
        return types[typeId] || typeId.charAt(0).toUpperCase() + typeId.slice(1);
    };


    export default function CompanyCalendar() {
        const router = useRouter();
        const { profile } = useAuth();
        const { t, language } = useLanguage();
        const dateLocale = language === 'tr' ? tr : enUS;

        const { width } = useWindowDimensions();
        const isDesktop = width >= 768;

        const [currentDate, setCurrentDate] = useState(new Date());
        const [visits, setVisits] = useState<Visit[]>([]);
        const [operators, setOperators] = useState<Operator[]>([]);
        const [customers, setCustomers] = useState<Customer[]>([]);
        const [branches, setBranches] = useState<Branch[]>([]);
        const [monthlySchedules, setMonthlySchedules] = useState<any[]>([]);
        const [paidMaterialDetailsMap, setPaidMaterialDetailsMap] = useState<Map<string, MaterialDisplayItem[]>>(new Map());
        const [monthlyMaterialUsageSummary, setMonthlyMaterialUsageSummary] = useState<Map<string, CustomerMaterialSummary>>(new Map());

        const [customerPricingMap, setCustomerPricingMap] = useState<Map<string, CustomerPricing>>(new Map());
        const [branchPricingMap, setBranchPricingMap] = useState<Map<string, BranchPricing>>(new Map());
        const [operatorRevenueSummary, setOperatorRevenueSummary] = useState<Map<string, OperatorRevenueSummary>>(new Map());

        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [selectedOperator, setSelectedOperator] = useState<string>('');
        const [selectedCustomer, setSelectedCustomer] = useState<string>('');
        const [selectedBranch, setSelectedBranch] = useState<string>('');
        const [selectedStatus, setSelectedStatus] = useState<string>('');
        const [checkedStatusFilter, setCheckedStatusFilter] = useState<string>('all');
        const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);

        // Custom filter modal state for mobile
        const [showFilterModal, setShowFilterModal] = useState(false);

        const filteredBranches = useMemo(() => {
            if (!selectedCustomer) return branches;
            return branches.filter(branch => branch.customer_id === selectedCustomer);
        }, [branches, selectedCustomer]);

        useEffect(() => {
            const fetchInitialData = async () => {
                setLoading(true);
                try {
                    const companyId = profile?.role === 'company' ? profile.id : profile?.company_id;

                    // Fetch company ID from companies table as done in services.tsx
                    const { data: companyData, error: companyError } = await supabase
                        .from('companies')
                        .select('id')
                        .eq('owner_id', companyId)
                        .maybeSingle();

                    const actualCompanyId = companyData?.id || companyId;

                    const currentMonth = currentDate.getMonth() + 1;
                    const currentYear = currentDate.getFullYear();

                    const [operatorData, customerData, branchData, customerPricingData, branchPricingData, schedulesData] = await Promise.all([
                        supabase.from('operators').select('id, full_name').eq('company_id', actualCompanyId).order('full_name'),
                        supabase.from('customers').select('id, company_name').eq('company_id', actualCompanyId).eq('is_active', true).order('company_name'),
                        supabase.from('customer_branches').select('id, branch_name as sube_adi, customer_id, latitude, longitude, customers (company_name)').eq('company_id', actualCompanyId).order('branch_name'),
                        supabase.from('customer_pricing').select('id, customer_id, monthly_price, per_visit_price').eq('company_id', actualCompanyId),
                        supabase.from('branch_pricing').select('id, branch_id, monthly_price, per_visit_price').eq('company_id', actualCompanyId),
                        supabase.from('monthly_visit_schedules').select(`
                *,
                customers (company_name),
                customer_branches (branch_name, customers (company_name)),
                operators (full_name)
            `).eq('company_id', actualCompanyId).eq('month', currentMonth).or(`year.eq.${currentYear},year.is.null`)
                    ]);

                    if (operatorData.error) throw operatorData.error;
                    if (customerData.error) throw customerData.error;
                    if (branchData.error) throw branchData.error;
                    // Don't throw if pricing or schedules fail, they might not exist yet

                    setOperators(operatorData.data || []);
                    setCustomers(customerData.data || []);
                    setBranches((branchData.data as any) || []);
                    setMonthlySchedules(schedulesData.data || []);

                    const cPricingMap = new Map<string, CustomerPricing>();
                    (customerPricingData.data || []).forEach(cp => cPricingMap.set(cp.customer_id, cp));
                    setCustomerPricingMap(cPricingMap);

                    const bPricingMap = new Map<string, BranchPricing>();
                    (branchPricingData.data || []).forEach(bp => bPricingMap.set(bp.branch_id, bp));
                    setBranchPricingMap(bPricingMap);

                } catch (err: any) {
                    Alert.alert(t('error' as any), t('failedToLoadData' as any) + ": " + err.message);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchInitialData();
        }, [currentDate, profile?.id, profile?.company_id]);

        useEffect(() => {
            setSelectedBranch('');
        }, [selectedCustomer]);

        const fetchVisits = useCallback(async () => {
            setLoading(true);
            setError(null);
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);
            const companyId = profile?.role === 'company' ? profile.id : profile?.company_id;

            const { data: companyData } = await supabase.from('companies').select('id').eq('owner_id', companyId).maybeSingle();
            const actualCompanyId = companyData?.id || companyId;

            const { data: opData } = await supabase.from('operators').select('id, profile_id').eq('company_id', actualCompanyId);
            const operatorIds = opData ? opData.map(o => o.id) : [];

            let visitsQuery = supabase
                .from('visits')
                .select(`
            id, visit_date, status, is_checked, visit_type, 
            report_number, notes, customer_notes, density_level, pest_types,
            customer_id, branch_id, operator_id,
            customers (company_name),
            customer_branches (branch_name, latitude, longitude),
            operators (id, full_name),
            paid_material_sales (
            id, total_amount, customer_id, branch_id,
            paid_material_sale_items (
                quantity, unit_price,
                company_materials (
                id, name, unit
                )
            )
            )
        `)
                .in('operator_id', operatorIds.length > 0 ? operatorIds : ['empty-id'])
                .gte('visit_date', start.toISOString())
                .lte('visit_date', end.toISOString());

            // Planned and in progress visits
            let plannedQuery = supabase
                .from('service_requests')
                .select(`
                    id, scheduled_date, status, service_type, notes,
                    customer_id, branch_id, operator_id,
                    customers (company_name),
                    customer_branches (branch_name, latitude, longitude),
                    profiles!service_requests_operator_id_fkey (id, full_name)
                `)
                .eq('company_id', actualCompanyId)
                .gte('scheduled_date', start.toISOString())
                .lte('scheduled_date', end.toISOString())
                .in('status', ['pending', 'assigned', 'in_progress', 'cancelled']);

            if (selectedOperator) {
                visitsQuery = visitsQuery.eq('operator_id', selectedOperator);
                const matchingOp = opData?.find(o => o.id === selectedOperator);
                if (matchingOp?.profile_id) {
                    plannedQuery = plannedQuery.eq('operator_id', matchingOp.profile_id);
                } else {
                    plannedQuery = plannedQuery.in('operator_id', ['empty-id']);
                }
            }

            if (selectedCustomer) {
                visitsQuery = visitsQuery.eq('customer_id', selectedCustomer);
                plannedQuery = plannedQuery.eq('customer_id', selectedCustomer);
            }
            if (selectedBranch) {
                visitsQuery = visitsQuery.eq('branch_id', selectedBranch);
                plannedQuery = plannedQuery.eq('branch_id', selectedBranch);
            }

            const [visitsRes, plannedRes] = await Promise.all([visitsQuery, plannedQuery]);

            if (visitsRes.error) {
                Alert.alert(t('error' as any), t('failedToLoadData' as any) + ": " + visitsRes.error.message);
                setError(visitsRes.error.message);
                setLoading(false);
                return;
            }

            let visitsData = (visitsRes.data || []).map(v => ({
                ...v,
                rapor_no: v.report_number,
                aciklama: v.notes,
                musteri_aciklamasi: v.customer_notes,
                yogunluk: v.density_level
            })) as any[];

            let plannedData = (plannedRes.data || []).map((v: any) => {
                const opIdMatched = opData?.find(o => o.profile_id === v.operator_id)?.id || v.operator_id;
                return {
                    id: v.id,
                    visit_date: v.scheduled_date,
                    status: v.status,
                    is_checked: false,
                    visit_type: v.service_type,
                    aciklama: v.notes,
                    customer_id: v.customer_id,
                    branch_id: v.branch_id,
                    operator_id: opIdMatched,
                    customers: v.customers,
                    customer_branches: v.customer_branches,
                    operators: { id: opIdMatched, full_name: v.profiles?.full_name || 'Bilinmeyen Operatör' },
                    paid_material_sales: []
                };
            });

            let allVisits = [...visitsData, ...plannedData];

            if (selectedStatus) {
                allVisits = allVisits.filter(v => v.status === selectedStatus);
            }

            if (checkedStatusFilter === 'checked') {
                allVisits = allVisits.filter(v => v.is_checked === true);
            } else if (checkedStatusFilter === 'unchecked') {
                allVisits = allVisits.filter(v => v.is_checked !== true);
            }

            const customerMonthlyVisitCounts = new Map<string, number>();
            const branchMonthlyVisitCounts = new Map<string, number>();

            allVisits.forEach(visit => {
                if (visit.customer_id) {
                    customerMonthlyVisitCounts.set(visit.customer_id, (customerMonthlyVisitCounts.get(visit.customer_id) || 0) + 1);
                }
                if (visit.branch_id) {
                    branchMonthlyVisitCounts.set(visit.branch_id, (branchMonthlyVisitCounts.get(visit.branch_id) || 0) + 1);
                }
            });

            const distributedCustomerMonthlyRevenuePerVisit = new Map<string, number>();
            customerPricingMap.forEach((pricing, customerId) => {
                if (pricing.monthly_price && pricing.monthly_price > 0) {
                    const visitCount = customerMonthlyVisitCounts.get(customerId) || 0;
                    if (visitCount > 0) {
                        distributedCustomerMonthlyRevenuePerVisit.set(customerId, pricing.monthly_price / visitCount);
                    } else {
                        distributedCustomerMonthlyRevenuePerVisit.set(customerId, 0);
                    }
                }
            });

            const distributedBranchMonthlyRevenuePerVisit = new Map<string, number>();
            branchPricingMap.forEach((pricing, branchId) => {
                if (pricing.monthly_price && pricing.monthly_price > 0) {
                    const visitCount = branchMonthlyVisitCounts.get(branchId) || 0;
                    if (visitCount > 0) {
                        distributedBranchMonthlyRevenuePerVisit.set(branchId, pricing.monthly_price / visitCount);
                    } else {
                        distributedBranchMonthlyRevenuePerVisit.set(branchId, 0);
                    }
                }
            });

            const visitMaterialsMap = new Map<string, MaterialDisplayItem[]>();
            const monthlySummaryMap = new Map<string, CustomerMaterialSummary>();
            const newOperatorRevenueSummary = new Map<string, OperatorRevenueSummary>();
            const processedVisits: Visit[] = [];

            (visitsData || []).forEach(visit => {
                let materialSalesRevenue = 0;
                const isCompleted = visit.status === 'completed';

                (visit.paid_material_sales || []).forEach((sale: any) => {
                    materialSalesRevenue += sale.total_amount || 0;

                    if (isCompleted) {
                        if (!monthlySummaryMap.has(sale.customer_id)) {
                            monthlySummaryMap.set(sale.customer_id, {
                                customer_id: sale.customer_id,
                                customer_name: (visit as any).customers?.company_name || 'Bilinmeyen Müşteri',
                                total_sales_amount: 0,
                                total_visits_with_sales: 0,
                                materials_breakdown: {},
                                branches_summary: new Map()
                            });
                        }
                        const customerSummary = monthlySummaryMap.get(sale.customer_id)!;
                        customerSummary.total_sales_amount += sale.total_amount || 0;

                        if (sale.branch_id) {
                            if (!customerSummary.branches_summary.has(sale.branch_id)) {
                                customerSummary.branches_summary.set(sale.branch_id, {
                                    branch_id: sale.branch_id,
                                    branch_name: (visit as any).customer_branches?.branch_name || 'Bilinmeyen Şube',
                                    total_sales_amount: 0,
                                    total_visits_with_sales: 0,
                                    materials_breakdown: {}
                                });
                            }
                            const branchSummary = customerSummary.branches_summary.get(sale.branch_id)!;
                            branchSummary.total_sales_amount += sale.total_amount || 0;
                        }
                    }

                    (sale.paid_material_sale_items || []).forEach((item: any) => {
                        const product = item.company_materials;
                        if (!product) return;

                        if (!visitMaterialsMap.has(visit.id)) {
                            visitMaterialsMap.set(visit.id, []);
                        }
                        const unitPrice = item.unit_price || 0;
                        visitMaterialsMap.get(visit.id)?.push({
                            material_name: product.name,
                            quantity: item.quantity,
                            unit: product.unit,
                            unit_price: unitPrice,
                            total_price: item.quantity * unitPrice
                        });

                        if (isCompleted) {
                            const itemTotalAmount = item.quantity * (item.unit_price || 0);
                            const customerSummary = monthlySummaryMap.get(sale.customer_id)!;

                            if (!customerSummary.materials_breakdown[product.name]) {
                                customerSummary.materials_breakdown[product.name] = { total_quantity: 0, unit_type: product.unit, total_item_amount: 0 };
                            }
                            customerSummary.materials_breakdown[product.name].total_quantity += item.quantity;
                            customerSummary.materials_breakdown[product.name].total_item_amount += itemTotalAmount;

                            if (sale.branch_id) {
                                const branchSummary = customerSummary.branches_summary.get(sale.branch_id)!;
                                if (!branchSummary.materials_breakdown[product.name]) {
                                    branchSummary.materials_breakdown[product.name] = { total_quantity: 0, unit_type: product.unit, total_item_amount: 0 };
                                }
                                branchSummary.materials_breakdown[product.name].total_quantity += item.quantity;
                                branchSummary.materials_breakdown[product.name].total_item_amount += itemTotalAmount;
                            }
                        }
                    });
                });

                let servicePerVisitRevenue = 0;

                if (visit.branch_id && distributedBranchMonthlyRevenuePerVisit.has(visit.branch_id)) {
                    servicePerVisitRevenue = distributedBranchMonthlyRevenuePerVisit.get(visit.branch_id) || 0;
                } else if (visit.customer_id && distributedCustomerMonthlyRevenuePerVisit.has(visit.customer_id)) {
                    servicePerVisitRevenue = distributedCustomerMonthlyRevenuePerVisit.get(visit.customer_id) || 0;
                } else {
                    if (visit.branch_id) {
                        const branchPricing = branchPricingMap.get(visit.branch_id);
                        if (branchPricing?.per_visit_price) {
                            servicePerVisitRevenue = branchPricing.per_visit_price;
                        }
                    }
                    if (servicePerVisitRevenue === 0 && visit.customer_id) {
                        const customerPricing = customerPricingMap.get(visit.customer_id);
                        if (customerPricing?.per_visit_price) {
                            servicePerVisitRevenue = customerPricing.per_visit_price;
                        }
                    }
                }

                const totalVisitRevenue = materialSalesRevenue + servicePerVisitRevenue;

                processedVisits.push({
                    ...visit,
                    total_visit_revenue: totalVisitRevenue,
                    material_sales_revenue: materialSalesRevenue,
                    service_per_visit_revenue: servicePerVisitRevenue,
                } as any);

                if ((visit as any).operators?.id && (visit as any).operators?.full_name) {
                    const operatorId = (visit as any).operators.id;
                    const operatorName = (visit as any).operators.full_name;
                    const visitDate = format(new Date(visit.visit_date), 'yyyy-MM-dd');

                    if (!newOperatorRevenueSummary.has(operatorId)) {
                        newOperatorRevenueSummary.set(operatorId, {
                            operator_id: operatorId,
                            operator_name: operatorName,
                            total_monthly_revenue: 0,
                            daily_revenue_breakdown: new Map()
                        });
                    }
                    const opSummary = newOperatorRevenueSummary.get(operatorId)!;
                    opSummary.total_monthly_revenue += totalVisitRevenue;

                    if (!opSummary.daily_revenue_breakdown.has(visitDate)) {
                        opSummary.daily_revenue_breakdown.set(visitDate, { total_daily_revenue: 0, visit_count: 0 });
                    }
                    const dailyBreakdown = opSummary.daily_revenue_breakdown.get(visitDate)!;
                    dailyBreakdown.total_daily_revenue += totalVisitRevenue;
                    dailyBreakdown.visit_count += 1;
                }
            });

            setVisits(processedVisits);
            setPaidMaterialDetailsMap(visitMaterialsMap);
            setMonthlyMaterialUsageSummary(monthlySummaryMap);
            setOperatorRevenueSummary(newOperatorRevenueSummary);

            setLoading(false);
        }, [currentDate, selectedOperator, selectedCustomer, selectedBranch, checkedStatusFilter, selectedStatus, profile?.id, customerPricingMap, branchPricingMap]);

        useEffect(() => {
            fetchVisits();
        }, [fetchVisits]);

        const handleCheckVisit = async (visitId: string, currentStatus: boolean) => {
            setVisits(prevVisits =>
                prevVisits.map(v => v.id === visitId ? { ...v, is_checked: !currentStatus } : v)
            );

            const { error } = await supabase
                .from('visits')
                .update({ is_checked: !currentStatus })
                .eq('id', visitId);

            if (error) {
                Alert.alert(t('error' as any), t('failedToUpdateStatus' as any) + ": " + error.message);
                setVisits(prevVisits =>
                    prevVisits.map(v => v.id === visitId ? { ...v, is_checked: currentStatus } : v)
                );
            }
        };

        const daysOfWeek = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const startingDayIndex = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;

        const getStatusColor = (status: string) => {
            switch (status) {
                case 'completed': return '#10b981'; // Emerald 500
                case 'in_progress': return '#3b82f6'; // Blue 500
                case 'planned':
                case 'assigned':
                case 'pending': return '#f59e0b'; // Amber 500
                case 'cancelled': return '#ef4444'; // Red 500
                default: return '#94a3b8'; // Slate 400
            }
        };

        const getStatusGradient = (status: string): readonly [string, string, ...string[]] => {
            switch (status) {
                case 'completed': return ['#34d399', '#059669'];
                case 'in_progress': return ['#60a5fa', '#2563eb'];
                case 'planned':
                case 'assigned':
                case 'pending': return ['#fbbf24', '#d97706'];
                case 'cancelled': return ['#f87171', '#dc2626'];
                default: return ['#cbd5e1', '#64748b'];
            }
        };

        const monthlyRevenueSummary = useMemo(() => {
            const customerSummary = new Map<string, AggregatedRevenueItem>();

            visits.forEach(visit => {
                const customerId = visit.customer_id;
                const materialRevenue = visit.material_sales_revenue || 0;
                const serviceRevenue = visit.service_per_visit_revenue || 0;
                const totalRevenue = visit.total_visit_revenue || 0;

                if (customerId) {
                    if (!customerSummary.has(customerId)) {
                        customerSummary.set(customerId, {
                            id: customerId,
                            name: (visit as any).customers?.company_name || 'Bilinmeyen Müşteri',
                            material: 0,
                            service: 0,
                            total: 0,
                            visits: 0
                        });
                    }
                    const entry = customerSummary.get(customerId)!;
                    entry.material += materialRevenue;
                    entry.service += serviceRevenue;
                    entry.total += totalRevenue;
                    entry.visits += 1;
                }
            });

            return Array.from(customerSummary.values()).sort((a, b) => b.total - a.total);
        }, [visits]);

        const totalMonthlyRevenue = useMemo(() => {
            return monthlyRevenueSummary.reduce((sum, item) => sum + item.total, 0);
        }, [monthlyRevenueSummary]);



        // Custom Filters Modal
        const FilterModal = () => (
            <Modal visible={showFilterModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.filterModalContent, { backgroundColor: '#fff', borderRadius: 16 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { fontSize: 20, fontWeight: 'bold' }]}>{t('filters' as any) || 'Filtreler'}</Text>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.closeButton}>
                                <X size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 400 }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 }}>{t('customers' as any) || 'Müşteriler'}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, selectedCustomer === '' && styles.filterSelectionButtonActive]}
                                    onPress={() => setSelectedCustomer('')}
                                >
                                    <Text style={[styles.filterSelectionText, selectedCustomer === '' && styles.filterSelectionTextActive]}>{t('all' as any) || 'Tümü'}</Text>
                                </TouchableOpacity>
                                {customers.map(c => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.filterSelectionButton, selectedCustomer === c.id && styles.filterSelectionButtonActive]}
                                        onPress={() => setSelectedCustomer(c.id)}
                                    >
                                        <Text style={[styles.filterSelectionText, selectedCustomer === c.id && styles.filterSelectionTextActive]}>{c.company_name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 }}>{t('operators' as any) || 'Operatörler'}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, selectedOperator === '' && styles.filterSelectionButtonActive]}
                                    onPress={() => setSelectedOperator('')}
                                >
                                    <Text style={[styles.filterSelectionText, selectedOperator === '' && styles.filterSelectionTextActive]}>{t('all' as any) || 'Tümü'}</Text>
                                </TouchableOpacity>
                                {operators.map(o => (
                                    <TouchableOpacity
                                        key={o.id}
                                        style={[styles.filterSelectionButton, selectedOperator === o.id && styles.filterSelectionButtonActive]}
                                        onPress={() => setSelectedOperator(o.id)}
                                    >
                                        <Text style={[styles.filterSelectionText, selectedOperator === o.id && styles.filterSelectionTextActive]}>{o.full_name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 }}>{t('status' as any) || 'Durum'}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, selectedStatus === '' && styles.filterSelectionButtonActive]}
                                    onPress={() => setSelectedStatus('')}
                                >
                                    <Text style={[styles.filterSelectionText, selectedStatus === '' && styles.filterSelectionTextActive]}>{t('all' as any) || 'Tümü'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, selectedStatus === 'planned' && styles.filterSelectionButtonActive]}
                                    onPress={() => setSelectedStatus('planned')}
                                >
                                    <Text style={[styles.filterSelectionText, selectedStatus === 'planned' && styles.filterSelectionTextActive]}>{t('planned' as any) || 'Planlandı'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, selectedStatus === 'completed' && styles.filterSelectionButtonActive]}
                                    onPress={() => setSelectedStatus('completed')}
                                >
                                    <Text style={[styles.filterSelectionText, selectedStatus === 'completed' && styles.filterSelectionTextActive]}>{t('completed' as any) || 'Tamamlandı'}</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 }}>Kontrol Durumu</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, checkedStatusFilter === 'all' && styles.filterSelectionButtonActive]}
                                    onPress={() => setCheckedStatusFilter('all')}
                                >
                                    <Text style={[styles.filterSelectionText, checkedStatusFilter === 'all' && styles.filterSelectionTextActive]}>Tümü</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, checkedStatusFilter === 'checked' && styles.filterSelectionButtonActive]}
                                    onPress={() => setCheckedStatusFilter('checked')}
                                >
                                    <Text style={[styles.filterSelectionText, checkedStatusFilter === 'checked' && styles.filterSelectionTextActive]}>Kontrol Edilenler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.filterSelectionButton, checkedStatusFilter === 'unchecked' && styles.filterSelectionButtonActive]}
                                    onPress={() => setCheckedStatusFilter('unchecked')}
                                >
                                    <Text style={[styles.filterSelectionText, checkedStatusFilter === 'unchecked' && styles.filterSelectionTextActive]}>Kontrol Edilmeyenler</Text>
                                </TouchableOpacity>
                            </View>

                        </ScrollView>

                        <TouchableOpacity
                            style={{ backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 }}
                            onPress={() => setShowFilterModal(false)}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{t('apply' as any) || 'Uygula'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );

        const VisitDetailModalContent = ({ visit }: { visit: Visit }) => {
            const materialsForThisVisit = paidMaterialDetailsMap.get(visit.id) || [];
            const customerSummary = visit.customer_id ? monthlyMaterialUsageSummary.get(visit.customer_id) : undefined;
            const branchMonthlySummary = (customerSummary && visit.branch_id) ? customerSummary.branches_summary.get(visit.branch_id) : undefined;
            const hasPaidMaterialUsage = materialsForThisVisit.length > 0;

            return (
                <ScrollView style={{ padding: 16, flex: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>
                            Ziyaret Detayı
                        </Text>
                        {visit.rapor_no && (
                            <View style={{ backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 }}>
                                <Text style={{ color: '#1e40af', fontSize: 12, fontFamily: 'monospace' }}>#{visit.rapor_no}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>Sistem ID: {visit.id.substring(0, 8)}...</Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                        <View style={{ width: '45%' }}>
                            <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>Müşteri</Text>
                            <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500', marginTop: 4 }}>{(visit as any).customers?.company_name || 'N/A'}</Text>
                        </View>
                        <View style={{ width: '45%' }}>
                            <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>Şube</Text>
                            <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500', marginTop: 4 }}>{(visit as any).customer_branches?.branch_name || 'N/A'}</Text>
                        </View>
                        <View style={{ width: '45%' }}>
                            <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>Operatör</Text>
                            <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500', marginTop: 4 }}>{(visit as any).operators?.full_name || 'N/A'}</Text>
                        </View>
                        <View style={{ width: '45%' }}>
                            <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>Tarih</Text>
                            <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500', marginTop: 4 }}>{format(new Date(visit.visit_date), 'dd MMMM yyyy HH:mm', { locale: tr })}</Text>
                        </View>
                        <View style={{ width: '45%' }}>
                            <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>Durum</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getStatusColor(visit.status), marginRight: 6 }} />
                                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500', textTransform: 'capitalize' }}>
                                    {visit.status === 'completed' ? 'Tamamlandı' : visit.status === 'planned' ? 'Planlandı' : visit.status}
                                </Text>
                            </View>
                        </View>
                        <View style={{ width: '45%' }}>
                            <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>Ziyaret Tipi</Text>
                            <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500', marginTop: 4 }}>{getVisitTypeLabel(visit.visit_type, t)}</Text>
                        </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 16 }} />

                    {hasPaidMaterialUsage && (
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1f2937', marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                                <Package size={16} color="#f97316" style={{ marginRight: 6 }} /> Ziyarette Kullanılan Malzemeler
                            </Text>
                            <View style={{ borderWidth: 1, borderColor: '#fed7aa', borderRadius: 12, overflow: 'hidden' }}>
                                {materialsForThisVisit.map((material, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: idx % 2 === 0 ? '#fff' : '#fff7ed', borderBottomWidth: idx === materialsForThisVisit.length - 1 ? 0 : 1, borderBottomColor: '#ffedd5' }}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>{material.material_name}</Text>
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4b5563' }}>{material.quantity} {material.unit}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#c2410c' }}>{material.total_price.toFixed(2)} ₺</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {branchMonthlySummary && (
                        <View style={{ padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, backgroundColor: '#f9fafb', marginBottom: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 }}>
                                {format(new Date(visit.visit_date), 'MMMM yyyy', { locale: tr })} Ayı Şube Genel Özeti ({branchMonthlySummary.branch_name})
                            </Text>
                            <Text style={{ fontSize: 12, color: '#4b5563', marginBottom: 4 }}>Bu Ay Toplam Satış: <Text style={{ fontWeight: 'bold', color: '#1f2937' }}>{branchMonthlySummary.total_sales_amount.toFixed(2)} TL</Text></Text>
                            <Text style={{ fontSize: 12, color: '#4b5563', marginBottom: 8 }}>Malzeme Satışlı Ziyaret: <Text style={{ fontWeight: 'bold' }}>{branchMonthlySummary.total_visits_with_sales}</Text></Text>
                            {Object.keys(branchMonthlySummary.materials_breakdown).length > 0 && (
                                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 4 }}>Bu Ay Kullanılan Toplam Malzemeler:</Text>
                                    {Object.entries(branchMonthlySummary.materials_breakdown).map(([name, details]) => (
                                        <Text key={name} style={{ fontSize: 12, color: '#4b5563', marginLeft: 8 }}>• {name}: <Text style={{ fontWeight: 'bold' }}>{details.total_quantity} {details.unit_type}</Text> ({(details as any).total_item_amount.toFixed(2)} ₺)</Text>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1f2937', marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                            <Activity size={16} color="#6366f1" style={{ marginRight: 6 }} /> Teknik Veriler
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold', marginBottom: 8 }}>Popülasyon Yoğunluğu</Text>
                                {(() => {
                                    const d = (visit.yogunluk || '').toLowerCase();
                                    let color = '#e5e7eb', text = 'Belirtilmedi', pct = '0%';
                                    if (d.includes('yüksek') || d === 'high' || d === 'yuksek') { color = '#ef4444'; text = 'Yüksek'; pct = '100%'; }
                                    else if (d.includes('orta') || d === 'medium') { color = '#f59e0b'; text = 'Orta'; pct = '60%'; }
                                    else if (d.includes('düşük') || d === 'low' || d === 'dusuk') { color = '#22c55e'; text = 'Düşük'; pct = '30%'; }

                                    return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{ flex: 1, height: 10, backgroundColor: '#f3f4f6', borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                                                <View style={{ height: '100%', backgroundColor: color, width: pct as any }} />
                                            </View>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4b5563', marginLeft: 12, width: 40, textAlign: 'right' }}>{text}</Text>
                                        </View>
                                    );
                                })()}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold', marginBottom: 8 }}>Hedef Zararlılar</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {visit.pest_types && visit.pest_types.length > 0 ? visit.pest_types.map((pest, idx) => (
                                        <View key={idx} style={{ backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#fee2e2', flexDirection: 'row', alignItems: 'center' }}>
                                            <Bug size={12} color="#b91c1c" style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#b91c1c' }}>{pest}</Text>
                                        </View>
                                    )) : <Text style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Belirtilmedi</Text>}
                                </View>
                            </View>
                        </View>
                    </View>

                    {visit.image_url && (
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1f2937', marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                                <Camera size={16} color="#4b5563" style={{ marginRight: 6 }} /> Rapor Fotoğrafı
                            </Text>
                            <TouchableOpacity onPress={() => Linking.openURL(visit.image_url!)}>
                                <Image source={{ uri: visit.image_url }} style={{ width: '100%', height: 200, resizeMode: 'contain', backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#f3f4f6' }} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{ marginBottom: 20, gap: 16 }}>
                        <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                                <MessageSquare size={16} color="#4b5563" style={{ marginRight: 6 }} /> Operatör Açıklaması
                            </Text>
                            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' }}>
                                <Text style={{ fontSize: 14, color: visit.aciklama ? '#374151' : '#9ca3af', fontStyle: visit.aciklama ? 'normal' : 'italic' }}>{visit.aciklama || 'Operatör not girmemiş.'}</Text>
                            </View>
                        </View>
                        <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#bfdbfe' }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                                <Megaphone size={16} color="#1e40af" style={{ marginRight: 6 }} /> Müşteri Bilgilendirme Notu
                            </Text>
                            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#dbeafe' }}>
                                <Text style={{ fontSize: 14, color: visit.musteri_aciklamasi ? '#1f2937' : '#9ca3af', fontStyle: visit.musteri_aciklamasi ? 'normal' : 'italic' }}>{visit.musteri_aciklamasi || 'Müşteri için özel bir not girilmemiş.'}</Text>
                            </View>
                        </View>
                        {visit.yonetici_notu && (
                            <View style={{ backgroundColor: '#fefce8', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#fef08a' }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#854d0e', marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                                    <Info size={16} color="#854d0e" style={{ marginRight: 6 }} /> Yönetici Notu
                                </Text>
                                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fef9c3' }}>
                                    <Text style={{ fontSize: 14, color: '#374151', fontStyle: 'italic' }}>{visit.yonetici_notu}</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {((visit as any).total_visit_revenue !== undefined || ((visit as any).material_sales_revenue && (visit as any).material_sales_revenue > 0)) && (
                        <View style={{ backgroundColor: '#1f2937', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#d1d5db', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#4b5563' }}>Finansal Özet</Text>
                            {(visit as any).service_per_visit_revenue !== undefined && (visit as any).service_per_visit_revenue > 0 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={{ fontSize: 14, color: '#d1d5db' }}>Hizmet Bedeli</Text>
                                    <Text style={{ fontSize: 14, color: '#d1d5db' }}>{(visit as any).service_per_visit_revenue.toFixed(2)} TL</Text>
                                </View>
                            )}
                            {(visit as any).material_sales_revenue !== undefined && (visit as any).material_sales_revenue > 0 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={{ fontSize: 14, color: '#d1d5db' }}>Malzeme Satışı</Text>
                                    <Text style={{ fontSize: 14, color: '#d1d5db' }}>{(visit as any).material_sales_revenue.toFixed(2)} TL</Text>
                                </View>
                            )}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: '#4b5563' }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>Toplam Ciro</Text>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#4ade80' }}>{(visit as any).total_visit_revenue?.toFixed(2)} TL</Text>
                            </View>
                        </View>
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            );
        };

        const Content = () => (
            <View style={{ padding: isDesktop ? 16 : 8, backgroundColor: '#f8fafc', flex: 1 }}>
                {/* Header / Nav Block */}
                <View style={{ backgroundColor: '#fff', borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, padding: isDesktop ? 16 : 12, marginBottom: isDesktop ? 24 : 16, flexDirection: isDesktop ? 'row' : 'column', justifyContent: 'space-between', alignItems: isDesktop ? 'center' : 'stretch', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isDesktop ? 'center' : 'space-between', gap: isDesktop ? 16 : 8 }}>
                        <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))} style={{ padding: isDesktop ? 8 : 6, backgroundColor: '#f1f5f9', borderRadius: 100 }}>
                            <ChevronLeft size={isDesktop ? 24 : 20} color="#334155" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: isDesktop ? 24 : 18, fontWeight: 'bold', color: '#1e293b', flex: isDesktop ? undefined : 1, textAlign: 'center', minWidth: isDesktop ? 220 : undefined }}>{format(currentDate, 'MMMM yyyy', { locale: dateLocale })}</Text>
                        <TouchableOpacity onPress={() => setCurrentDate(addMonths(currentDate, 1))} style={{ padding: isDesktop ? 8 : 6, backgroundColor: '#f1f5f9', borderRadius: 100 }}>
                            <ChevronRight size={isDesktop ? 24 : 20} color="#334155" />
                        </TouchableOpacity>
                        {isDesktop && (
                            <TouchableOpacity onPress={() => setCurrentDate(new Date())} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>Bugün</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={{ flexDirection: isDesktop ? 'row' : 'row', gap: 8, justifyContent: isDesktop ? 'flex-end' : 'space-between' }}>
                        {!isDesktop && (
                            <TouchableOpacity onPress={() => setCurrentDate(new Date())} style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>Bugün</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => setShowFilterModal(true)} style={{ flex: !isDesktop ? 1 : undefined, backgroundColor: '#e0e7ff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Filter size={18} color="#4338ca" />
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4338ca' }}>Filtrele</Text>
                            {(selectedCustomer || selectedOperator || selectedStatus || checkedStatusFilter !== 'all' || selectedBranch) && (
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', position: 'absolute', top: 8, right: 8 }} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Grid */}
                <View style={{ backgroundColor: '#fff', borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, padding: isDesktop ? 16 : 0, marginBottom: isDesktop ? 24 : 16, overflow: 'hidden' }}>
                    <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={true} style={{ flexDirection: 'row' }}>
                        <View style={{ width: isDesktop ? '100%' : 900, flex: 1 }}>
                            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8, paddingTop: isDesktop ? 0 : 16 }}>
                                {daysOfWeek.map(day => <Text key={day} style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#64748b', fontSize: 14 }}>{day}</Text>)}
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#f1f5f9' }}>
                                {Array.from({ length: startingDayIndex }).map((_, i) => (
                                    <View key={"empty-" + i} style={{ width: '14.28%', minHeight: 140, backgroundColor: '#f8fafc', borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9' }} />
                                ))}
                                {monthDays.map(day => {
                                    const dayVisits = visits.filter(v => format(new Date(v.visit_date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
                                    const formattedDay = format(day, 'yyyy-MM-dd');
                                    const isTodayDate = isToday(day);
                                    return (
                                        <View key={day.toString()} style={[{ width: '14.28%', minHeight: 140, backgroundColor: '#fff', borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9', padding: 8 }, isTodayDate && { backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#93c5fd' }]}>
                                            <Text style={[{ fontSize: 14, color: '#64748b', fontWeight: '500', marginBottom: 4 }, isTodayDate && { color: '#1d4ed8', fontWeight: 'bold' }]}>{format(day, 'd')}</Text>

                                            <View style={{ marginBottom: 4 }}>
                                                {Array.from(operatorRevenueSummary.values()).map(opSummary => {
                                                    const dailyBr = opSummary.daily_revenue_breakdown.get(formattedDay);
                                                    if (dailyBr && dailyBr.total_daily_revenue > 0) {
                                                        return (
                                                            <View key={opSummary.operator_id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f1f5f9', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginBottom: 2 }}>
                                                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>{opSummary.operator_name.split(' ')[0]}:</Text>
                                                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>{dailyBr.total_daily_revenue.toFixed(0)}₺</Text>
                                                            </View>
                                                        )
                                                    }
                                                    return null;
                                                })}
                                            </View>

                                            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                                                {dayVisits.map(visit => {
                                                    const color = getStatusColor(visit.status);
                                                    const mats = paidMaterialDetailsMap.get(visit.id) || [];
                                                    const totalMatStr = mats.length > 0 ? mats.map(m => m.material_name).join(', ') : "";
                                                    return (
                                                        <TouchableOpacity key={visit.id} onPress={() => setSelectedVisit(visit as any)} style={{ backgroundColor: color, borderRadius: 6, padding: 6, marginBottom: 4, opacity: visit.is_checked ? 0.6 : 1, flexDirection: 'row' }}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#fff' }} numberOfLines={1}>{(visit as any).customer_branches?.branch_name || (visit as any).customers?.company_name || 'Müşteri'}</Text>
                                                                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2 }} numberOfLines={1}>{(visit as any).customers?.company_name || visit.operator?.name}</Text>
                                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 4 }}>
                                                                    <Text style={{ fontSize: 9, color: '#fff', fontWeight: 'bold' }}>{getVisitTypeLabel(visit.visit_type, t)}</Text>
                                                                </View>
                                                                {mats.length > 0 && <Text style={{ fontSize: 9, color: '#fff', marginTop: 4 }} numberOfLines={1}>Malzeme: {totalMatStr}</Text>}
                                                                {((visit as any).total_visit_revenue || 0) > 0 && (
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                                        <DollarSign size={10} color="#fff" />
                                                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#fff' }}>{(visit as any).total_visit_revenue.toFixed(2)}₺</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <TouchableOpacity onPress={() => handleCheckVisit(visit.id, visit.is_checked)} style={{ width: 24, alignItems: 'flex-end' }}>
                                                                <CheckSquare size={16} color={visit.is_checked ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.4)"} />
                                                            </TouchableOpacity>
                                                        </TouchableOpacity>
                                                    )
                                                })}
                                            </ScrollView>
                                        </View>
                                    )
                                })}
                            </View>
                        </View>
                    </ScrollView>
                </View>

                {/* Total Monthly Revenue (Giant Card) */}
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: isDesktop ? 20 : 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, marginBottom: isDesktop ? 24 : 16, flexDirection: isDesktop ? 'row' : 'column', justifyContent: 'space-between', alignItems: isDesktop ? 'center' : 'flex-start', borderWidth: 1, borderColor: '#e2e8f0', gap: isDesktop ? 0 : 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <DollarSign size={isDesktop ? 28 : 24} color="#16a34a" />
                        <Text style={{ fontSize: isDesktop ? 20 : 16, fontWeight: 'bold', color: '#1e293b' }}>{format(currentDate, 'MMMM yyyy', { locale: tr })} Toplam Ciro:</Text>
                    </View>
                    <Text style={{ fontSize: isDesktop ? 28 : 22, fontWeight: '900', color: '#15803d' }}>{totalMonthlyRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</Text>
                </View>

                {/* Legend */}
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: isDesktop ? 20 : 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, marginBottom: 24 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 12 }}>Durum Göstergesi</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isDesktop ? 24 : 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#f59e0b' }} /><Text style={{ fontSize: 14, color: '#475569' }}>Planlandı</Text></View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' }} /><Text style={{ fontSize: 14, color: '#475569' }}>Tamamlandı</Text></View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' }} /><Text style={{ fontSize: 14, color: '#475569' }}>İptal Edildi</Text></View>
                    </View>
                </View>

                {/* Other Summaries if relevant */}
            </View>
        );

        if (isDesktop) {
            return (
                <DesktopLayout>
                    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                        <Content />
                    </ScrollView>
                    <Modal visible={!!selectedVisit} animationType="fade" transparent={true}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { width: '50%', maxWidth: 700, maxHeight: '90%', alignSelf: 'center', padding: 0, overflow: 'hidden' }]}>
                                {selectedVisit && <VisitDetailModalContent visit={selectedVisit} />}
                                <TouchableOpacity onPress={() => setSelectedVisit(null)} style={{ position: 'absolute', top: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}>
                                    <X size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                    <FilterModal />
                </DesktopLayout>
            );
        }

        return (
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('calendar') || 'Takvim'}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <ScrollView style={{ flex: 1 }}>
                    <Content />
                </ScrollView>
                <Modal visible={!!selectedVisit} animationType="fade" transparent={true}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 20, maxHeight: '90%', overflow: 'hidden' }}>
                            {selectedVisit && <VisitDetailModalContent visit={selectedVisit} />}
                            <TouchableOpacity onPress={() => setSelectedVisit(null)} style={{ position: 'absolute', top: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
                <FilterModal />
            </View>
        );
    }

    const styles = StyleSheet.create({
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
        modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 20, fontWeight: 'bold' },
        filterModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
        header: { backgroundColor: '#4caf50', paddingTop: 44, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        backButton: { width: 40, height: 40, justifyContent: 'center' },
        headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
        filterSelectionButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
        filterSelectionButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
        filterSelectionText: { fontSize: 14, color: '#64748b' },
        filterSelectionTextActive: { color: '#fff', fontWeight: 'bold' },
    });
