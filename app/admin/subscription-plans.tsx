import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, TextInput, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Edit2, Trash2, Check, X, Package } from 'lucide-react-native';
import SubscriptionPlansDesktop from '@/components/admin/SubscriptionPlansDesktop';

type SubscriptionPlan = {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    max_users: number;
    max_operators: number;
    max_warehouses: number;
    max_branches: number;
    max_customers: number;
    max_storage_gb: number;
    features: string[];
    is_active: boolean;
    is_popular: boolean;
    display_order: number;
};

export default function SubscriptionPlans() {
    const router = useRouter();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    if (isDesktop) {
        return <SubscriptionPlansDesktop />;
    }

    const [loading, setLoading] = useState(true);


    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price_monthly: '',
        price_yearly: '',
        max_users: '',
        max_operators: '',
        max_warehouses: '',
        max_branches: '',
        max_customers: '',
        max_storage_gb: '',
        features: '',
        is_active: true,
        is_popular: false,
        display_order: '0',
    });

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('subscription_plans')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;
            setPlans(data || []);
        } catch (error: any) {
            console.error('Error loading plans:', error);
            Alert.alert('Hata', error.message);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingPlan(null);
        setFormData({
            name: '',
            description: '',
            price_monthly: '',
            price_yearly: '',
            max_users: '',
            max_operators: '',
            max_warehouses: '',
            max_branches: '',
            max_customers: '',
            max_storage_gb: '',
            features: '',
            is_active: true,
            is_popular: false,
            display_order: '0',
        });
        setModalVisible(true);
    };

    const openEditModal = (plan: SubscriptionPlan) => {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            description: plan.description || '',
            price_monthly: plan.price_monthly.toString(),
            price_yearly: plan.price_yearly.toString(),
            max_users: plan.max_users.toString(),
            max_operators: plan.max_operators.toString(),
            max_warehouses: plan.max_warehouses.toString(),
            max_branches: plan.max_branches.toString(),
            max_customers: plan.max_customers.toString(),
            max_storage_gb: plan.max_storage_gb.toString(),
            features: plan.features.join(', '),
            is_active: plan.is_active,
            is_popular: plan.is_popular,
            display_order: plan.display_order.toString(),
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        try {
            if (!formData.name || !formData.price_monthly || !formData.price_yearly) {
                Alert.alert('Hata', 'Lütfen zorunlu alanları doldurun');
                return;
            }

            const planData = {
                name: formData.name,
                description: formData.description,
                price_monthly: parseFloat(formData.price_monthly),
                price_yearly: parseFloat(formData.price_yearly),
                max_users: parseInt(formData.max_users) || 1,
                max_operators: parseInt(formData.max_operators) || 1,
                max_warehouses: parseInt(formData.max_warehouses) || 1,
                max_branches: parseInt(formData.max_branches) || 1,
                max_customers: parseInt(formData.max_customers) || 10,
                max_storage_gb: parseInt(formData.max_storage_gb) || 1,
                features: formData.features.split(',').map(f => f.trim()).filter(f => f),
                is_active: formData.is_active,
                is_popular: formData.is_popular,
                display_order: parseInt(formData.display_order) || 0,
            };

            if (editingPlan) {
                const { error } = await supabase
                    .from('subscription_plans')
                    .update(planData)
                    .eq('id', editingPlan.id);

                if (error) throw error;
                Alert.alert('Başarılı', 'Paket güncellendi');
            } else {
                const { error } = await supabase
                    .from('subscription_plans')
                    .insert([planData]);

                if (error) throw error;
                Alert.alert('Başarılı', 'Paket oluşturuldu');
            }

            setModalVisible(false);
            loadPlans();
        } catch (error: any) {
            console.error('Error saving plan:', error);
            Alert.alert('Hata', error.message);
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert(
            'Paketi Sil',
            'Bu paketi silmek istediğinizden emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('subscription_plans')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;
                            Alert.alert('Başarılı', 'Paket silindi');
                            loadPlans();
                        } catch (error: any) {
                            console.error('Error deleting plan:', error);
                            Alert.alert('Hata', error.message);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
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
                <Text style={styles.headerTitle}>Abonelik Paketleri</Text>
                <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {plans.map((plan) => (
                    <View key={plan.id} style={styles.planCard}>
                        <View style={styles.planHeader}>
                            <View style={styles.planTitleRow}>
                                <Package size={20} color="#7c3aed" />
                                <Text style={styles.planName}>{plan.name}</Text>
                                {plan.is_popular && (
                                    <View style={styles.popularBadge}>
                                        <Text style={styles.popularText}>Popüler</Text>
                                    </View>
                                )}
                                {!plan.is_active && (
                                    <View style={styles.inactiveBadge}>
                                        <Text style={styles.inactiveText}>Pasif</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.planActions}>
                                <TouchableOpacity onPress={() => openEditModal(plan)} style={styles.actionButton}>
                                    <Edit2 size={18} color="#3b82f6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(plan.id)} style={styles.actionButton}>
                                    <Trash2 size={18} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {plan.description && (
                            <Text style={styles.planDescription}>{plan.description}</Text>
                        )}

                        <View style={styles.priceRow}>
                            <View style={styles.priceBox}>
                                <Text style={styles.priceLabel}>Aylık</Text>
                                <Text style={styles.priceValue}>{plan.price_monthly.toFixed(2)} ₺</Text>
                            </View>
                            <View style={styles.priceBox}>
                                <Text style={styles.priceLabel}>Yıllık</Text>
                                <Text style={styles.priceValue}>{plan.price_yearly.toFixed(2)} ₺</Text>
                            </View>
                        </View>

                        <View style={styles.limitsGrid}>
                            <View style={styles.limitItem}>
                                <Text style={styles.limitLabel}>Kullanıcı</Text>
                                <Text style={styles.limitValue}>{plan.max_users}</Text>
                            </View>
                            <View style={styles.limitItem}>
                                <Text style={styles.limitLabel}>Operatör</Text>
                                <Text style={styles.limitValue}>{plan.max_operators}</Text>
                            </View>
                            <View style={styles.limitItem}>
                                <Text style={styles.limitLabel}>Depo</Text>
                                <Text style={styles.limitValue}>{plan.max_warehouses}</Text>
                            </View>
                            <View style={styles.limitItem}>
                                <Text style={styles.limitLabel}>Şube</Text>
                                <Text style={styles.limitValue}>{plan.max_branches}</Text>
                            </View>
                            <View style={styles.limitItem}>
                                <Text style={styles.limitLabel}>Müşteri</Text>
                                <Text style={styles.limitValue}>{plan.max_customers}</Text>
                            </View>
                            <View style={styles.limitItem}>
                                <Text style={styles.limitLabel}>Depolama</Text>
                                <Text style={styles.limitValue}>{plan.max_storage_gb} GB</Text>
                            </View>
                        </View>

                        {plan.features.length > 0 && (
                            <View style={styles.featuresSection}>
                                <Text style={styles.featuresTitle}>Özellikler:</Text>
                                {plan.features.map((feature, index) => (
                                    <View key={index} style={styles.featureItem}>
                                        <Check size={14} color="#10b981" />
                                        <Text style={styles.featureText}>{feature}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ))}

                {plans.length === 0 && (
                    <View style={styles.emptyState}>
                        <Package size={48} color="#ccc" />
                        <Text style={styles.emptyText}>Henüz paket oluşturulmamış</Text>
                        <TouchableOpacity onPress={openCreateModal} style={styles.createButton}>
                            <Text style={styles.createButtonText}>İlk Paketi Oluştur</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Create/Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingPlan ? 'Paketi Düzenle' : 'Yeni Paket Oluştur'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Paket Adı *</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                                placeholder="Örn: Profesyonel"
                            />

                            <Text style={styles.inputLabel}>Açıklama</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.description}
                                onChangeText={(text) => setFormData({ ...formData, description: text })}
                                placeholder="Paket açıklaması"
                                multiline
                                numberOfLines={3}
                            />

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Aylık Fiyat (₺) *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.price_monthly}
                                        onChangeText={(text) => setFormData({ ...formData, price_monthly: text })}
                                        placeholder="99.00"
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Yıllık Fiyat (₺) *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.price_yearly}
                                        onChangeText={(text) => setFormData({ ...formData, price_yearly: text })}
                                        placeholder="990.00"
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>Limitler</Text>

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Max Kullanıcı</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.max_users}
                                        onChangeText={(text) => setFormData({ ...formData, max_users: text })}
                                        placeholder="10"
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Max Operatör</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.max_operators}
                                        onChangeText={(text) => setFormData({ ...formData, max_operators: text })}
                                        placeholder="5"
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Max Depo</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.max_warehouses}
                                        onChangeText={(text) => setFormData({ ...formData, max_warehouses: text })}
                                        placeholder="3"
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Max Şube</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.max_branches}
                                        onChangeText={(text) => setFormData({ ...formData, max_branches: text })}
                                        placeholder="10"
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Max Müşteri</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.max_customers}
                                        onChangeText={(text) => setFormData({ ...formData, max_customers: text })}
                                        placeholder="200"
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Depolama (GB)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.max_storage_gb}
                                        onChangeText={(text) => setFormData({ ...formData, max_storage_gb: text })}
                                        placeholder="20"
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Özellikler (virgülle ayırın)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.features}
                                onChangeText={(text) => setFormData({ ...formData, features: text })}
                                placeholder="Gelişmiş Raporlama, API Erişimi, Öncelikli Destek"
                                multiline
                                numberOfLines={3}
                            />

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Sıralama</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.display_order}
                                        onChangeText={(text) => setFormData({ ...formData, display_order: text })}
                                        placeholder="0"
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                            >
                                <View style={[styles.checkbox, formData.is_active && styles.checkboxChecked]}>
                                    {formData.is_active && <Check size={16} color="#fff" />}
                                </View>
                                <Text style={styles.checkboxLabel}>Aktif</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setFormData({ ...formData, is_popular: !formData.is_popular })}
                            >
                                <View style={[styles.checkbox, formData.is_popular && styles.checkboxChecked]}>
                                    {formData.is_popular && <Check size={16} color="#fff" />}
                                </View>
                                <Text style={styles.checkboxLabel}>Popüler olarak işaretle</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Kaydet</Text>
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
        backgroundColor: '#7c3aed',
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
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    planCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    planTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    planName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    popularBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    popularText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
    },
    inactiveBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    inactiveText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
    },
    planActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 4,
    },
    planDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    priceRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    priceBox: {
        flex: 1,
        backgroundColor: '#f9fafb',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    priceValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#7c3aed',
    },
    limitsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    limitItem: {
        width: '31%',
        backgroundColor: '#f9fafb',
        padding: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    limitLabel: {
        fontSize: 10,
        color: '#666',
        marginBottom: 2,
    },
    limitValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    featuresSection: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    featuresTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    featureText: {
        fontSize: 12,
        color: '#333',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        marginBottom: 24,
        fontSize: 16,
        color: '#999',
    },
    createButton: {
        backgroundColor: '#7c3aed',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    modalBody: {
        padding: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#333',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
        marginBottom: 8,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#d1d5db',
        borderRadius: 4,
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#7c3aed',
        borderColor: '#7c3aed',
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#333',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#7c3aed',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
