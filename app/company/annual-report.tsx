import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Platform, Alert } from 'react-native';
import { DesktopLayout } from '@/components/DesktopLayout';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Download, Search, RefreshCw, Info, ArrowUp, ArrowDown, CheckSquare, Square, AlertCircle } from 'lucide-react-native';
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'sonner';

// --- TİP TANIMLARI ---
interface ReportRow {
    musteri_no: string;
    sube_id: string;
    cari_isim: string;
    sube_adi: string;
    branch_uuid: string;
    months: {
        [key: number]: {
            // Ziyaret Verileri
            visitCount: number;
            hasVisit: boolean;
            visitDetails: string[];
            visitIds: string[];
            visitCheckedCount: number; // is_checked (Takvim onayı) sayısı

            // Malzeme Verileri
            hasMaterial: boolean;
            materialDetails: string[];
            materialBreakdown: Record<string, number>;
            totalMaterialCount: number;
            materialSaleIds: string[];
            materialInvoicedCount: number; // is_invoiced (Fatura) sayısı
        };
    };
}

interface VisitData {
    id: string;
    branch_id: string;
    visit_date: string;
    status: string;
    is_checked: boolean;
    operator?: {
        full_name: string;
    };
    // İlişkisel veri - paid_material_sales tablosu
    paid_material_sales?: {
        id: string;
        is_invoiced: boolean;
        paid_material_sale_items: {
            quantity: number;
            company_materials?: { name: string } | null;
        }[];
    }[];
}

