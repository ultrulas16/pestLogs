import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, X, Calendar, MapPin, ChevronLeft, ChevronRight, FileText } from 'lucide-react-native';
import { Visit } from '@/types/visits';
import { formatDate } from '@/lib/utils';

const ITEMS_PER_PAGE = 15;

export default function CompletedVisits() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        loadCompletedVisits();
    }, [selectedMonth, selectedYear]);

    const loadCompletedVisits = async () => {
        try {
            setLoading(true);

            // First get operator ID from profile ID
            const { data: operatorData, error: operatorError } = await supabase
                .from('operators')
                .select('id')
                .eq('profile_id', user?.id)
                .maybeSingle();

            if (operatorError) throw operatorError;
            if (!operatorData) {
                setVisits([]);
                setLoading(false);
                return;
            }

            const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
            const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

            const { data, error } = await supabase
                .from('visits')
                .select(`
          *,
          customer:customers(id, company_name, address),
          branch:customer_branches(id, branch_name, address)
        `)
                .eq('operator_id', operatorData.id)
                .eq('status', 'completed')
                .gte('visit_date', startDate)
                .lte('visit_date', endDate)
                .order('visit_date', { ascending: false });

            if (error) throw error;

            setVisits(data || []);
        } catch (error: any) {
            console.error('Error loading completed visits:', error);
            Alert.alert(t('error'), error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredVisits = visits.filter(visit => {
        if (!searchQuery) return true;

        const searchLower = searchQuery.toLowerCase();
        return (
            visit.customer?.company_name?.toLowerCase().includes(searchLower) ||
            visit.branch?.branch_name?.toLowerCase().includes(searchLower) ||
            visit.branch?.address?.toLowerCase().includes(searchLower) ||
            visit.report_number?.toLowerCase().includes(searchLower)
        );
    });

    const paginatedVisits = filteredVisits.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalPages = Math.ceil(filteredVisits.length / ITEMS_PER_PAGE);

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
        setCurrentPage(1);
    };

    const renderVisitCard = (visit: any) => {
        return (
            <TouchableOpacity
                key={visit.id}
                style={styles.visitCard}
                onPress={() => router.push(`/operator/visit-details?visitId=${visit.id}`)}
            >
                <View style={styles.visitHeader}>
                    <View style={styles.visitInfo}>
                        <Text style={styles.visitCustomer}>
                            {visit.customer?.company_name}
                        </Text>
                        {visit.branch && (
                            <Text style={styles.visitBranch}>
                                {visit.branch.branch_name}
                            </Text>
                        )}
                    </View>
                    {visit.report_number && (
                        <View style={styles.reportBadge}>
                            <FileText size={14} color="#059669" />
                            <Text style={styles.reportNumber}>{visit.report_number}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.visitDetails}>
                    {visit.branch?.address && (
                        <View style={styles.detailRow}>
                            <MapPin size={16} color="#666" />
                            <Text style={styles.detailText}>
                                {visit.branch.address}
                            </Text>
                        </View>
                    )}
                    <View style={styles.detailRow}>
                        <Calendar size={16} color="#666" />
                        <Text style={styles.detailText}>
                            {formatDate(visit.visit_date, true)}
                        </Text>
                    </View>
                    {visit.completed_date && (
                        <View style={styles.detailRow}>
                            <Text style={styles.completedLabel}>Tamamlanma:</Text>
                            <Text style={styles.completedDate}>
                                {formatDate(visit.completed_date, true)}
                            </Text>
                        </View>
                    )}
                </View>

                {visit.visit_type && (
                    <View style={styles.visitTypeContainer}>
                        <Text style={styles.visitTypeLabel}>Ziyaret Türü:</Text>
                        <Text style={styles.visitType}>{visit.visit_type}</Text>
                    </View>
                )}

                {visit.notes && (
                    <View style={styles.notesContainer}>
                        <Text style={styles.notesLabel}>Notlar:</Text>
                        <Text style={styles.notes} numberOfLines={2}>{visit.notes}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text>{t('loading')}</Text>
                </View>
            </View>
        );
    }

    const currentDate = new Date(selectedYear, selectedMonth);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Tamamlanan İşler</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.searchContainer}>
                <Search size={20} color="#999" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Müşteri, şube veya rapor no ile ara..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <X size={20} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.monthSelector}>
                <TouchableOpacity onPress={() => changeMonth('prev')} style={styles.monthButton}>
                    <ChevronLeft size={24} color="#059669" />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                    {currentDate.toLocaleDateString(user?.user_metadata?.language || 'tr-TR', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => changeMonth('next')} style={styles.monthButton}>
                    <ChevronRight size={24} color="#059669" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{filteredVisits.length}</Text>
                    <Text style={styles.statLabel}>Toplam Tamamlanan</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{visits.length}</Text>
                    <Text style={styles.statLabel}>Bu Ay</Text>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {paginatedVisits.length > 0 ? (
                    <>
                        {paginatedVisits.map(visit => renderVisitCard(visit))}

                        {totalPages > 1 && (
                            <View style={styles.paginationContainer}>
                                <TouchableOpacity
                                    style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                                    onPress={() => setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft size={20} color={currentPage === 1 ? '#ccc' : '#059669'} />
                                </TouchableOpacity>
                                <Text style={styles.paginationText}>
                                    Sayfa {currentPage} / {totalPages}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                                    onPress={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight size={20} color={currentPage === totalPages ? '#ccc' : '#059669'} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <FileText size={48} color="#ccc" />
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'Arama kriterlerine uygun tamamlanmış iş bulunamadı' : 'Bu ay tamamlanmış iş bulunmuyor'}
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        fontSize: 14,
    },
    monthSelector: {
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
    monthButton: {
        padding: 4,
    },
    monthText: {
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
    visitCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#059669',
    },
    visitHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    visitInfo: {
        flex: 1,
    },
    visitCustomer: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    visitBranch: {
        fontSize: 14,
        color: '#666',
    },
    reportBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f5e9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    reportNumber: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    visitDetails: {
        gap: 8,
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#666',
        flex: 1,
    },
    completedLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    completedDate: {
        fontSize: 12,
        color: '#666',
    },
    visitTypeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    visitTypeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
    },
    visitType: {
        fontSize: 12,
        color: '#333',
    },
    notesContainer: {
        backgroundColor: '#f9fafb',
        padding: 8,
        borderRadius: 6,
        marginTop: 4,
    },
    notesLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
    },
    notes: {
        fontSize: 12,
        color: '#333',
        lineHeight: 16,
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 16,
    },
    paginationButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    paginationButtonDisabled: {
        opacity: 0.5,
    },
    paginationText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
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
