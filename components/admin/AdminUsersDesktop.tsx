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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Edit2, Trash2, Calendar, CheckCircle, XCircle, Plus, Filter, MoreHorizontal, User, Shield, Building, Truck } from 'lucide-react-native';
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

interface Subscription {
    id: string;
    company_id: string;
    status: string;
    trial_ends_at: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
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
    const [subscriptionForm, setSubscriptionForm] = useState({
        status: 'active',
        trial_ends_at: '',
        current_period_end: '',
    });

    useEffect(() => {
        fetchUsers();
    }, []);

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
            const { data: companies } = await supabase
                .from('companies')
                .select('id')
                .eq('owner_id', userId)
                .single();

            if (companies) {
                const { data: subscription } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('company_id', companies.id)
                    .single();

                setSubscriptionData(subscription);
                if (subscription) {
                    setSubscriptionForm({
                        status: subscription.status,
                        trial_ends_at: subscription.trial_ends_at?.split('T')[0] || '',
                        current_period_end: subscription.current_period_end?.split('T')[0] || '',
                    });
                }
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
        if (!subscriptionData) return;

        try {
            const { error } = await supabase
                .from('subscriptions')
                .update({
                    status: subscriptionForm.status,
                    trial_ends_at: subscriptionForm.trial_ends_at,
                    current_period_end: subscriptionForm.current_period_end,
                })
                .eq('id', subscriptionData.id);

            if (error) throw error;

            Alert.alert('Başarılı', 'Abonelik güncellendi');
            setSubscriptionModalVisible(false);
        } catch (error: any) {
            Alert.alert('Hata', error.message);
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
                        <Text style={[styles.columnHeader, { width: 100, textAlign: 'right' }]}>İşlemler</Text>
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

                                    <View style={[styles.cell, { width: 100, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                                        {user.role === 'company' && (
                                            <TouchableOpacity
                                                style={[styles.iconButton, { backgroundColor: '#fff7ed' }]}
                                                onPress={() => handleManageSubscription(user)}
                                            >
                                                <Calendar size={16} color="#f97316" />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.iconButton, { backgroundColor: '#eff6ff' }]}
                                            onPress={() => handleEditUser(user)}
                                        >
                                            <Edit2 size={16} color="#3b82f6" />
                                        </TouchableOpacity>
                                        {user.role !== 'admin' && (
                                            <TouchableOpacity
                                                style={[styles.iconButton, { backgroundColor: '#fef2f2' }]}
                                                onPress={() => deleteUser(user.id, user.email)}
                                            >
                                                <Trash2 size={16} color="#ef4444" />
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
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Abonelik Yönetimi</Text>
                                <TouchableOpacity onPress={() => setSubscriptionModalVisible(false)}>
                                    <XCircle size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                {subscriptionData ? (
                                    <>
                                        <Text style={styles.inputLabel}>Durum</Text>
                                        <View style={styles.statusButtons}>
                                            {['trial', 'active', 'expired', 'cancelled'].map((status) => (
                                                <TouchableOpacity
                                                    key={status}
                                                    style={[
                                                        styles.statusButton,
                                                        subscriptionForm.status === status && styles.statusButtonActive,
                                                    ]}
                                                    onPress={() => setSubscriptionForm({ ...subscriptionForm, status })}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.statusButtonText,
                                                            subscriptionForm.status === status && styles.statusButtonTextActive,
                                                        ]}
                                                    >
                                                        {status}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text style={styles.inputLabel}>Deneme Bitiş Tarihi</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={subscriptionForm.trial_ends_at}
                                            onChangeText={(text) => setSubscriptionForm({ ...subscriptionForm, trial_ends_at: text })}
                                            placeholder="YYYY-MM-DD"
                                        />

                                        <Text style={styles.inputLabel}>Abonelik Bitiş Tarihi</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={subscriptionForm.current_period_end}
                                            onChangeText={(text) =>
                                                setSubscriptionForm({ ...subscriptionForm, current_period_end: text })
                                            }
                                            placeholder="YYYY-MM-DD"
                                        />
                                    </>
                                ) : (
                                    <Text style={styles.noSubscriptionText}>Bu kullanıcının aboneliği bulunmuyor</Text>
                                )}
                            </View>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setSubscriptionModalVisible(false)}
                                >
                                    <Text style={styles.cancelButtonText}>İptal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton]}
                                    onPress={saveSubscriptionChanges}
                                >
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
