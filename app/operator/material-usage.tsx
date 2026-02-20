import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react-native';

type MaterialUsage = {
    material_name: string;
    material_unit: string;
    total_quantity: number;
    usage_count: number;
};

type ViewMode = 'monthly' | 'yearly';

export default function MaterialUsageTracking() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [materialUsage, setMaterialUsage] = useState<MaterialUsage[]>([]);
    const [operatorId, setOperatorId] = useState<string | null>(null);

    useEffect(() => {
        loadOperatorData();
    }, []);

    useEffect(() => {
        if (operatorId) {
            loadMaterialUsage();
        }
    }, [operatorId, viewMode, selectedMonth, selectedYear]);

    const loadOperatorData = async () => {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select('id')
                .eq('profile_id', user?.id)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setOperatorId(data.id);
            }
        } catch (error: any) {
            Alert.alert(t('error'), error.message);
        }
    };

    const loadMaterialUsage = async () => {
        try {
            setLoading(true);

            let startDate: string;
            let endDate: string;

            if (viewMode === 'monthly') {
                startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
                endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();
            } else {
                startDate = new Date(selectedYear, 0, 1).toISOString();
                endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();
            }

            // Get visits by operator in the date range
            const { data: visits, error: visitsError } = await supabase
                .from('visits')
                .select('id')
                .eq('operator_id', operatorId)
                .gte('visit_date', startDate)
                .lte('visit_date', endDate);

            if (visitsError) throw visitsError;

            if (!visits || visits.length === 0) {
                setMaterialUsage([]);
                setLoading(false);
                return;
            }

            const visitIds = visits.map(v => v.id);

            // Get paid material sales for these visits with items
            const { data: paidSales, error: paidError } = await supabase
                .from('paid_material_sales')
                .select(`
          id,
          paid_material_sale_items(
            product_id,
            quantity
          )
        `)
                .in('visit_id', visitIds);

            if (paidError) throw paidError;

            if (!paidSales || paidSales.length === 0) {
                setMaterialUsage([]);
                setLoading(false);
                return;
            }

            // Collect all product IDs from sale items
            const productIds = new Set<string>();
            paidSales.forEach(sale => {
                sale.paid_material_sale_items?.forEach((item: any) => {
                    if (item.product_id) {
                        productIds.add(item.product_id);
                    }
                });
            });

            if (productIds.size === 0) {
                setMaterialUsage([]);
                setLoading(false);
                return;
            }

            // Get product details from company_materials
            const { data: products, error: productsError } = await supabase
                .from('company_materials')
                .select('id, name, unit')
                .in('id', Array.from(productIds));

            if (productsError) throw productsError;

            // Create product map for quick lookup
            const productMap = new Map(products?.map(p => [p.id, p]) || []);

            // Aggregate material usage
            const usageMap = new Map<string, MaterialUsage>();

            // Process paid material sales
            paidSales?.forEach(sale => {
                sale.paid_material_sale_items?.forEach((item: any) => {
                    const product = productMap.get(item.product_id);
                    if (product) {
                        const key = product.name;
                        const existing = usageMap.get(key);

                        if (existing) {
                            existing.total_quantity += item.quantity || 0;
                            existing.usage_count += 1;
                        } else {
                            usageMap.set(key, {
                                material_name: product.name,
                                material_unit: product.unit,
                                total_quantity: item.quantity || 0,
                                usage_count: 1,
                            });
                        }
                    }
                });
            });

            // Convert map to array and sort by total quantity
            const usageArray = Array.from(usageMap.values()).sort(
                (a, b) => b.total_quantity - a.total_quantity
            );

            setMaterialUsage(usageArray);
        } catch (error: any) {
            console.error('Error loading material usage:', error);
            Alert.alert(t('error'), error.message);
        } finally {
            setLoading(false);
        }
    };

    const changeMonth = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
            } else {
                setSelectedMonth(selectedMonth - 1);
            }
        } else {
            if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
            } else {
                setSelectedMonth(selectedMonth + 1);
            }
        }
    };

    const changeYear = (direction: 'prev' | 'next') => {
        setSelectedYear(direction === 'prev' ? selectedYear - 1 : selectedYear + 1);
    };

    const totalMaterialsUsed = materialUsage.reduce((sum, item) => sum + item.total_quantity, 0);
    const uniqueMaterialsCount = materialUsage.length;

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text>{t('loading')}</Text>
                </View>
            </View>
        );
    }

    const currentDate = viewMode === 'monthly'
        ? new Date(selectedYear, selectedMonth)
        : new Date(selectedYear, 0);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Malzeme Kullanımı</Text>
                <View style={styles.placeholder} />
            </View>

            {/* View Mode Toggle */}
            <View style={styles.viewToggle}>
                <TouchableOpacity
                    style={[styles.viewToggleButton, viewMode === 'monthly' && styles.viewToggleButtonActive]}
                    onPress={() => setViewMode('monthly')}
                >
                    <Text style={[styles.viewToggleText, viewMode === 'monthly' && styles.viewToggleTextActive]}>
                        Aylık
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.viewToggleButton, viewMode === 'yearly' && styles.viewToggleButtonActive]}
                    onPress={() => setViewMode('yearly')}
                >
                    <Text style={[styles.viewToggleText, viewMode === 'yearly' && styles.viewToggleTextActive]}>
                        Yıllık
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Date Selector */}
            <View style={styles.dateSelector}>
                <TouchableOpacity
                    onPress={() => viewMode === 'monthly' ? changeMonth('prev') : changeYear('prev')}
                    style={styles.dateButton}
                >
                    <ChevronLeft size={24} color="#059669" />
                </TouchableOpacity>
                <Text style={styles.dateText}>
                    {viewMode === 'monthly'
                        ? currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
                        : selectedYear}
                </Text>
                <TouchableOpacity
                    onPress={() => viewMode === 'monthly' ? changeMonth('next') : changeYear('next')}
                    style={styles.dateButton}
                >
                    <ChevronRight size={24} color="#059669" />
                </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Package size={24} color="#059669" />
                    <Text style={styles.statNumber}>{uniqueMaterialsCount}</Text>
                    <Text style={styles.statLabel}>Farklı Malzeme</Text>
                </View>
                <View style={styles.statCard}>
                    <BarChart3 size={24} color="#2196f3" />
                    <Text style={styles.statNumber}>{totalMaterialsUsed.toFixed(0)}</Text>
                    <Text style={styles.statLabel}>Toplam Kullanım</Text>
                </View>
            </View>

            {/* Material List */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {materialUsage.length > 0 ? (
                    materialUsage.map((item, index) => (
                        <View key={index} style={styles.materialCard}>
                            <View style={styles.materialHeader}>
                                <View style={styles.materialInfo}>
                                    <Text style={styles.materialName}>{item.material_name}</Text>
                                    <Text style={styles.materialUnit}>Birim: {item.material_unit}</Text>
                                </View>
                                <View style={styles.materialStats}>
                                    <Text style={styles.materialQuantity}>{item.total_quantity.toFixed(2)}</Text>
                                    <Text style={styles.materialQuantityLabel}>{item.material_unit}</Text>
                                </View>
                            </View>
                            <View style={styles.materialFooter}>
                                <Text style={styles.usageCount}>{item.usage_count} ziyarette kullanıldı</Text>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            { width: `${(item.total_quantity / totalMaterialsUsed) * 100}%` },
                                        ]}
                                    />
                                </View>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Package size={48} color="#ccc" />
                        <Text style={styles.emptyText}>
                            {viewMode === 'monthly'
                                ? 'Bu ay malzeme kullanımı bulunmuyor'
                                : 'Bu yıl malzeme kullanımı bulunmuyor'}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: '#059669',
        paddingTop: 44,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
    },
    placeholder: {
        width: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
    },
    viewToggle: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    viewToggleButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    viewToggleButtonActive: {
        backgroundColor: '#059669',
    },
    viewToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
    },
    viewToggleTextActive: {
        color: '#fff',
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    dateButton: {
        padding: 4,
    },
    dateText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        textTransform: 'capitalize',
    },
    statsContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statNumber: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#059669',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    materialCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    materialHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    materialInfo: {
        flex: 1,
    },
    materialName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    materialUnit: {
        fontSize: 12,
        color: '#666',
    },
    materialStats: {
        alignItems: 'flex-end',
    },
    materialQuantity: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#059669',
    },
    materialQuantityLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    materialFooter: {
        gap: 8,
    },
    usageCount: {
        fontSize: 12,
        color: '#666',
    },
    progressBar: {
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#059669',
        borderRadius: 3,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
});