export default function AnnualVisitReport() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ReportRow[]>([]);
    const [year, setYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    const [updating, setUpdating] = useState(false);

    // Sıralama State'i
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    const fetchReportData = async () => {
        setLoading(true);
        setErrorMsg(null);
        setProgress('Veriler hazırlanıyor...');

        try {
            // 1. Şubeleri Çek
            const { data: branches, error: branchError } = await supabase
                .from('customer_branches') // Tablo adı customer_branches
                .select(`
          id,
          branch_name,
          customer_id,
          customer:customer_id (
            id,
            company_name, 
            address
          )
        `);

            if (branchError) throw new Error(`Şubeler çekilemedi: ${branchError.message}`);

            // 2. Ziyaretleri ve Malzemeleri TEK SORGUDA Çek
            setProgress('Ziyaretler ve malzeme verileri çekiliyor...');
            const startDate = `${year}-01-01T00:00:00`;
            const endDate = `${year}-12-31T23:59:59`;

            let allVisits: VisitData[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                // Not: visit_paid_products tablosunu joinliyoruz
                // operator tablosu profiles ile ilişkili, operator_id -> profiles(id)
                const { data: visitsChunk, error: visitError } = await supabase
                    .from('visits')
                    .select(`
            id, 
            branch_id, 
            visit_date, 
            status,
            is_checked, 
            is_checked, 
            operator:operator_id ( full_name ),
            paid_material_sales (
                id,
                is_invoiced,
                paid_material_sale_items (
                    quantity,
                    company_materials ( name )
                )
            )
          `)
                    .gte('visit_date', startDate)
                    .lte('visit_date', endDate)
                    .neq('status', 'cancelled')
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (visitError) throw new Error(`Veri çekilemedi: ${visitError.message}`);

                if (visitsChunk && visitsChunk.length > 0) {
                    const typedChunk = visitsChunk as unknown as VisitData[];
                    allVisits = [...allVisits, ...typedChunk];

                    if (visitsChunk.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                        setProgress(`${allVisits.length} işlem analiz edildi...`);
                    }
                } else {
                    hasMore = false;
                }
            }

            // 3. Veriyi İşle ve Tabloyu Oluştur
            setProgress('Rapor oluşturuluyor...');

            const processedData: ReportRow[] = (branches || []).map((branch: any) => {
                const customer = branch.customer;
                // customer.company_name 'i cari_isim olarak kullanıyoruz
                // musteri_no yoksa id'nin ilk 8 hanesi
                const musteriNo = customer?.id?.substring(0, 8).toUpperCase() || '-';
                const subeIdShort = branch.id && branch.id.includes('-') ? branch.id.split('-')[0] : branch.id?.substring(0, 8);

                const row: ReportRow = {
                    musteri_no: musteriNo,
                    sube_id: subeIdShort || '-',
                    cari_isim: customer?.company_name || 'İsimsiz Cari',
                    sube_adi: branch.branch_name || 'İsimsiz Şube',
                    branch_uuid: branch.id,
                    months: {}
                };

                // Ayları başlat
                for (let i = 0; i < 12; i++) {
                    row.months[i] = {
                        visitCount: 0,
                        hasVisit: false,
                        visitDetails: [],
                        visitIds: [],
                        visitCheckedCount: 0,

                        hasMaterial: false,
                        materialDetails: [],
                        materialBreakdown: {},
                        totalMaterialCount: 0,
                        materialSaleIds: [],
                        materialInvoicedCount: 0
                    };
                }

                // Ziyaretleri ve içindeki malzemeleri dağıt
                allVisits.forEach((visit) => {
                    if (visit.branch_id === branch.id) {
                        const visitDate = new Date(visit.visit_date);
                        const monthIndex = visitDate.getMonth();

                        if (row.months[monthIndex]) {
                            const mData = row.months[monthIndex];

                            // --- ZİYARET VERİLERİ ---
                            mData.visitCount += 1;
                            mData.hasVisit = true;
                            mData.visitIds.push(visit.id);

                            if (visit.is_checked) mData.visitCheckedCount += 1;

                            const dateStr = visitDate.toLocaleDateString('tr-TR');
                            const operatorName = visit.operator?.full_name ? ` - ${visit.operator.full_name}` : '';
                            const statusStr = visit.status === 'completed' ? 'Tamamlandı' : 'Planlandı';
                            const checkStr = visit.is_checked ? ' [ONAYLI]' : '';

                            mData.visitDetails.push(`${dateStr} (${statusStr})${operatorName}${checkStr}`);

                            // --- MALZEME VERİLERİ ---
                            if (visit.paid_material_sales && visit.paid_material_sales.length > 0) {
                                mData.hasMaterial = true;

                                visit.paid_material_sales.forEach(sale => {
                                    mData.materialSaleIds.push(sale.id);
                                    if (sale.is_invoiced) mData.materialInvoicedCount += 1;

                                    if (sale.paid_material_sale_items) {
                                        sale.paid_material_sale_items.forEach(item => {
                                            const pName = item.company_materials?.name || 'Ürün';
                                            const qty = item.quantity || 0;

                                            const currentQty = mData.materialBreakdown[pName] || 0;
                                            mData.materialBreakdown[pName] = currentQty + qty;
                                            mData.totalMaterialCount += qty;

                                            mData.materialDetails.push(`${dateStr}: ${pName} (${qty})`);
                                        });
                                    }
                                });
                            }
                        }
                    }
                });

                return row;
            });

            // Varsayılan sıralama (Alfabetik)
            processedData.sort((a, b) => a.cari_isim.localeCompare(b.cari_isim, 'tr'));
            setData(processedData);

        } catch (error: any) {
            console.error('Rapor hatası:', error);
            setErrorMsg(error.message || 'Bilinmeyen bir hata oluştu.');
            toast.error('Veri çekilemedi: ' + error.message);
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    useEffect(() => {
        fetchReportData();
    }, [year]);

    // --- TOPLU GÜNCELLEME ---
    const toggleStatus = async (
        rowIdx: number,
        monthIdx: number,
        type: 'visit' | 'material',
        ids: string[],
        targetStatus: boolean
    ) => {

        if (ids.length === 0) return;
        setUpdating(true);

        try {
            let table = '';
            let field = '';

            if (type === 'visit') {
                table = 'visits';
                field = 'is_checked';
            } else {
                table = 'paid_material_sales'; // Tablo adı düzeltildi
                field = 'is_invoiced';
            }

            const { error } = await supabase
                .from(table)
                .update({ [field]: targetStatus })
                .in('id', ids);

            if (error) throw error;

            // Optimistic Update
            const targetBranchId = sortedAndFilteredData[rowIdx].branch_uuid;

            const newData = data.map(row => {
                if (row.branch_uuid === targetBranchId) {
                    const newMonths = { ...row.months };
                    const mData = { ...newMonths[monthIdx] };

                    if (type === 'visit') {
                        mData.visitCheckedCount = targetStatus ? mData.visitCount : 0;
                        // Detayları güncelle
                        mData.visitDetails = mData.visitDetails.map(d => {
                            if (targetStatus && !d.includes('[ONAYLI]')) return d + ' [ONAYLI]';
                            if (!targetStatus && d.includes('[ONAYLI]')) return d.replace(' [ONAYLI]', '');
                            return d;
                        });
                    } else {
                        mData.materialInvoicedCount = targetStatus ? mData.materialSaleIds.length : 0;
                    }
                    newMonths[monthIdx] = mData;
                    return { ...row, months: newMonths };
                }
                return row;
            });

            setData(newData);

            const actionText = type === 'visit' ? (targetStatus ? 'onaylandı' : 'onayı kaldırıldı') : (targetStatus ? 'faturalandı' : 'iptal edildi');
            toast.success(`${ids.length} kayıt ${actionText}.`);

        } catch (err: any) {
            toast.error("Güncelleme başarısız: " + err.message);
        } finally {
            setUpdating(false);
        }
    };

    const generateMaterialSummary = (mData: ReportRow['months'][0]) => {
        if (!mData.hasMaterial) return '';
        let text = 'ZİYARET DETAYLARI:\n' + mData.materialDetails.join('\n');
        text += '\n\n----------------\nÜRÜN BAZLI TOPLAM:\n';
        Object.entries(mData.materialBreakdown).forEach(([name, qty]) => {
            text += `${name}: ${qty}\n`;
        });
        text += `----------------\nGENEL TOPLAM: ${mData.totalMaterialCount} Adet`;
        return text;
    };

    const exportToExcel = () => {
        const exportData = sortedAndFilteredData.map(row => {
            const flatRow: any = {
                'Müşteri No': row.musteri_no,
                'Şube No': row.sube_id,
                'Cari Ad': row.cari_isim,
                'Şube Adı': row.sube_adi,
            };

            months.forEach((month, index) => {
                const mData = row.months[index];
                const isVisitFullyChecked = mData.visitCount > 0 && mData.visitCount === mData.visitCheckedCount;
                const isMatFullyInvoiced = mData.hasMaterial && mData.materialSaleIds.length > 0 && mData.materialSaleIds.length === mData.materialInvoicedCount;

                flatRow[`${month} (Ziyaret Sayısı)`] = mData.visitCount;
                flatRow[`${month} (Ziyaret Onay)`] = isVisitFullyChecked ? 'EVET' : (mData.visitCheckedCount > 0 ? 'KISMEN' : 'HAYIR');

                flatRow[`${month} (Malzeme)`] = mData.hasMaterial ? `Var (${mData.totalMaterialCount})` : '-';
                flatRow[`${month} (Malzeme Fatura)`] = isMatFullyInvoiced ? 'EVET' : (mData.materialInvoicedCount > 0 ? 'KISMEN' : 'HAYIR');
            });

            return flatRow;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${year} Yıllık Rapor`);
        XLSX.writeFile(wb, `Yillik_Rapor_Detayli_${year}.xlsx`);
        toast.success('Excel raporu indirildi.');
    };

    const handleSort = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const sortedAndFilteredData = useMemo(() => {
        let result = data.filter(row =>
            row.cari_isim.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.sube_adi.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.musteri_no.toLowerCase().includes(searchTerm.toLowerCase())
        );

        result.sort((a, b) => {
            const nameA = `${a.cari_isim} ${a.sube_adi}`;
            const nameB = `${b.cari_isim} ${b.sube_adi}`;

            if (sortOrder === 'asc') {
                return nameA.localeCompare(nameB, 'tr');
            } else {
                return nameB.localeCompare(nameA, 'tr');
            }
        });

        return result;
    }, [data, searchTerm, sortOrder]);

    return (
        <DesktopLayout>
            <View style={styles.container}>
                <Toaster position="top-right" />

                {/* Header Section */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Yıllık Ziyaret ve Fatura Takibi</Text>
                        <Text style={styles.subtitle}>
                            {year} yılı analiz tablosu. Sol kutucuk (Ziyaret) Takvim Onayı, Sağ kutucuk (Malzeme) Fatura Durumu kontrol eder.
                        </Text>
                    </View>

                    <View style={styles.actions}>
                        <View style={styles.searchContainer}>
                            <Search style={styles.searchIcon} size={16} color="#9ca3af" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Müşteri, Şube Ara..."
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                                placeholderTextColor="#9ca3af"
                            />
                        </View>

                        <TextInput
                            style={styles.yearInput}
                            value={year.toString()}
                            onChangeText={(t) => setYear(parseInt(t) || new Date().getFullYear())}
                            keyboardType="numeric"
                            maxLength={4}
                        />

                        <TouchableOpacity onPress={fetchReportData} style={styles.iconButton}>
                            <RefreshCw size={16} color="#4b5563" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={exportToExcel} style={styles.exportButton}>
                            <Download size={16} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.exportButtonText}>Excel</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {errorMsg && (
                    <View style={styles.errorContainer}>
                        <AlertCircle size={20} color="#b91c1c" style={{ marginRight: 12 }} />
                        <View>
                            <Text style={styles.errorTitle}>Hata</Text>
                            <Text style={styles.errorText}>{errorMsg}</Text>
                        </View>
                    </View>
                )}

                {/* Table Section */}
                <View style={styles.tableContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            {/* Table Header */}
                            <View style={styles.tableHeader}>
                                <View style={[styles.headerCell, styles.colFixed, { width: 100 }]}>
                                    <Text style={styles.headerText}>Müşteri No</Text>
                                </View>
                                <TouchableOpacity style={[styles.headerCell, styles.colFixed, { width: 200, left: 100 }]} onPress={handleSort}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={styles.headerText}>Cari / Şube</Text>
                                        {sortOrder === 'asc' ? <ArrowUp size={14} color="#6b7280" /> : <ArrowDown size={14} color="#6b7280" />}
                                    </View>
                                </TouchableOpacity>

                                {months.map((month) => (
                                    <View key={month} style={[styles.headerCell, styles.monthHeader]}>
                                        <Text style={styles.monthHeaderText}>{month}</Text>
                                        <View style={styles.subHeaderRow}>
                                            <Text style={styles.subHeaderText}>Ziyaret</Text>
                                            <View style={styles.separator} />
                                            <Text style={styles.subHeaderText}>Malz.</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <ScrollView style={{ maxHeight: '80%' }}>
                                {loading && data.length === 0 ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color="#3b82f6" />
                                        <Text style={styles.loadingText}>{progress}</Text>
                                    </View>
                                ) : sortedAndFilteredData.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>Kayıt bulunamadı.</Text>
                                    </View>
                                ) : (
                                    sortedAndFilteredData.map((row, rowIdx) => (
                                        <View key={`${row.musteri_no}-${row.sube_id}-${row.branch_uuid}`} style={styles.row}>
                                            <View style={[styles.cell, styles.colFixed, { width: 100 }]}>
                                                <Text style={styles.cellText}>{row.musteri_no}</Text>
                                            </View>
                                            <View style={[styles.cell, styles.colFixed, { width: 200, left: 100 }]}>
                                                <Text style={styles.cellTextBold} numberOfLines={1}>{row.cari_isim}</Text>
                                                <Text style={styles.cellTextSmall} numberOfLines={1}>{row.sube_adi}</Text>
                                            </View>

                                            {months.map((_, mIdx) => {
                                                const mData = row.months[mIdx];
                                                const isVisitFullyChecked = mData.visitCount > 0 && mData.visitCount === mData.visitCheckedCount;
                                                const isMatFullyInvoiced = mData.hasMaterial && mData.materialSaleIds.length > 0 && mData.materialSaleIds.length === mData.materialInvoicedCount;

                                                return (
                                                    <View key={mIdx} style={[styles.cell, styles.monthCell]}>
                                                        {/* Ziyaret */}
                                                        <View style={[styles.subCell, mData.hasVisit ? (isVisitFullyChecked ? styles.bgGreen100 : styles.bgGreen50) : null]}>
                                                            {mData.hasVisit ? (
                                                                <>
                                                                    <Text style={[styles.countText, { color: '#15803d' }]}>{mData.visitCount}</Text>
                                                                    <TouchableOpacity
                                                                        onPress={() => toggleStatus(rowIdx, mIdx, 'visit', mData.visitIds, !isVisitFullyChecked)}
                                                                        disabled={updating}
                                                                        style={styles.checkbox}
                                                                    >
                                                                        {isVisitFullyChecked ? <CheckSquare size={14} color="#16a34a" /> : <Square size={14} color="#9ca3af" />}
                                                                    </TouchableOpacity>
                                                                </>
                                                            ) : <Text style={styles.dashText}>-</Text>}
                                                        </View>

                                                        <View style={styles.cellSeparator} />

                                                        {/* Malzeme */}
                                                        <View style={[styles.subCell, mData.hasMaterial ? (isMatFullyInvoiced ? styles.bgOrange100 : styles.bgOrange50) : null]}>
                                                            {mData.hasMaterial ? (
                                                                <>
                                                                    <Text style={[styles.countText, { color: '#c2410c' }]}>{mData.totalMaterialCount}</Text>
                                                                    <TouchableOpacity
                                                                        onPress={() => toggleStatus(rowIdx, mIdx, 'material', mData.materialSaleIds, !isMatFullyInvoiced)}
                                                                        disabled={updating}
                                                                        style={styles.checkbox}
                                                                    >
                                                                        {isMatFullyInvoiced ? <CheckSquare size={14} color="#ea580c" /> : <Square size={14} color="#9ca3af" />}
                                                                    </TouchableOpacity>
                                                                </>
                                                            ) : <Text style={styles.dashText}>-</Text>}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                {/* Legend / Footer */}
                <View style={styles.footer}>
                    <View style={styles.legendItem}>
                        <Info size={14} color="#6b7280" />
                        <Text style={styles.legendText}>Sol: Ziyaret Onayı (Takvim), Sağ: Malzeme Faturası</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={styles.legendItem}><View style={[styles.legendBox, styles.bgGreen50]} /><Text style={styles.legendText}>Ziyaret Bekliyor</Text></View>
                        <View style={styles.legendItem}><View style={[styles.legendBox, styles.bgGreen100]} /><Text style={styles.legendText}>Ziyaret Onaylı</Text></View>
                        <View style={styles.legendItem}><View style={[styles.legendBox, styles.bgOrange50]} /><Text style={styles.legendText}>Malz. Bekliyor</Text></View>
                        <View style={styles.legendItem}><View style={[styles.legendBox, styles.bgOrange100]} /><Text style={styles.legendText}>Malz. Faturalı</Text></View>
                    </View>
                </View>
            </View>
        </DesktopLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#f9fafb',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        gap: 16,
        flexWrap: 'wrap',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
        maxWidth: 600,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 8,
        height: 40,
        minWidth: 200,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
        paddingVertical: 0,
    },
    yearInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        height: 40,
        width: 80,
        textAlign: 'center',
        fontSize: 14,
        color: '#111827',
    },
    iconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16a34a', // green-600
        paddingHorizontal: 16,
        height: 40,
        borderRadius: 8,
    },
    exportButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    errorContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#b91c1c',
    },
    errorText: {
        fontSize: 14,
        color: '#b91c1c',
        marginTop: 2,
    },
    tableContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerCell: {
        padding: 12,
        borderRightWidth: 1,
        borderRightColor: '#e5e7eb',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
    },
    headerText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    colFixed: {
        position: 'sticky', // Note: React Native Web supports sticky. Native needs standard sticky headers features.
        // For pure React Native, horizontal sticky cols are hard. Assuming we are targeting Web primarily or accepting scrolling.
        // If Native, we might drop sticky prop or use a library.
        // However, user is on Web (npx expo start --web).
        left: 0,
        zIndex: 10,
        backgroundColor: '#f9fafb',
    },
    monthHeader: {
        width: 120,
        alignItems: 'center',
        padding: 4,
        backgroundColor: '#eff6ff', // blue-50
    },
    monthHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
        textAlign: 'center',
    },
    subHeaderRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#dbeafe',
        paddingTop: 2,
    },
    subHeaderText: {
        flex: 1,
        fontSize: 10,
        color: '#6b7280',
        textAlign: 'center',
    },
    separator: {
        width: 1,
        backgroundColor: '#dbeafe',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        colors: '#6b7280',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    cell: {
        padding: 8,
        borderRightWidth: 1,
        borderRightColor: '#f3f4f6',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    cellText: {
        fontSize: 13,
        color: '#111827',
    },
    cellTextBold: {
        fontSize: 13,
        fontWeight: '500',
        color: '#111827',
    },
    cellTextSmall: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    monthCell: {
        width: 120,
        flexDirection: 'row',
        padding: 0,
    },
    subCell: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
        gap: 4,
    },
    cellSeparator: {
        width: 1,
        backgroundColor: '#f3f4f6',
    },
    countText: {
        fontSize: 11,
        fontWeight: '600',
    },
    checkbox: {
        padding: 2,
    },
    dashText: {
        fontSize: 12,
        color: '#e5e7eb',
    },
    bgGreen50: { backgroundColor: '#f0fdf4' },
    bgGreen100: { backgroundColor: '#dcfce7' },
    bgOrange50: { backgroundColor: '#fff7ed' },
    bgOrange100: { backgroundColor: '#ffedd5' },

    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        padding: 12,
        backgroundColor: '#f9fafb',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        flexWrap: 'wrap',
        gap: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendBox: {
        width: 12,
        height: 12,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    legendText: {
        fontSize: 12,
        color: '#6b7280',
    },
});
