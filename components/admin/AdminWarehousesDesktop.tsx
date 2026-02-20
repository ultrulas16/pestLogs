import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Package, Building, Search, X, Trash, Warehouse, Filter, AlertTriangle, ArrowRight } from 'lucide-react-native';
import { DesktopLayout } from '../DesktopLayout';

interface Company {
    id: string;
    name: string;
    owner_id: string;
}

interface AdminWarehouse {
    id: string;
    company_id: string;
    name: string;
    location: string | null;
    warehouse_type: string;
    is_active: boolean;
    company?: Company;
}

interface Material {
    id: string;
    name: string;
    unit: string | null;
    price: number | null;
}

interface WarehouseItem {
    id: string;
    warehouse_id: string;
    product_id: string;
    quantity: number;
    min_quantity: number;
    max_quantity: number;
    unit_cost: number;
    total_value: number;
    material?: Material;
}

export default function AdminWarehousesDesktop() {
    const router = useRouter();
    const { profile } = useAuth();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState<AdminWarehouse[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');

    // Modals
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<AdminWarehouse | null>(null);
    const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);

    // Form states
    const [selectedCompany, setSelectedCompany] = useState('');
    const [warehouseName, setWarehouseName] = useState('');
    const [location, setLocation] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState('');
    const [minQuantity, setMinQuantity] = useState('10');
    const [maxQuantity, setMaxQuantity] = useState('1000');
    const [unitCost, setUnitCost] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadWarehouses(),
                loadCompanies(),
            ]);
        } catch (error: any) {
            console.error('Error loading data:', error);
            Alert.alert(t('error'), error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadWarehouses = async () => {
        const { data, error } = await supabase
            .from('admin_warehouses')
            .select(`
        *,
        company:companies(id, name, owner_id)
      `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        setWarehouses(data || []);
    };

    const loadCompanies = async () => {
        const { data, error } = await supabase
            .from('companies')
            .select('id, name, owner_id')
            .order('name');

        if (error) throw error;
        setCompanies(data || []);
    };

    const loadWarehouseItems = async (warehouseId: string, companyId: string) => {
        try {
            // We don't set global loading here to avoid full page re-render

            const { data: itemsData, error: itemsError } = await supabase
                .from('admin_warehouse_items')
                .select(`
          *,
          material:company_materials(id, name, unit, price)
        `)
                .eq('warehouse_id', warehouseId)
                .order('created_at', { ascending: false });

            if (itemsError) throw itemsError;
            setWarehouseItems(itemsData || []);

            // Load available materials for this company
            const { data: materialsData, error: materialsError } = await supabase
                .from('company_materials')
                .select('id, name, unit, price')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .order('name');

            if (materialsError) throw materialsError;
            setMaterials(materialsData || []);
        } catch (error: any) {
            Alert.alert(t('error'), error.message);
        }
    };

    const handleCreateWarehouse = async () => {
        if (!selectedCompany || !warehouseName.trim()) {
            Alert.alert(t('error'), 'Lütfen şirket ve depo adı seçin');
            return;
        }

        try {
            const { error } = await supabase
                .from('admin_warehouses')
                .insert([{
                    company_id: selectedCompany,
                    name: warehouseName.trim(),
                    location: location.trim() || 'Merkez Ofis',
                    warehouse_type: 'company_main',
                    created_by: profile?.id,
                }]);

            if (error) throw error;

            Alert.alert(t('success'), 'Depo oluşturuldu');
            resetWarehouseForm();
            loadWarehouses();
        } catch (error: any) {
            Alert.alert(t('error'), error.message);
        }
    };

    const handleAddItem = async () => {
        if (!selectedProduct || !quantity || !unitCost) {
            Alert.alert(t('error'), 'Lütfen tüm alanları doldurun');
            return;
        }

        if (!selectedWarehouse) return;

        try {
            const qty = parseFloat(quantity);
            const minQty = parseFloat(minQuantity);
            const maxQty = parseFloat(maxQuantity);
            const cost = parseFloat(unitCost);

            if (isNaN(qty) || qty < 0 || isNaN(cost) || cost < 0) {
                Alert.alert(t('error'), 'Geçerli değerler girin');
                return;
            }

            const { error } = await supabase
                .from('admin_warehouse_items')
                .insert([{
                    warehouse_id: selectedWarehouse.id,
                    product_id: selectedProduct,
                    quantity: qty,
                    min_quantity: minQty,
                    max_quantity: maxQty,
                    unit_cost: cost,
                    last_restocked_at: new Date().toISOString(),
                }]);

            if (error) throw error;

            Alert.alert(t('success'), 'Ürün eklendi');
            resetItemForm();
            loadWarehouseItems(selectedWarehouse.id, selectedWarehouse.company_id);
        } catch (error: any) {
            Alert.alert(t('error'), error.message);
        }
    };

    const handleDeleteWarehouse = async (warehouseId: string) => {
        if (Platform.OS === 'web') {
            if (confirm('Bu depoyu silmek istediğinize emin misiniz? Tüm stok bilgileri silinecek.')) {
                try {
                    const { error } = await supabase
                        .from('admin_warehouses')
                        .delete()
                        .eq('id', warehouseId);

                    if (error) throw error;
                    loadWarehouses();
                    if (selectedWarehouse?.id === warehouseId) {
                        setSelectedWarehouse(null);
                    }
                } catch (error: any) {
                    alert(error.message);
                }
            }
        } else {
            Alert.alert(
                'Depo Sil',
                'Bu depoyu silmek istediğinize emin misiniz? Tüm stok bilgileri silinecek.',
                [
                    { text: 'İptal', style: 'cancel' },
                    {
                        text: 'Sil',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const { error } = await supabase
                                    .from('admin_warehouses')
                                    .delete()
                                    .eq('id', warehouseId);

                                if (error) throw error;
                                Alert.alert(t('success'), 'Depo silindi');
                                loadWarehouses();
                                if (selectedWarehouse?.id === warehouseId) {
                                    setSelectedWarehouse(null);
                                }
                            } catch (error: any) {
                                Alert.alert(t('error'), error.message);
                            }
                        },
                    },
                ]
            );
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (Platform.OS === 'web') {
            if (confirm('Bu ürünü depodan silmek istediğinize emin misiniz?')) {
                try {
                    const { error } = await supabase
                        .from('admin_warehouse_items')
                        .delete()
                        .eq('id', itemId);

                    if (error) throw error;
                    if (selectedWarehouse) {
                        loadWarehouseItems(selectedWarehouse.id, selectedWarehouse.company_id);
                    }
                } catch (error: any) {
                    alert(error.message);
                }
            }
        } else {
            Alert.alert(
                'Ürün Sil',
                'Bu ürünü depodan silmek istediğinize emin misiniz?',
                [
                    { text: 'İptal', style: 'cancel' },
                    {
                        text: 'Sil',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const { error } = await supabase
                                    .from('admin_warehouse_items')
                                    .delete()
                                    .eq('id', itemId);

                                if (error) throw error;
                                Alert.alert(t('success'), 'Ürün silindi');
                                if (selectedWarehouse) {
                                    loadWarehouseItems(selectedWarehouse.id, selectedWarehouse.company_id);
                                }
                            } catch (error: any) {
                                Alert.alert(t('error'), error.message);
                            }
                        },
                    },
                ]
            );
        }
    };

    const resetWarehouseForm = () => {
        setShowWarehouseModal(false);
        setSelectedCompany('');
        setWarehouseName('');
        setLocation('');
    };

    const resetItemForm = () => {
        setShowItemModal(false);
        setSelectedProduct('');
        setQuantity('');
        setMinQuantity('10');
        setMaxQuantity('1000');
        setUnitCost('');
    };

    const filteredWarehouses = warehouses.filter(warehouse => {
        const matchesSearch =
            warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            warehouse.company?.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCompany = selectedCompanyFilter === '' || warehouse.company_id === selectedCompanyFilter;

        return matchesSearch && matchesCompany;
    });

    if (loading) {
        return (
            <DesktopLayout>
                <View style={[styles.container, styles.loadingContainer]}>
                    <ActivityIndicator size="large" color="#7c3aed" />
                </View>
            </DesktopLayout>
        );
    }

    return (
        <DesktopLayout>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Depo Yönetimi</Text>
                        <Text style={styles.headerSubtitle}>Tüm firmaların depolarını ve stoklarını yönetin</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowWarehouseModal(true)} style={styles.addButton}>
                        <Plus size={20} color="#fff" />
                        <Text style={styles.addButtonText}>Yeni Depo</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.contentContainer}>
                    {/* Left Sidebar: Warehouse List */}
                    <View style={styles.sidebar}>
                        <View style={styles.sidebarHeader}>
                            <View style={styles.searchContainer}>
                                <Search size={16} color="#94a3b8" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Depo ara..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            <TouchableOpacity style={styles.filterButton}>
                                <Filter size={16} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionTitle}>Depolar ({filteredWarehouses.length})</Text>

                        <ScrollView style={styles.warehouseList} showsVerticalScrollIndicator={false}>
                            {filteredWarehouses.map((warehouse) => (
                                <TouchableOpacity
                                    key={warehouse.id}
                                    style={[
                                        styles.warehouseItem,
                                        selectedWarehouse?.id === warehouse.id && styles.warehouseItemActive
                                    ]}
                                    onPress={() => {
                                        setSelectedWarehouse(warehouse);
                                        loadWarehouseItems(warehouse.id, warehouse.company_id);
                                    }}
                                >
                                    <View style={[
                                        styles.warehouseIcon,
                                        selectedWarehouse?.id === warehouse.id && styles.warehouseIconActive
                                    ]}>
                                        <Warehouse size={20} color={selectedWarehouse?.id === warehouse.id ? "#7c3aed" : "#64748b"} />
                                    </View>
                                    <View style={styles.warehouseInfo}>
                                        <Text style={[
                                            styles.warehouseName,
                                            selectedWarehouse?.id === warehouse.id && styles.warehouseNameActive
                                        ]}>
                                            {warehouse.name}
                                        </Text>
                                        <Text style={styles.companyName}>
                                            <Building size={12} color="#94a3b8" style={{ marginRight: 4 }} />
                                            {' '}{warehouse.company?.name}
                                        </Text>
                                    </View>
                                    <ArrowRight size={16} color="#cbd5e1" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Right Content: Warehouse Details */}
                    <View style={styles.mainContent}>
                        {selectedWarehouse ? (
                            <View style={styles.detailsContainer}>
                                <View style={styles.detailsHeader}>
                                    <View>
                                        <View style={styles.titleRow}>
                                            <Text style={styles.detailsTitle}>{selectedWarehouse.name}</Text>
                                            <View style={[styles.statusBadge, selectedWarehouse.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                                                <Text style={[styles.statusText, selectedWarehouse.is_active ? styles.activeText : styles.inactiveText]}>
                                                    {selectedWarehouse.is_active ? 'Aktif' : 'Pasif'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.detailsSubtitle}>
                                            {selectedWarehouse.company?.name} • {selectedWarehouse.location || 'Konum belirtilmemiş'}
                                        </Text>
                                    </View>
                                    <View style={styles.headerActions}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleDeleteWarehouse(selectedWarehouse.id)}
                                        >
                                            <Trash size={18} color="#ef4444" />
                                            <Text style={styles.deleteButtonText}>Depoyu Sil</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.primaryButton}
                                            onPress={() => setShowItemModal(true)}
                                        >
                                            <Plus size={18} color="#fff" />
                                            <Text style={styles.primaryButtonText}>Ürün Ekle</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.itemsGridHeader}>
                                    <Text style={[styles.gridHeaderCell, { flex: 2 }]}>Ürün</Text>
                                    <Text style={[styles.gridHeaderCell, { flex: 1, textAlign: 'center' }]}>Mevcut</Text>
                                    <Text style={[styles.gridHeaderCell, { flex: 1, textAlign: 'center' }]}>Min/Max</Text>
                                    <Text style={[styles.gridHeaderCell, { flex: 1, textAlign: 'right' }]}>Birim Maliyet</Text>
                                    <Text style={[styles.gridHeaderCell, { flex: 1, textAlign: 'right' }]}>Toplam Değer</Text>
                                    <Text style={[styles.gridHeaderCell, { width: 50 }]}></Text>
                                </View>

                                <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
                                    {warehouseItems.length === 0 ? (
                                        <View style={styles.emptyState}>
                                            <Package size={48} color="#e2e8f0" />
                                            <Text style={styles.emptyText}>Bu depoda henüz ürün bulunmuyor</Text>
                                            <TouchableOpacity onPress={() => setShowItemModal(true)}>
                                                <Text style={styles.emptyAction}>+ İlk ürünü ekle</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        warehouseItems.map((item) => (
                                            <View key={item.id} style={styles.itemRow}>
                                                <View style={[styles.itemCell, { flex: 2 }]}>
                                                    <View style={styles.itemIcon}>
                                                        <Package size={16} color="#64748b" />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.itemName}>{item.material?.name}</Text>
                                                        <Text style={styles.itemUnit}>{item.material?.unit}</Text>
                                                    </View>
                                                    {item.quantity <= item.min_quantity && (
                                                        <View style={styles.warningTag}>
                                                            <AlertTriangle size={12} color="#b45309" />
                                                            <Text style={styles.warningTagText}>Düşük Stok</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={[styles.itemCell, { flex: 1, justifyContent: 'center' }]}>
                                                    <Text style={[
                                                        styles.quantityText,
                                                        item.quantity <= item.min_quantity && styles.lowStockText
                                                    ]}>
                                                        {item.quantity}
                                                    </Text>
                                                </View>

                                                <View style={[styles.itemCell, { flex: 1, justifyContent: 'center' }]}>
                                                    <Text style={styles.limitText}>{item.min_quantity} / {item.max_quantity}</Text>
                                                </View>

                                                <View style={[styles.itemCell, { flex: 1, justifyContent: 'flex-end' }]}>
                                                    <Text style={styles.costText}>{item.unit_cost.toFixed(2)} ₺</Text>
                                                </View>

                                                <View style={[styles.itemCell, { flex: 1, justifyContent: 'flex-end' }]}>
                                                    <Text style={styles.totalText}>{item.total_value.toFixed(2)} ₺</Text>
                                                </View>

                                                <View style={[styles.itemCell, { width: 50, justifyContent: 'center', alignItems: 'flex-end' }]}>
                                                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)}>
                                                        <Trash size={16} color="#cbd5e1" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </ScrollView>
                            </View>
                        ) : (
                            <View style={styles.emptySelection}>
                                <Warehouse size={64} color="#e2e8f0" />
                                <Text style={styles.emptySelectionText}>Detaylarını görmek için bir depo seçin</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Create Warehouse Modal */}
                <Modal visible={showWarehouseModal} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Yeni Depo Oluştur</Text>
                                <TouchableOpacity onPress={resetWarehouseForm}>
                                    <X size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <Text style={styles.inputLabel}>Şirket Seçin</Text>
                                <View style={styles.companyPicker}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {companies.map(company => (
                                            <TouchableOpacity
                                                key={company.id}
                                                style={[
                                                    styles.companyChip,
                                                    selectedCompany === company.id && styles.companyChipActive
                                                ]}
                                                onPress={() => setSelectedCompany(company.id)}
                                            >
                                                <Text style={[
                                                    styles.companyChipText,
                                                    selectedCompany === company.id && styles.companyChipTextActive
                                                ]}>
                                                    {company.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                <Text style={styles.inputLabel}>Depo Adı</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Örn: Merkez Depo"
                                    value={warehouseName}
                                    onChangeText={setWarehouseName}
                                />

                                <Text style={styles.inputLabel}>Konum</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Örn: İstanbul/Kadıköy"
                                    value={location}
                                    onChangeText={setLocation}
                                />
                            </View>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={resetWarehouseForm}
                                >
                                    <Text style={styles.cancelButtonText}>İptal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton]}
                                    onPress={handleCreateWarehouse}
                                >
                                    <Text style={styles.saveButtonText}>Oluştur</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Add Item Modal */}
                <Modal visible={showItemModal} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Ürün Ekle</Text>
                                <TouchableOpacity onPress={resetItemForm}>
                                    <X size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody}>
                                <Text style={styles.inputLabel}>Ürün Seçin</Text>
                                <View style={styles.productPicker}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {materials.map(material => (
                                            <TouchableOpacity
                                                key={material.id}
                                                style={[
                                                    styles.productChip,
                                                    selectedProduct === material.id && styles.productChipActive
                                                ]}
                                                onPress={() => setSelectedProduct(material.id)}
                                            >
                                                <Text style={[
                                                    styles.productChipText,
                                                    selectedProduct === material.id && styles.productChipTextActive
                                                ]}>
                                                    {material.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={styles.formCol}>
                                        <Text style={styles.inputLabel}>Miktar</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="0"
                                            keyboardType="numeric"
                                            value={quantity}
                                            onChangeText={setQuantity}
                                        />
                                    </View>
                                    <View style={styles.formCol}>
                                        <Text style={styles.inputLabel}>Birim Maliyet (₺)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="0.00"
                                            keyboardType="numeric"
                                            value={unitCost}
                                            onChangeText={setUnitCost}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={styles.formCol}>
                                        <Text style={styles.inputLabel}>Min Stok</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="10"
                                            keyboardType="numeric"
                                            value={minQuantity}
                                            onChangeText={setMinQuantity}
                                        />
                                    </View>
                                    <View style={styles.formCol}>
                                        <Text style={styles.inputLabel}>Max Stok</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="1000"
                                            keyboardType="numeric"
                                            value={maxQuantity}
                                            onChangeText={setMaxQuantity}
                                        />
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={resetItemForm}
                                >
                                    <Text style={styles.cancelButtonText}>İptal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton]}
                                    onPress={handleAddItem}
                                >
                                    <Text style={styles.saveButtonText}>Ekle</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </DesktopLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        height: '100%',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7c3aed',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'row',
        gap: 24,
        overflow: 'hidden',
    },
    sidebar: {
        width: 320,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
    },
    sidebarHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        flexDirection: 'row',
        gap: 8,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchInput: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 8,
        fontSize: 13,
        color: '#0f172a',
    },
    filterButton: {
        width: 36,
        height: 36,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
    },
    warehouseList: {
        flex: 1,
    },
    warehouseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 12,
    },
    warehouseItemActive: {
        backgroundColor: '#f5f3ff',
    },
    warehouseIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    warehouseIconActive: {
        backgroundColor: '#fff',
    },
    warehouseInfo: {
        flex: 1,
    },
    warehouseName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 2,
    },
    warehouseNameActive: {
        color: '#7c3aed',
    },
    companyName: {
        fontSize: 12,
        color: '#64748b',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    mainContent: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    emptySelection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
    },
    emptySelectionText: {
        fontSize: 16,
        color: '#64748b',
        marginTop: 16,
    },
    detailsContainer: {
        flex: 1,
    },
    detailsHeader: {
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        backgroundColor: '#f8fafc',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 4,
    },
    detailsTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    activeBadge: {
        backgroundColor: '#dcfce7',
    },
    inactiveBadge: {
        backgroundColor: '#fee2e2',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    activeText: {
        color: '#16a34a',
    },
    inactiveText: {
        color: '#ef4444',
    },
    detailsSubtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    deleteButtonText: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: '500',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#7c3aed',
        gap: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    itemsGridHeader: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    gridHeaderCell: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    itemsList: {
        flex: 1,
    },
    itemRow: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'center',
    },
    itemCell: {
        // Flex handled inline
    },
    itemIcon: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    itemUnit: {
        fontSize: 12,
        color: '#64748b',
    },
    warningTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffedd5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 12,
        gap: 4,
    },
    warningTagText: {
        fontSize: 11,
        color: '#b45309',
        fontWeight: '500',
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0f172a',
        textAlign: 'center',
    },
    lowStockText: {
        color: '#ef4444',
        fontWeight: '700',
    },
    limitText: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
    },
    costText: {
        fontSize: 14,
        color: '#334155',
        textAlign: 'right',
    },
    totalText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        textAlign: 'right',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyAction: {
        color: '#7c3aed',
        fontWeight: '600',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: 500,
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 5,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    modalBody: {
        padding: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#334155',
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#0f172a',
        backgroundColor: '#fff',
    },
    companyPicker: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    companyChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    companyChipActive: {
        backgroundColor: '#f5f3ff',
        borderColor: '#7c3aed',
    },
    companyChipText: {
        fontSize: 13,
        color: '#64748b',
    },
    companyChipTextActive: {
        color: '#7c3aed',
        fontWeight: '600',
    },
    productPicker: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    productChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    productChipActive: {
        backgroundColor: '#f5f3ff',
        borderColor: '#7c3aed',
    },
    productChipText: {
        fontSize: 13,
        color: '#64748b',
    },
    productChipTextActive: {
        color: '#7c3aed',
        fontWeight: '600',
    },
    formRow: {
        flexDirection: 'row',
        gap: 16,
    },
    formCol: {
        flex: 1,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    modalButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    cancelButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cancelButtonText: {
        color: '#64748b',
        fontWeight: '500',
    },
    saveButton: {
        backgroundColor: '#7c3aed',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '500',
    },
});
