import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext'; // useLanguage hook'u import edildi
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CreditCard as Edit, Search, X, DollarSign, Package } from 'lucide-react-native';
import { DesktopLayout } from '@/components/DesktopLayout';

interface Material {
  id: string;
  name: string;
  unit: string | null;
  price: number | null;
  description: string | null;
  is_active: boolean;
  // Yeni eklenen alanlar
  currentMonthSalesQuantity: number;
  currentMonthSalesRevenue: number;
}

export default function PaidProducts() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage(); // t hook'u alındı
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [price, setPrice] = useState('');
  const [companyCurrency, setCompanyCurrency] = useState('TRY');

  // Helper function to get currency symbol
  const getCurrencySymbol = (currencyCode: string) => {
    const symbols: Record<string, string> = {
      TRY: '₺',
      USD: '$',
      EUR: '€',
      GBP: '£',
    };
    return symbols[currencyCode.toUpperCase()] || '₺';
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);

      // Get company ID and currency from profile and company
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!profileData?.company_id) {
        throw new Error('Company not found');
      }

      // Load company currency
      const { data: companyData } = await supabase
        .from('companies')
        .select('currency')
        .eq('id', profileData.company_id)
        .single();

      if (companyData?.currency) {
        setCompanyCurrency(companyData.currency);
      }

      const { data: materialsData, error: materialsError } = await supabase
        .from('company_materials')
        .select('*')
        .eq('company_id', profileData.company_id)
        .eq('is_active', true)
        .order('name');

      if (materialsError) throw materialsError;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const materialsWithSales: Material[] = await Promise.all((materialsData || []).map(async (material) => {
        const { data: salesItems, error: salesError } = await supabase
          .from('paid_material_sale_items')
          .select(`
            quantity,
            total_price,
            paid_material_sales(sale_date)
          `)
          .eq('product_id', material.id)
          .gte('paid_material_sales.sale_date', startOfMonth.split('T')[0])
          .lte('paid_material_sales.sale_date', endOfMonth.split('T')[0]);

        if (salesError) {
          console.error(`Error loading sales for material ${material.name}:`, salesError);
          return {
            ...material,
            currentMonthSalesQuantity: 0,
            currentMonthSalesRevenue: 0,
          };
        }

        const currentMonthSalesQuantity = (salesItems || []).reduce((sum, item) => sum + item.quantity, 0);
        const currentMonthSalesRevenue = (salesItems || []).reduce((sum, item) => sum + item.total_price, 0);

        return {
          ...material,
          currentMonthSalesQuantity,
          currentMonthSalesRevenue,
        };
      }));

      setMaterials(materialsWithSales);
    } catch (error: any) {
      // Alert çeviri ile güncellendi
      Alert.alert(t('error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrice = (material: Material) => {
    setEditingMaterial(material);
    setPrice(material.price?.toString() || '');
    setShowModal(true);
  };

  const handleSavePrice = async () => {
    if (!price) {
      // Alert çeviri ile güncellendi
      Alert.alert(t('error'), t('pleaseEnterPrice'));
      return;
    }

    const priceValue = parseFloat(price.replace(',', '.')); // Virgül ve nokta ayrımı desteği
    if (isNaN(priceValue) || priceValue < 0) {
      // Alert çeviri ile güncellendi
      Alert.alert(t('error'), t('enterValidPrice'));
      return;
    }

    if (!editingMaterial) return;

    try {
      const { error } = await supabase
        .from('company_materials')
        .update({
          price: priceValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingMaterial.id);

      if (error) throw error;

      // Alert çeviri ile güncellendi
      Alert.alert(t('success'), t('priceUpdatedSuccess'));
      handleCloseModal();
      loadMaterials();
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMaterial(null);
    setPrice('');
  };

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalProducts = filteredMaterials.length;
  const totalValue = filteredMaterials.reduce((sum, m) => sum + (m.price || 0), 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          {/* Çeviri kullanıldı: loading */}
          <ActivityIndicator size="large" color="#4caf50" />
          <Text>{t('loading')}...</Text>
        </View>
      </View>
    );
  }

  // Kur birimini kullanarak formatlama fonksiyonu
  const formatPrice = (p: number | null) => {
    if (p === null) return t('priceNotSet');
    // Kuruş hassasiyeti için toFixed(2) ve dinamik para birimi sembolü
    return `${getCurrencySymbol(companyCurrency)}${p.toFixed(2)}`;
  };

  if (isDesktop) {
    return (
      <DesktopLayout>
        <ScrollView style={styles.desktopContainer} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.desktopHeader}>
            <Text style={styles.desktopTitle}>{t('paidProducts')}</Text>
            <TouchableOpacity onPress={() => router.push('/company/definitions')} style={styles.desktopActionButton}>
              <Package size={20} color="#fff" />
              <Text style={styles.desktopActionText}>{t('goToDefinitions')}</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.desktopStatsContainer}>
            <View style={styles.desktopStatCard}>
              <View style={styles.statIconContainer}>
                <Package size={32} color="#4caf50" />
              </View>
              <View>
                <Text style={styles.desktopStatNumber}>{totalProducts}</Text>
                <Text style={styles.desktopStatLabel}>{t('totalProduct')}</Text>
              </View>
            </View>
            <View style={styles.desktopStatCard}>
              <View style={styles.statIconContainer}>
                <DollarSign size={32} color="#2196f3" />
              </View>
              <View>
                <Text style={styles.desktopStatNumber}>{formatPrice(totalValue)}</Text>
                <Text style={styles.desktopStatLabel}>{t('totalValue')}</Text>
              </View>
            </View>
          </View>

          {/* Search */}
          <View style={styles.desktopSearchContainer}>
            <Search size={20} color="#999" />
            <TextInput
              style={styles.desktopSearchInput}
              placeholder={t('productSearch')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Table */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Ürün Adı</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Birim</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Fiyat</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Bu Ay Satış</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Bu Ay Ciro</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'center' }]}>İşlemler</Text>
            </View>
            {filteredMaterials.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{searchQuery ? t('productNotFound') : t('noProductYet')}</Text>
                {!searchQuery && (
                  <TouchableOpacity onPress={() => router.push('/company/definitions')} style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>{t('goToDefinitions')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredMaterials.map((material) => (
                <View key={material.id} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={[styles.tableCellText, { fontWeight: '600' }]}>{material.name}</Text>
                    {material.description && (
                      <Text style={{ fontSize: 12, color: '#999' }}>{material.description}</Text>
                    )}
                  </View>
                  <Text style={[styles.tableCellText, { flex: 1 }]}>{material.unit || t('unitNotFound')}</Text>
                  <Text style={[styles.tableCellText, { flex: 1, fontWeight: 'bold', color: '#4caf50' }]}>
                    {formatPrice(material.price)}
                  </Text>
                  <Text style={[styles.tableCellText, { flex: 1 }]}>{material.currentMonthSalesQuantity} {material.unit}</Text>
                  <Text style={[styles.tableCellText, { flex: 1 }]}>{formatPrice(material.currentMonthSalesRevenue)}</Text>
                  <TouchableOpacity
                    style={{ flex: 0.5, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => handleEditPrice(material)}
                  >
                    <Edit size={18} color="#2196f3" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <Modal visible={showModal} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, styles.desktopModalContent]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('updatePrice')}</Text>
                  <TouchableOpacity onPress={handleCloseModal}>
                    <X size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.materialName}>{editingMaterial?.name}</Text>
                  <Text style={styles.materialUnit}>{editingMaterial?.unit}</Text>

                  <Text style={styles.inputLabel}>{t('priceField').replace('{currency}', companyCurrency)}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={price}
                    onChangeText={setPrice}
                    autoFocus
                  />

                  <Text style={styles.helperText}>
                    {t('priceUsedInfo')}
                  </Text>
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleCloseModal}
                  >
                    <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSavePrice}
                  >
                    <Text style={styles.saveButtonText}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

        </ScrollView>
      </DesktopLayout>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        {/* Çeviri kullanıldı: paidProducts */}
        <Text style={styles.headerTitle}>{t('paidProducts')}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.infoBox}>
        {/* Çeviri kullanıldı: infoBoxMaterial */}
        <Text style={styles.infoText}>
          {t('infoBoxMaterial')}
        </Text>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => router.push('/company/definitions')}
        >
          {/* Çeviri kullanıldı: goToDefinitions */}
          <Text style={styles.infoButtonText}>{t('goToDefinitions')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Package size={24} color="#4caf50" />
          <Text style={styles.statValue}>{totalProducts}</Text>
          {/* Çeviri kullanıldı: totalProduct */}
          <Text style={styles.statLabel}>{t('totalProduct')}</Text>
        </View>

        <View style={styles.statCard}>
          <DollarSign size={24} color="#2196f3" />
          {/* Kur birimi ile formatlama */}
          <Text style={styles.statValue}>{formatPrice(totalValue)}</Text>
          {/* Çeviri kullanıldı: totalValue */}
          <Text style={styles.statLabel}>{t('totalValue')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('productSearch')} // Çeviri kullanıldı: productSearch
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredMaterials.length > 0 ? (
          filteredMaterials.map(material => (
            <View key={material.id} style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{material.name}</Text>
                  {/* Çeviri kullanıldı: unitNotFound */}
                  <Text style={styles.productUnit}>{material.unit || t('unitNotFound')}</Text>
                  {material.description && (
                    // Çeviri kullanıldı: description
                    <Text style={styles.productDescription}>{material.description || t('description')}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditPrice(material)}
                >
                  <Edit size={18} color="#2196f3" />
                </TouchableOpacity>
              </View>

              <View style={styles.productDetails}>
                <View style={styles.priceContainer}>
                  {/* Çeviri kullanıldı: priceLabel */}
                  <Text style={styles.priceLabel}>{t('priceLabel')}</Text>
                  <Text style={styles.priceValue}>
                    {formatPrice(material.price)}
                  </Text>
                </View>
                {/* Yeni eklenen satış bilgileri */}
                <View style={styles.salesInfoContainer}>
                  <Text style={styles.salesLabel}>Bu Ay Satış Miktarı:</Text>
                  <Text style={styles.salesValue}>{material.currentMonthSalesQuantity}</Text>
                </View>
                <View style={styles.salesInfoContainer}>
                  <Text style={styles.salesLabel}>Bu Ay Ciro:</Text>
                  <Text style={styles.salesValue}>{formatPrice(material.currentMonthSalesRevenue)}</Text>
                </View>
              </View>

              {!material.price && (
                <View style={styles.warningBanner}>
                  {/* Çeviri kullanıldı: priceWarning */}
                  <Text style={styles.warningText}>{t('priceWarning')}</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Package size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {/* Çeviri kullanıldı: productNotFound / noProductYet */}
              {searchQuery ? t('productNotFound') : t('noProductYet')}
            </Text>
            {!searchQuery && (
              <>
                {/* Çeviri kullanıldı: startByAddingMaterial */}
                <Text style={styles.emptySubtext}>
                  {t('startByAddingMaterial')}
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/company/definitions')}
                >
                  {/* Çeviri kullanıldı: goToDefinitions */}
                  <Text style={styles.emptyButtonText}>{t('goToDefinitions')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              {/* Çeviri kullanıldı: updatePrice */}
              <Text style={styles.modalTitle}>{t('updatePrice')}</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.materialName}>{editingMaterial?.name}</Text>
              <Text style={styles.materialUnit}>{editingMaterial?.unit}</Text>

              {/* Çeviri kullanıldı: priceField (Dinamik kur birimi ile) */}
              <Text style={styles.inputLabel}>{t('priceField').replace('{currency}', companyCurrency)}</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                autoFocus
              />

              {/* Çeviri kullanıldı: priceUsedInfo */}
              <Text style={styles.helperText}>
                {t('priceUsedInfo')}
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCloseModal}
              >
                {/* Çeviri kullanıldı: cancel */}
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSavePrice}
              >
                {/* Çeviri kullanıldı: save */}
                <Text style={styles.saveButtonText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#4caf50',
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    width: 40,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoText: {
    fontSize: 14,
    color: '#1565c0',
    marginBottom: 8,
  },
  infoButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
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
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  content: {
    flex: 1,
    padding: 16,
  },
  productCard: {
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
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productUnit: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  productDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  editButton: {
    padding: 8,
  },
  productDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, // Added margin
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  salesInfoContainer: { // New style for sales info
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  salesLabel: { // New style for sales label
    fontSize: 13,
    color: '#666',
  },
  salesValue: { // New style for sales value
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  materialName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  materialUnit: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#4caf50',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Desktop Styles
  desktopContainer: {
    padding: 24,
  },
  desktopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  desktopTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  desktopActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  desktopActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  desktopStatsContainer: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  desktopStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  desktopStatLabel: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  desktopSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  desktopSearchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  // Table Styles
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 14,
    color: '#1e293b',
  },
  tableCellText: {
    fontSize: 14,
    color: '#1e293b',
  },
  desktopModalContent: {
    width: 500,
    alignSelf: 'center',
    maxHeight: '80%',
  },
});
