import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Edit2, Trash2, Calendar, CheckCircle, XCircle, Plus, Filter, MoreHorizontal, User, Shield, Building, Truck, CreditCard } from 'lucide-react-native';
import { DesktopLayout } from '../DesktopLayout';

interface Profile {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: string;
    company_name: string | null;
    created_at: string;
}

interface SubscriptionPlan {
    id: string;
    name: string;
    billing_period: string;
    price_weekly: number;
    price_monthly: number;
    price_yearly: number;
    max_operators: number;
    max_customers: number;
    max_branches: number;
    max_warehouses: number;
}

interface Subscription {
    id: string;
    company_id: string;
    status: string;
    trial_ends_at: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    plan_id: string | null;
    max_operators: number | null;
    max_customers: number | null;
    max_branches: number | null;
    max_warehouses: number | null;
}

export default function AdminUsersDesktop() {
    const router = useRouter();
    const { t } = useLanguage();
    const { profile } = useAuth();
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
    const [editForm, setEditForm] = useState({ full_name: '', phone: '', email: '' });
    const [subscriptionData, setSubscriptionData] = useState<Subscription | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [subscriptionForm, setSubscriptionForm] = useState({
        status: 'trial',
        trial_ends_at: '',
        current_period_end: '',
        plan_id: null as string | null,
        max_operators: '',
        max_customers: '',
        max_branches: '',
        max_warehouses: '',
    });
    const [savingSubscription, setSavingSubscription] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        const { data } = await supabase
            .from('subscription_plans')
            .select('id, name, billing_period, price_weekly, price_monthly, price_yearly, max_operators, max_customers, max_branches, max_warehouses')
            .eq('is_active', true)
            .eq('is_trial', false)
            .order('display_order');
        setPlans(data || []);
    };

    const computePeriodEnd = (plan: SubscriptionPlan | null): string => {
        const now = new Date();
        if (!plan) {
            now.setDate(now.getDate() + 7);
            return now.toISOString().split('T')[0];
        }
        switch (plan.billing_period) {
            case 'weekly':
                now.setDate(now.getDate() + 7);
                break;
            case 'yearly':
                now.setFullYear(now.getFullYear() + 1);
                break;
            default:
                now.setMonth(now.getMonth() + 1);
        }
        return now.toISOString().split('T')[0];
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error: any) {
            Alert.alert('Hata', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubscription = async (userId: string) => {
        try {
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('company_id', userId)
                .maybeSingle();

            setSubscriptionData(subscription);
            if (subscription) {
                setSubscriptionForm({
                    status: subscription.status,
                    trial_ends_at: subscription.trial_ends_at?.split('T')[0] || '',
                    current_period_end: subscription.current_period_end?.split('T')[0] || '',
                    plan_id: subscription.plan_id || null,
                    max_operators: subscription.max_operators?.toString() || '',
                    max_customers: subscription.max_customers?.toString() || '',
                    max_branches: subscription.max_branches?.toString() || '',
                    max_warehouses: subscription.max_warehouses?.toString() || '',
                });
            } else {
                setSubscriptionForm({
                    status: 'trial',
                    trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                    current_period_end: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                    plan_id: null,
                    max_operators: '',
                    max_customers: '',
                    max_branches: '',
                    max_warehouses: '',
                });
            }
        } catch (error: any) {
            console.error('Subscription fetch error:', error);
        }
    };

    const handleEditUser = (user: Profile) => {
        setSelectedUser(user);
        setEditForm({
            full_name: user.full_name,
            phone: user.phone || '',
            email: user.email,
        });
        setEditModalVisible(true);
    };

    const handleManageSubscription = async (user: Profile) => {
        setSelectedUser(user);
        await fetchSubscription(user.id);
        setSubscriptionModalVisible(true);
    };

    const saveUserChanges = async () => {
        if (!selectedUser) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                })
                .eq('id', selectedUser.id);

            if (error) throw error;

            Alert.alert('Başarılı', 'Kullanıcı bilgileri güncellendi');
            setEditModalVisible(false);
            fetchUsers();
        } catch (error: any) {
            Alert.alert('Hata', error.message);
        }
    };

    const saveSubscriptionChanges = async () => {
        if (!selectedUser) return;
        setSavingSubscription(true);
        try {
            const payload: Record<string, any> = {
                status: subscriptionForm.status,
                trial_ends_at: subscriptionForm.trial_ends_at || null,
                current_period_end: subscriptionForm.current_period_end || null,
                plan_id: subscriptionForm.plan_id || null,
                max_operators: subscriptionForm.max_operators ? parseInt(subscriptionForm.max_operators) : null,
                max_customers: subscriptionForm.max_customers ? parseInt(subscriptionForm.max_customers) : null,
                max_branches: subscriptionForm.max_branches ? parseInt(subscriptionForm.max_branches) : null,
                max_warehouses: subscriptionForm.max_warehouses ? parseInt(subscriptionForm.max_warehouses) : null,
                updated_at: new Date().toISOString(),
            };

            if (subscriptionData) {
                const { error } = await supabase.from('subscriptions').update(payload).eq('id', subscriptionData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('subscriptions').insert({ ...payload, company_id: selectedUser.id });
                if (error) throw error;
            }

            Alert.alert('Başarılı', 'Abonelik güncellendi');
            setSubscriptionModalVisible(false);
        } catch (error: any) {
            Alert.alert('Hata', error.message);
        } finally {
            setSavingSubscription(false);
        }
    };

    const activateTrial = async (user: Profile) => {
        try {
            const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
            const { data: existing } = await supabase.from('subscriptions').select('id').eq('company_id', user.id).maybeSingle();
            if (existing) {
                await supabase.from('subscriptions').update({ status: 'trial', trial_ends_at: trialEnd, updated_at: new Date().toISOString() }).eq('id', existing.id);
            } else {
                await supabase.from('subscriptions').insert({ company_id: user.id, status: 'trial', trial_ends_at: trialEnd });
            }
            alert('7 günlük deneme başlatıldı');
            fetchUsers();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const deleteUser = async (userId: string, userEmail: string) => {
        // Web platform confirmation
        if (confirm(`${userEmail} kullanıcısını silmek istediğinize emin misiniz?`)) {
            try {
                const { error } = await supabase.from('profiles').delete().eq('id', userId);
                if (error) throw error;
                fetchUsers();
            } catch (error: any) {
                alert(error.message);
            }
        }
    };

    const filteredUsers = users.filter((user) => {
        const matchesSearch =
            user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = roleFilter === 'all' || user.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return { bg: '#fee2e2', text: '#ef4444', label: 'Admin', icon: Shield };
            case 'company':
                return { bg: '#dcfce7', text: '#16a34a', label: 'Firma', icon: Building };
            case 'operator':
                return { bg: '#e0f2fe', text: '#0ea5e9', label: 'Operatör', icon: Truck };
            case 'customer':
                return { bg: '#ffedd5', text: '#f97316', label: 'Müşteri', icon: User };
            default:
                return { bg: '#f1f5f9', text: '#64748b', label: role, icon: User };
        }
    };

    if (loading) {
        return (
            <DesktopLayout>
                <View style={styles.loadingContainer}>
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
                        <Text style={styles.headerTitle}>{t('manageUsers')}</Text>
                        <Text style={styles.headerSubtitle}>Sistemdeki tüm kullanıcıları yönetin</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <View style={styles.searchContainer}>
                            <Search size={20} color="#94a3b8" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="İsim, e-posta veya firma ara..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>
                </View>

                {/* Filter Tabs */}
                <View style={styles.filterTabs}>
                    {['all', 'company', 'operator', 'customer', 'admin'].map(role => (
                        <TouchableOpacity
                            key={role}
                            style={[styles.filterTab, roleFilter === role && styles.filterTabActive]}
                            onPress={() => setRoleFilter(role)}
                        >
                            <Text style={[styles.filterTabText, roleFilter === role && styles.filterTabTextActive]}>
                                {role === 'all' ? 'Tümü' : role.charAt(0).toUpperCase() + role.slice(1)}
                            </Text>
                            {roleFilter === role && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Users Table */}
                <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.columnHeader, { flex: 2 }]}>Kullanıcı</Text>
                        <Text style={[styles.columnHeader, { flex: 1 }]}>Rol</Text>
                        <Text style={[styles.columnHeader, { flex: 1.5 }]}>İletişim</Text>
                        <Text style={[styles.columnHeader, { flex: 1 }]}>Kayıt Tarihi</Text>
                        <Text style={[styles.columnHeader, { width: 130, textAlign: 'right' }]}>İşlemler</Text>
                    </View>

                    <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
                        {filteredUsers.map((user) => {
                            const roleBadge = getRoleBadge(user.role);
                            const RoleIcon = roleBadge.icon;
                            return (
                                <View key={user.id} style={styles.tableRow}>
                                    <View style={[styles.cell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>{user.full_name?.charAt(0) || 'U'}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.cellTextBold}>{user.full_name}</Text>
                                            {user.company_name && (
                                                <Text style={styles.cellSubtext}>{user.company_name}</Text>
                                            )}
                                        </View>
                                    </View>

                                    <View style={[styles.cell, { flex: 1 }]}>
                                        <View style={[styles.badge, { backgroundColor: roleBadge.bg }]}>
                                            <RoleIcon size={12} color={roleBadge.text} style={{ marginRight: 4 }} />
                                            <Text style={[styles.badgeText, { color: roleBadge.text }]}>{roleBadge.label}</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.cell, { flex: 1.5 }]}>
                                        <Text style={styles.cellText}>{user.email}</Text>
                                        {user.phone && <Text style={styles.cellSubtext}>{user.phone}</Text>}
                                    </View>

                                    <View style={[styles.cell, { flex: 1 }]}>
                                        <Text style={styles.cellText}>{new Date(user.created_at).toLocaleDateString('tr-TR')}</Text>
                                    </View>

                                    <View style={[styles.cell, { width: 130, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }]}>
                                        {user.role === 'company' && (
                                            <>
                                                <TouchableOpacity
                                                    style={[styles.iconButton, { backgroundColor: '#f0fdf4' }]}
                                                    onPress={() => activateTrial(user)}
                                                    title="7 Gün Deneme"
                                                >
                                                    <CheckCircle size={15} color="#10b981" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.iconButton, { backgroundColor: '#fff7ed' }]}
                                                    onPress={() => handleManageSubscription(user)}
                                                >
                                                    <CreditCard size={15} color="#f97316" />
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.iconButton, { backgroundColor: '#eff6ff' }]}
                                            onPress={() => handleEditUser(user)}
                                        >
                                            <Edit2 size={15} color="#3b82f6" />
                                        </TouchableOpacity>
                                        {user.role !== 'admin' && (
                                            <TouchableOpacity
                                                style={[styles.iconButton, { backgroundColor: '#fef2f2' }]}
                                                onPress={() => deleteUser(user.id, user.email)}
                                            >
                                                <Trash2 size={15} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Edit Modal */}
                <Modal visible={editModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Kullanıcıyı Düzenle</Text>
                                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                    <XCircle size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <Text style={styles.inputLabel}>Ad Soyad</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editForm.full_name}
                                    onChangeText={(text) => setEditForm({ ...editForm, full_name: text })}
                                />

                                <Text style={styles.inputLabel}>Telefon</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editForm.phone}
                                    onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                                    keyboardType="phone-pad"
                                />

                                <Text style={styles.inputLabel}>E-posta</Text>
                                <TextInput
                                    style={[styles.input, styles.disabledInput]}
                                    value={editForm.email}
                                    editable={false}
                                />
                            </View>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setEditModalVisible(false)}
                                >
                                    <Text style={styles.cancelButtonText}>İptal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveUserChanges}>
                                    <Text style={styles.saveButtonText}>Kaydet</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Subscription Modal */}
                <Modal visible={subscriptionModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { width: 620, maxHeight: '90%' }]}>
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Abonelik Yönetimi</Text>
                                    {selectedUser && (
                                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{selectedUser.full_name} — {selectedUser.email}</Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setSubscriptionModalVisible(false)}>
                                    <XCircle size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <Text style={styles.inputLabel}>Durum</Text>
                                <View style={styles.statusButtons}>
                                    {[
                                        { value: 'trial', label: 'Deneme', color: '#f59e0b' },
                                        { value: 'active', label: 'Aktif', color: '#10b981' },
                                        { value: 'expired', label: 'Süresi Doldu', color: '#ef4444' },
                                        { value: 'cancelled', label: 'İptal', color: '#94a3b8' },
                                    ].map((s) => (
                                        <TouchableOpacity
                                            key={s.value}
                                            style={[
                                                styles.statusButton,
                                                subscriptionForm.status === s.value && { backgroundColor: s.color, borderColor: s.color },
                                            ]}
                                            onPress={() => setSubscriptionForm({ ...subscriptionForm, status: s.value })}
                                        >
                                            <Text style={[styles.statusButtonText, subscriptionForm.status === s.value && styles.statusButtonTextActive]}>
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.subSection}>
                                    <Text style={styles.subSectionTitle}>Plan Seç</Text>
                                    <View style={styles.planGrid}>
                                        <TouchableOpacity
                                            style={[styles.planCard, !subscriptionForm.plan_id && styles.planCardActive]}
                                            onPress={() => {
                                                const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
                                                setSubscriptionForm({ ...subscriptionForm, plan_id: null, current_period_end: trialEnd, trial_ends_at: trialEnd });
                                            }}
                                        >
                                            <Text style={[styles.planCardName, !subscriptionForm.plan_id && styles.planCardNameActive]}>Deneme</Text>
                                            <Text style={[styles.planCardPeriod, !subscriptionForm.plan_id && { color: '#fff' }]}>7 Gün Ücretsiz</Text>
                                        </TouchableOpacity>
                                        {plans.map(plan => (
                                            <TouchableOpacity
                                                key={plan.id}
                                                style={[styles.planCard, subscriptionForm.plan_id === plan.id && styles.planCardActive]}
                                                onPress={() => {
                                                    const endDate = computePeriodEnd(plan);
                                                    setSubscriptionForm({ ...subscriptionForm, plan_id: plan.id, current_period_end: endDate });
                                                }}
                                            >
                                                <Text style={[styles.planCardName, subscriptionForm.plan_id === plan.id && styles.planCardNameActive]}>{plan.name}</Text>
                                                <Text style={[styles.planCardPeriod, subscriptionForm.plan_id === plan.id && { color: '#fff' }]}>
                                                    {plan.billing_period === 'weekly'
                                                        ? `${plan.price_weekly.toFixed(2)} ₺/Hf`
                                                        : plan.billing_period === 'yearly'
                                                        ? `${plan.price_yearly.toFixed(2)} ₺/Yıl`
                                                        : `${plan.price_monthly.toFixed(2)} ₺/Ay`}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {subscriptionForm.plan_id && (() => {
                                        const p = plans.find(pl => pl.id === subscriptionForm.plan_id);
                                        if (!p) return null;
                                        return (
                                            <View style={styles.planLimitsBox}>
                                                <Text style={styles.planLimitsTitle}>Plan Varsayılan Limitleri</Text>
                                                <View style={styles.planLimitsRow}>
                                                    {[
                                                        { label: 'Operatör', value: p.max_operators },
                                                        { label: 'Müşteri', value: p.max_customers },
                                                        { label: 'Şube', value: p.max_branches },
                                                        { label: 'Depo', value: p.max_warehouses },
                                                    ].map(item => (
                                                        <View key={item.label} style={styles.planLimitChip}>
                                                            <Text style={styles.planLimitNum}>{item.value}</Text>
                                                            <Text style={styles.planLimitLabel}>{item.label}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        );
                                    })()}
                                </View>

                                <View style={styles.subSection}>
                                    <Text style={styles.subSectionTitle}>Tarihler</Text>
                                    <View style={styles.datesRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>Deneme Bitiş</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={subscriptionForm.trial_ends_at}
                                                onChangeText={(t) => setSubscriptionForm({ ...subscriptionForm, trial_ends_at: t })}
                                                placeholder="YYYY-MM-DD"
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>Abonelik Bitiş</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={subscriptionForm.current_period_end}
                                                onChangeText={(t) => setSubscriptionForm({ ...subscriptionForm, current_period_end: t })}
                                                placeholder="YYYY-MM-DD"
                                            />
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.subSection}>
                                    <Text style={styles.subSectionTitle}>Özel Limitler <Text style={{ fontWeight: '400', color: '#94a3b8', fontSize: 12 }}>(boş = plan varsayılanı)</Text></Text>
                                    <View style={styles.limitsGrid}>
                                        {[
                                            { field: 'max_operators' as const, label: 'Operatör' },
                                            { field: 'max_customers' as const, label: 'Müşteri' },
                                            { field: 'max_branches' as const, label: 'Şube' },
                                            { field: 'max_warehouses' as const, label: 'Depo' },
                                        ].map(item => (
                                            <View key={item.field} style={styles.limitInputGroup}>
                                                <Text style={styles.limitInputLabel}>{item.label}</Text>
                                                <TextInput
                                                    style={styles.limitInput}
                                                    value={subscriptionForm[item.field]}
                                                    onChangeText={(v) => setSubscriptionForm({ ...subscriptionForm, [item.field]: v })}
                                                    keyboardType="numeric"
                                                    placeholder="Varsayılan"
                                                />
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setSubscriptionModalVisible(false)}
                                >
                                    <Text style={styles.cancelButtonText}>İptal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton, savingSubscription && { opacity: 0.7 }]}
                                    onPress={saveSubscriptionChanges}
                                    disabled={savingSubscription}
                                >
                                    {savingSubscription
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Text style={styles.saveButtonText}>Kaydet</Text>
                                    }
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
        padding: 32,
        height: '100%',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        width: 300,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 8,
        fontSize: 14,
        color: '#0f172a',
    },
    filterTabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 24,
    },
    filterTab: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        position: 'relative',
    },
    filterTabActive: {
        // 
    },
    filterTabText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    filterTabTextActive: {
        color: '#7c3aed',
        fontWeight: '600',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -1,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#7c3aed',
    },
    tableContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    columnHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    tableBody: {
        flex: 1,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    cell: {
        justifyContent: 'center',
    },
    cellText: {
        fontSize: 14,
        color: '#334155',
    },
    cellTextBold: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    cellSubtext: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    iconButton: {
        width: 32,
        height: 32,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
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
    disabledInput: {
        backgroundColor: '#f1f5f9',
        color: '#94a3b8',
    },
    statusButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    statusButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    statusButtonActive: {
        backgroundColor: '#7c3aed',
        borderColor: '#7c3aed',
    },
    statusButtonText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    statusButtonTextActive: {
        color: '#fff',
    },
    noSubscriptionText: {
        textAlign: 'center',
        color: '#94a3b8',
        paddingVertical: 20,
    },
    subSection: {
        marginBottom: 20,
    },
    subSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 10,
    },
    planGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    planCard: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
        alignItems: 'center',
        minWidth: 90,
    },
    planCardActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    planCardName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    planCardNameActive: {
        color: '#fff',
    },
    planCardPeriod: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    planLimitsBox: {
        backgroundColor: '#f0f9ff',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    planLimitsTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0369a1',
        marginBottom: 8,
    },
    planLimitsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    planLimitChip: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    planLimitNum: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0369a1',
    },
    planLimitLabel: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2,
    },
    datesRow: {
        flexDirection: 'row',
        gap: 12,
    },
    limitsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    limitInputGroup: {
        width: '47%',
    },
    limitInputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 4,
    },
    limitInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 14,
        color: '#0f172a',
        backgroundColor: '#fff',
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
