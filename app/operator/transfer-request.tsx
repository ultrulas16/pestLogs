import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Package, Clock, CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react-native';
import { PaidProduct } from '@/types/visits';

interface Transfer {
  id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  status: string;
  notes: string;
  product?: PaidProduct;
  from_warehouse?: { name: string };
  to_warehouse?: { name: string };
}

export default function TransferRequest() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<PaidProduct[]>([]);
  const [productStock, setProductStock] = useState<Record<string, number>>({});
  const [operatorWarehouse, setOperatorWarehouse] = useState<any>(null);
  const [adminWarehouse, setAdminWarehouse] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [operatorData, setOperatorData] = useState<any>(null);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadData();
    }
  }, [profile?.id, authLoading]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Operatör bilgisini al
      const { data: operator, error: opError } = await supabase
        .from('operators')
        .select('id, company_id')
        .eq('profile_id', profile?.id)
        .single();

      if (opError || !operator) {
        Alert.alert('Hata', 'Operatör bilgisi bulunamadı');
        setLoading(false);
        return;
      }

      setOperatorData(operator);

      // 2. Şirket ürünlerini yükle
      const { data: productsData } = await supabase
        .from('company_materials')
        .select('*')
        .eq('company_id', operator.company_id)
        .eq('is_active', true)
        .order('name');

      setProducts(productsData || []);

      // 3. Admin deposunu bul (şirketin ana deposu)
      const { data: adminWh } = await supabase
        .from('admin_warehouses')
        .select('*')
        .eq('company_id', operator.company_id)
        .eq('warehouse_type', 'company_main')
        .single();

      if (adminWh) {
        setAdminWarehouse(adminWh);

        // Admin deposundaki stokları yükle
        const { data: stockData } = await supabase
          .from('admin_warehouse_items')
          .select('product_id, quantity')
          .eq('warehouse_id', adminWh.id);

        if (stockData) {
          const stockMap: Record<string, number> = {};
          stockData.forEach((item: any) => {
            stockMap[item.product_id] = item.quantity;
          });
          setProductStock(stockMap);
        }
      }

      // 4. Operatör deposunu bul
      let { data: opWh } = await supabase
        .from('warehouses')
        .select('*')
        .eq('operator_id', operator.id)
        .eq('warehouse_type', 'operator')
        .maybeSingle();

      setOperatorWarehouse(opWh);

      // 5. Transfer taleplerini yükle
      if (opWh) {
        const { data: transfersData } = await supabase
          .from('warehouse_transfers')
          .select('*')
          .eq('to_warehouse_id', opWh.id)
          .order('created_at', { ascending: false });

        // Ürün bilgilerini ayrıca yükle
        if (transfersData && transfersData.length > 0) {
          const productIds = [...new Set(transfersData.map(t => t.product_id))];
          const { data: productsInfo } = await supabase
            .from('company_materials')
            .select('*')
            .in('id', productIds);

          const productMap = new Map(productsInfo?.map(p => [p.id, p]) || []);

          const formattedTransfers = transfersData.map(t => ({
            ...t,
            product: productMap.get(t.product_id),
            from_warehouse: { name: adminWh?.name || 'Ana Depo' },
            to_warehouse: { name: opWh.name }
          }));

          setTransfers(formattedTransfers);
        } else {
          setTransfers([]);
        }
      }

    } catch (error: any) {
      console.error('LoadData error:', error);
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestTransfer = async () => {
    console.log('=== TRANSFER REQUEST STARTED ===');
    console.log('Selected Product:', selectedProduct);
    console.log('Quantity:', quantity);
    console.log('Admin Warehouse:', adminWarehouse);
    console.log('Operator Warehouse:', operatorWarehouse);
    console.log('User ID:', user?.id);

    if (!selectedProduct || !quantity) {
      Alert.alert('Hata', 'Lütfen ürün ve miktar seçin');
      return;
    }

    if (!adminWarehouse) {
      Alert.alert('Hata', 'Ana depo bulunamadı. Lütfen yöneticinizle görüşün.');
      return;
    }

    try {
      let targetWarehouseId = operatorWarehouse?.id;

      // Operatör deposu yoksa oluştur
      if (!targetWarehouseId) {
        console.log('Creating operator warehouse...');
        const { data: newWh, error: whError } = await supabase
          .from('warehouses')
          .insert({
            name: `${profile?.full_name} Deposu`,
            warehouse_type: 'operator',
            company_id: operatorData.company_id,
            operator_id: operatorData.id,
            location: 'Mobil'
          })
          .select('id')
          .single();

        if (whError) {
          console.error('Warehouse creation error:', whError);
          Alert.alert('Depo Hatası', `Depo oluşturulamadı: ${whError.message}`);
          throw whError;
        }

        console.log('New warehouse created:', newWh);
        targetWarehouseId = newWh.id;
        setOperatorWarehouse(newWh);
      }

      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert('Hata', 'Geçerli bir miktar girin');
        return;
      }

      const transferData = {
        from_warehouse_id: adminWarehouse.id,
        to_warehouse_id: targetWarehouseId,
        product_id: selectedProduct,
        quantity: qty,
        status: 'pending',
        notes: notes || '',
        requested_by: user?.id
      };

      console.log('Inserting transfer:', transferData);

      // Transfer talebi oluştur
      const { data: insertedData, error: insertError } = await supabase
        .from('warehouse_transfers')
        .insert(transferData)
        .select();

      if (insertError) {
        console.error('Transfer INSERT error:', insertError);
        Alert.alert(
          'Transfer Hatası',
          `Talep oluşturulamadı:\n\nKod: ${insertError.code}\nMesaj: ${insertError.message}\n\nDetay: ${insertError.details || 'Yok'}`
        );
        throw insertError;
      }

      console.log('Transfer created successfully:', insertedData);
      Alert.alert('Başarılı', 'Transfer talebi oluşturuldu');
      setModalVisible(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('=== TRANSFER REQUEST FAILED ===');
      console.error('Error:', error);
      Alert.alert('Beklenmeyen Hata', error.message || 'Bilinmeyen hata');
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setQuantity('');
    setNotes('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'approved':
      case 'completed': return '#4caf50';
      case 'rejected': return '#ef4444';
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Beklemede';
      case 'approved': return 'Onaylandı';
      case 'completed': return 'Tamamlandı';
      case 'rejected': return 'Reddedildi';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={20} color="#fff" />;
      case 'approved':
      case 'completed': return <CheckCircle size={20} color="#fff" />;
      case 'rejected': return <XCircle size={20} color="#fff" />;
      default: return <Clock size={20} color="#fff" />;
    }
  };

  if (loading || authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transfer Talepleri</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {transfers.map(transfer => (
          <View key={transfer.id} style={styles.transferCard}>
            <View style={styles.transferHeader}>
              <View style={styles.transferInfo}>
                <Text style={styles.productName}>{transfer.product?.name}</Text>
                <Text style={styles.transferDate}>
                  {new Date(transfer.created_at).toLocaleDateString('tr-TR')}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transfer.status) }]}>
                {getStatusIcon(transfer.status)}
                <Text style={styles.statusText}>{getStatusText(transfer.status)}</Text>
              </View>
            </View>

            <View style={styles.transferDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Miktar:</Text>
                <Text style={styles.detailValue}>
                  {transfer.quantity} {transfer.product?.unit}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kaynak:</Text>
                <Text style={styles.detailValue}>{transfer.from_warehouse?.name || 'Ana Depo'}</Text>
              </View>
              {transfer.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.detailLabel}>Not:</Text>
                  <Text style={styles.notesText}>{transfer.notes}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {transfers.length === 0 && (
          <View style={styles.emptyState}>
            <Package size={48} color="#ccc" />
            <Text style={styles.emptyText}>Henüz transfer talebi yok</Text>
            <Text style={styles.emptySubtext}>
              + butonuna tıklayarak talep oluşturun
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Transfer Talebi</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Ürün ({products.length} malzeme)</Text>
              <View style={styles.pickerContainer}>
                {products.length === 0 ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>⚠️ Hiç malzeme bulunamadı.</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {products.map(product => {
                      const stock = productStock[product.id] || 0;
                      return (
                        <TouchableOpacity
                          key={product.id}
                          style={[
                            styles.productChip,
                            selectedProduct === product.id && styles.productChipActive
                          ]}
                          onPress={() => setSelectedProduct(product.id)}
                        >
                          <View>
                            <Text style={[
                              styles.productChipText,
                              selectedProduct === product.id && styles.productChipTextActive
                            ]}>
                              {product.name}
                            </Text>
                            <Text style={[
                              styles.productStockText,
                              selectedProduct === product.id && styles.productChipTextActive
                            ]}>
                              Ana Depo: {stock} {product.unit}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <Text style={styles.inputLabel}>Miktar</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />

              <Text style={styles.inputLabel}>Not (Opsiyonel)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Transfer ile ilgili notlar..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!selectedProduct || !quantity) && styles.submitButtonDisabled
                ]}
                onPress={() => {
                  console.log('BUTTON CLICKED!');
                  console.log('Selected Product:', selectedProduct);
                  console.log('Quantity:', quantity);
                  console.log('Disabled?', !selectedProduct || !quantity);
                  handleRequestTransfer();
                }}
                disabled={!selectedProduct || !quantity}
              >
                <Text style={styles.submitButtonText}>Talep Oluştur</Text>
              </TouchableOpacity>
            </ScrollView>
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
  addButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  transferCard: {
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
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transferInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  transferDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  transferDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  notesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  notesText: {
    fontSize: 13,
    color: '#333',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginBottom: 8,
  },
  warningBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  productChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productChipActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  productChipText: {
    fontSize: 14,
    color: '#333',
  },
  productChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  productStockText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});