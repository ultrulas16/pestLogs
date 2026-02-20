import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Edit2, Trash2, Check, X, Package, Search } from 'lucide-react-native';
import { DesktopLayout } from '../DesktopLayout';

type SubscriptionPlan = {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    price_weekly: number;
    billing_period: string;
    max_users: number;
    max_operators: number;
    max_warehouses: number;
    max_branches: number;
    max_customers: number;
    max_storage_gb: number;
    features: string[];
    is_active: boolean;
    is_popular: boolean;
    is_trial: boolean;
    display_order: number;
};

export default function SubscriptionPlansDesktop() {
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price_monthly: '',
        price_yearly: '',
        price_weekly: '',
        billing_period: 'monthly',
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
            price_weekly: '',
            billing_period: 'monthly',
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
            price_monthly: plan.price_monthly?.toString() || '0',
            price_yearly: plan.price_yearly?.toString() || '0',
            price_weekly: plan.price_weekly?.toString() || '0',
            billing_period: plan.billing_period || 'monthly',
            max_users: plan.max_users?.toString() || '1',
            max_operators: plan.max_operators?.toString() || '1',
            max_warehouses: plan.max_warehouses?.toString() || '1',
            max_branches: plan.max_branches?.toString() || '1',
            max_customers: plan.max_customers?.toString() || '10',
            max_storage_gb: plan.max_storage_gb?.toString() || '1',
            features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
            is_active: plan.is_active,
            is_popular: plan.is_popular,
            display_order: plan.display_order?.toString() || '0',
        });
        setModalVisible(true);
    };

    const getBillingLabel = (period: string) => {
        switch (period) {
            case 'weekly': return 'Haftalık';
            case 'monthly': return 'Aylık';
            case 'yearly': return 'Yıllık';
            case 'trial': return '7 Günlük Deneme';
            default: return period;
        }
    };

    const handleSave = async () => {
        try {
            if (!formData.name) {
                Alert.alert('Hata', 'Lütfen paket adını girin');
                return;
            }

            const planData = {
                name: formData.name,
                description: formData.description,
                price_monthly: parseFloat(formData.price_monthly) || 0,
                price_yearly: parseFloat(formData.price_yearly) || 0,
                price_weekly: parseFloat(formData.price_weekly) || 0,
                billing_period: formData.billing_period || 'monthly',
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

    const handleDelete = async (plan: SubscriptionPlan) => {
        if (plan.is_trial) {
            alert('Deneme planı silinemez');
            return;
        }
        if (Platform.OS === 'web') {
            if (confirm('Bu paketi silmek istediğinizden emin misiniz?')) {
                try {
                    const { error } = await supabase
                        .from('subscription_plans')
                        .delete()
                        .eq('id', plan.id);

                    if (error) throw error;
                    alert('Paket silindi');
                    loadPlans();
                } catch (error: any) {
                    console.error('Error deleting plan:', error);
                    alert(error.message);
                }
            }
        } else {
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
                                    .eq('id', plan.id);

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
        }
    };

    if (loading) {
        return (
            <DesktopLayout>
                <View style={[styles.container, styles.loadingContainer]}>
                    <Text>Yükleniyor...</Text>
                </View>
            </DesktopLayout>
        );
    }

    return (
        <DesktopLayout>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Abonelik Paketleri</Text>
                        <Text style={styles.headerSubtitle}>Sistemdeki abonelik paketlerini yönetin</Text>
                    </View>
                    <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
                        <Plus size={20} color="#fff" />
                        <Text style={styles.addButtonText}>Yeni Paket</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.grid}>
                        {plans.map((plan) => (
                            <View key={plan.id} style={[styles.planCard, plan.is_trial && styles.trialCard]}>
                                <View style={styles.planHeader}>
                                    <View style={styles.planIcon}>
                                        <Package size={24} color="#2563eb" />
                                    </View>
                                    <View style={styles.planActions}>
                                        {plan.is_trial && (
                                            <View style={styles.trialBadge}>
                                                <Text style={styles.trialText}>Deneme</Text>
                                            </View>
                                        )}
                                        {plan.is_popular && !plan.is_trial && (
                                            <View style={styles.popularBadge}>
                                                <Text style={styles.popularText}>Popüler</Text>
                                            </View>
                                        )}
                                        {!plan.is_active && (
                                            <View style={styles.inactiveBadge}>
                                                <Text style={styles.inactiveText}>Pasif</Text>
                                            </View>
                                        )}
                                        <TouchableOpacity onPress={() => openEditModal(plan)} style={styles.actionButton}>
                                            <Edit2 size={18} color="#64748b" />
                                        </TouchableOpacity>
                                        {!plan.is_trial && (
                                            <TouchableOpacity onPress={() => handleDelete(plan)} style={[styles.actionButton, styles.deleteButton]}>
                                                <Trash2 size={18} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <Text style={styles.planName}>{plan.name}</Text>
                                <Text style={styles.planDescription} numberOfLines={2}>
                                    {plan.description}
                                </Text>

                                <View style={styles.billingBadge}>
                                    <Text style={styles.billingBadgeText}>{getBillingLabel(plan.billing_period)}</Text>
                                </View>

                                <View style={styles.divider} />

                                {plan.billing_period === 'weekly' ? (
                                    <View style={styles.priceContainer}>
                                        <View>
                                            <Text style={styles.priceLabel}>Haftalık</Text>
                                            <Text style={styles.priceValue}>{(plan.price_weekly || 0).toFixed(2)} ₺</Text>
                                        </View>
                                    </View>
                                ) : plan.billing_period === 'trial' ? (
                                    <View style={styles.priceContainer}>
                                        <View>
                                            <Text style={styles.priceLabel}>Süre</Text>
                                            <Text style={styles.priceValue}>7 Gün Ücretsiz</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.priceContainer}>
                                        <View>
                                            <Text style={styles.priceLabel}>Aylık</Text>
                                            <Text style={styles.priceValue}>{(plan.price_monthly || 0).toFixed(2)} ₺</Text>
                                        </View>
                                        <View style={styles.verticalDivider} />
                                        <View>
                                            <Text style={styles.priceLabel}>Yıllık</Text>
                                            <Text style={styles.priceValue}>{(plan.price_yearly || 0).toFixed(2)} ₺</Text>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.divider} />

                                <View style={styles.limitsGrid}>
                                    <View style={styles.limitItem}>
                                        <Text style={styles.limitValue}>{plan.max_operators}</Text>
                                        <Text style={styles.limitLabel}>Operatör</Text>
                                    </View>
                                    <View style={styles.limitItem}>
                                        <Text style={styles.limitValue}>{plan.max_customers}</Text>
                                        <Text style={styles.limitLabel}>Müşteri</Text>
                                    </View>
                                    <View style={styles.limitItem}>
                                        <Text style={styles.limitValue}>{plan.max_branches}</Text>
                                        <Text style={styles.limitLabel}>Şube</Text>
                                    </View>
                                    <View style={styles.limitItem}>
                                        <Text style={styles.limitValue}>{plan.max_warehouses}</Text>
                                        <Text style={styles.limitLabel}>Depo</Text>
                                    </View>
                                </View>

                                {Array.isArray(plan.features) && plan.features.length > 0 && (
                                    <View style={styles.featuresContainer}>
                                        <Text style={styles.featuresTitle}>Özellikler ({plan.features.length})</Text>
                                        <View style={styles.featuresList}>
                                            {plan.features.slice(0, 3).map((feature, index) => (
                                                <View key={index} style={styles.featureItem}>
                                                    <Check size={14} color="#10b981" />
                                                    <Text style={styles.featureText} numberOfLines={1}>{feature}</Text>
                                                </View>
                                            ))}
                                            {plan.features.length > 3 && (
                                                <Text style={styles.moreFeatures}>+ {plan.features.length - 3} daha</Text>
                                            )}
                                        </View>
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
                    </View>
                </ScrollView>

                {/* Create/Edit Modal - Optimized for Desktop */}
                <Modal visible={modalVisible} animationType="fade" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    {editingPlan ? 'Paketi Düzenle' : 'Yeni Paket Oluştur'}
                                </Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <View style={styles.formGrid}>
                                    <View style={[styles.formGroup, styles.colSpan2]}>
                                        <Text style={styles.inputLabel}>Paket Adı *</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.name}
                                            onChangeText={(text) => setFormData({ ...formData, name: text })}
                                            placeholder="Örn: Profesyonel"
                                        />
                                    </View>

                                    <View style={[styles.formGroup, styles.colSpan2]}>
                                        <Text style={styles.inputLabel}>Açıklama</Text>
                                        <TextInput
                                            style={[styles.input, styles.textArea]}
                                            value={formData.description}
                                            onChangeText={(text) => setFormData({ ...formData, description: text })}
                                            placeholder="Paket açıklaması"
                                            multiline
                                            numberOfLines={3}
                                        />
                                    </View>

                                    <Text style={[styles.sectionTitle, styles.colSpan2]}>Faturalandırma Dönemi</Text>
                                    <View style={[styles.colSpan2, styles.periodRow]}>
                                        {['weekly', 'monthly', 'yearly'].map((period) => (
                                            <TouchableOpacity
                                                key={period}
                                                style={[styles.periodChip, formData.billing_period === period && styles.periodChipActive]}
                                                onPress={() => setFormData({ ...formData, billing_period: period })}
                                            >
                                                <Text style={[styles.periodChipText, formData.billing_period === period && styles.periodChipTextActive]}>
                                                    {period === 'weekly' ? 'Haftalık' : period === 'monthly' ? 'Aylık' : 'Yıllık'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Haftalık Fiyat (₺)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.price_weekly}
                                            onChangeText={(text) => setFormData({ ...formData, price_weekly: text })}
                                            placeholder="0.00"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Aylık Fiyat (₺)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.price_monthly}
                                            onChangeText={(text) => setFormData({ ...formData, price_monthly: text })}
                                            placeholder="0.00"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Yıllık Fiyat (₺)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.price_yearly}
                                            onChangeText={(text) => setFormData({ ...formData, price_yearly: text })}
                                            placeholder="0.00"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Depolama (GB)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.max_storage_gb}
                                            onChangeText={(text) => setFormData({ ...formData, max_storage_gb: text })}
                                            placeholder="10"
                                            keyboardType="number-pad"
                                        />
                                    </View>

                                    <Text style={[styles.sectionTitle, styles.colSpan2]}>Limitler</Text>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Max Operatör</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.max_operators}
                                            onChangeText={(text) => setFormData({ ...formData, max_operators: text })}
                                            placeholder="1"
                                            keyboardType="number-pad"
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Max Müşteri</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.max_customers}
                                            onChangeText={(text) => setFormData({ ...formData, max_customers: text })}
                                            placeholder="10"
                                            keyboardType="number-pad"
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Max Şube</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.max_branches}
                                            onChangeText={(text) => setFormData({ ...formData, max_branches: text })}
                                            placeholder="5"
                                            keyboardType="number-pad"
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Max Depo</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.max_warehouses}
                                            onChangeText={(text) => setFormData({ ...formData, max_warehouses: text })}
                                            placeholder="1"
                                            keyboardType="number-pad"
                                        />
                                    </View>

                                    <View style={[styles.formGroup, styles.colSpan2]}>
                                        <Text style={styles.inputLabel}>Özellikler (virgülle ayırın)</Text>
                                        <TextInput
                                            style={[styles.input, styles.textArea]}
                                            value={formData.features}
                                            onChangeText={(text) => setFormData({ ...formData, features: text })}
                                            placeholder="Gelişmiş Raporlama, API Erişimi, Öncelikli Destek"
                                            multiline
                                            numberOfLines={3}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Sıralama</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.display_order}
                                            onChangeText={(text) => setFormData({ ...formData, display_order: text })}
                                            placeholder="0"
                                            keyboardType="number-pad"
                                        />
                                    </View>

                                    <View style={[styles.formGroup, styles.checkboxContainer]}>
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
                                            <Text style={styles.checkboxLabel}>Popüler</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
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
        </DesktopLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
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
        backgroundColor: '#2563eb',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        paddingBottom: 40,
    },
    planCard: {
        width: 320,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    planIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    planActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    deleteButton: {
        backgroundColor: '#fee2e2',
    },
    trialCard: {
        borderColor: '#f97316',
        borderWidth: 2,
    },
    trialBadge: {
        backgroundColor: '#f97316',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 4,
    },
    trialText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    popularBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 4,
    },
    popularText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    inactiveBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 4,
    },
    inactiveText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    billingBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginBottom: 12,
    },
    billingBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#2563eb',
    },
    periodRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    periodChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    periodChipActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    periodChipText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    periodChipTextActive: {
        color: '#fff',
    },
    planName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    planDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 16,
        height: 40,
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 16,
    },
    verticalDivider: {
        width: 1,
        backgroundColor: '#e2e8f0',
        height: '100%',
    },
    priceContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    priceValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2563eb',
    },
    limitsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    limitItem: {
        alignItems: 'center',
    },
    limitValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    limitLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    featuresContainer: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
    },
    featuresTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    featuresList: {
        gap: 6,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 13,
        color: '#334155',
        flex: 1,
    },
    moreFeatures: {
        fontSize: 12,
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: 4,
    },
    emptyState: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    },
    emptyText: {
        fontSize: 18,
        color: '#94a3b8',
        marginVertical: 16,
    },
    createButton: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#fff',
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
        width: 600,
        maxHeight: '90%',
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 5,
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
    closeButton: {
        padding: 4,
    },
    modalBody: {
        padding: 24,
    },
    formGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    formGroup: {
        width: '48%', // Approx 2 columns
        flexGrow: 1,
    },
    colSpan2: {
        width: '100%',
    },
    checkboxContainer: {
        flexDirection: 'row',
        gap: 24,
        marginTop: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#334155',
        marginBottom: 6,
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
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 16,
        marginBottom: 8,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        cursor: 'pointer',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    checkboxChecked: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#334155',
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
        backgroundColor: '#2563eb',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '500',
    },
});
