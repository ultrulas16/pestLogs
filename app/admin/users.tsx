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
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Edit2, Trash2, Calendar, CreditCard, CheckCircle } from 'lucide-react-native';
import AdminUsersDesktop from '@/components/admin/AdminUsersDesktop';

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

export default function AdminUsersManagement() {
  const router = useRouter();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) {
    return <AdminUsersDesktop />;
  }

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
    plan_id: '' as string | null,
    max_operators: '',
    max_customers: '',
    max_branches: '',
    max_warehouses: '',
  });
  const [savingSubscription, setSavingSubscription] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      router.replace('/');
      return;
    }
    fetchUsers();
    fetchPlans();
  }, [profile]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('id, name, max_operators, max_customers, max_branches, max_warehouses')
      .eq('is_active', true)
      .order('display_order');
    setPlans(data || []);
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
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
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

      Alert.alert('Basarili', 'Kullanici bilgileri guncellendi');
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
      const updatePayload: Record<string, any> = {
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
        const { error } = await supabase
          .from('subscriptions')
          .update(updatePayload)
          .eq('id', subscriptionData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .insert({ ...updatePayload, company_id: selectedUser.id });
        if (error) throw error;
      }

      Alert.alert('Basarili', 'Abonelik guncellendi');
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
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('company_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('subscriptions').update({
          status: 'trial',
          trial_ends_at: trialEnd,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('subscriptions').insert({
          company_id: user.id,
          status: 'trial',
          trial_ends_at: trialEnd,
        });
      }
      Alert.alert('Basarili', '7 gunluk deneme baslandi');
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    Alert.alert(
      'Kullaniciyi Sil',
      `${userEmail} kullanicisini silmek istediginize emin misiniz? Bu islem geri alinamaz.`,
      [
        { text: 'Iptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('profiles').delete().eq('id', userId);
              if (error) throw error;
              Alert.alert('Basarili', 'Kullanici silindi');
              fetchUsers();
            } catch (error: any) {
              Alert.alert('Hata', error.message);
            }
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return '#f44336';
      case 'company': return '#4caf50';
      case 'operator': return '#2196f3';
      case 'customer': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  const selectedPlan = plans.find(p => p.id === subscriptionForm.plan_id);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('manageUsers')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Kullanici ara..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{users.length}</Text>
            <Text style={styles.statLabel}>Toplam Kullanici</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{users.filter((u) => u.role === 'company').length}</Text>
            <Text style={styles.statLabel}>Firma</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{users.filter((u) => u.role === 'operator').length}</Text>
            <Text style={styles.statLabel}>Operator</Text>
          </View>
        </View>

        {filteredUsers.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={styles.userName}>{user.full_name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user.role) }]}>
                  <Text style={styles.roleText}>{user.role}</Text>
                </View>
              </View>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.phone && <Text style={styles.userPhone}>{user.phone}</Text>}
              {user.company_name && <Text style={styles.userCompany}>Firma: {user.company_name}</Text>}
              <Text style={styles.userDate}>
                Kayit: {new Date(user.created_at).toLocaleDateString('tr-TR')}
              </Text>
            </View>

            <View style={styles.userActions}>
              {user.role === 'company' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.trialButton]}
                    onPress={() => activateTrial(user)}
                  >
                    <CheckCircle size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.subscriptionButton]}
                    onPress={() => handleManageSubscription(user)}
                  >
                    <CreditCard size={16} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleEditUser(user)}
              >
                <Edit2 size={16} color="#fff" />
              </TouchableOpacity>
              {user.role !== 'admin' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteUser(user.id, user.email)}
                >
                  <Trash2 size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kullaniciyi Duzenle</Text>

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

            <Text style={styles.inputLabel}>E-posta (degistirilemez)</Text>
            <TextInput style={[styles.input, styles.disabledInput]} value={editForm.email} editable={false} />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Iptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveUserChanges}>
                <Text style={styles.saveButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={subscriptionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Abonelik Yonetimi</Text>
              {selectedUser && (
                <Text style={styles.modalSubtitle}>{selectedUser.full_name}</Text>
              )}

              <Text style={styles.inputLabel}>Durum</Text>
              <View style={styles.statusButtons}>
                {[
                  { value: 'trial', label: 'Deneme', color: '#f59e0b' },
                  { value: 'active', label: 'Aktif', color: '#10b981' },
                  { value: 'expired', label: 'Suresi Doldu', color: '#ef4444' },
                  { value: 'cancelled', label: 'Iptal', color: '#94a3b8' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.statusButton,
                      subscriptionForm.status === s.value && { backgroundColor: s.color, borderColor: s.color },
                    ]}
                    onPress={() => setSubscriptionForm({ ...subscriptionForm, status: s.value })}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        subscriptionForm.status === s.value && styles.statusButtonTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Deneme Bitis Tarihi</Text>
              <TextInput
                style={styles.input}
                value={subscriptionForm.trial_ends_at}
                onChangeText={(text) => setSubscriptionForm({ ...subscriptionForm, trial_ends_at: text })}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.inputLabel}>Abonelik Bitis Tarihi</Text>
              <TextInput
                style={styles.input}
                value={subscriptionForm.current_period_end}
                onChangeText={(text) =>
                  setSubscriptionForm({ ...subscriptionForm, current_period_end: text })
                }
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.sectionLabel}>Plan Sec</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planScroll}>
                <TouchableOpacity
                  style={[styles.planChip, !subscriptionForm.plan_id && styles.planChipActive]}
                  onPress={() => setSubscriptionForm({ ...subscriptionForm, plan_id: null })}
                >
                  <Text style={[styles.planChipText, !subscriptionForm.plan_id && styles.planChipTextActive]}>
                    Deneme
                  </Text>
                </TouchableOpacity>
                {plans.map(plan => (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.planChip, subscriptionForm.plan_id === plan.id && styles.planChipActive]}
                    onPress={() => setSubscriptionForm({ ...subscriptionForm, plan_id: plan.id })}
                  >
                    <Text style={[styles.planChipText, subscriptionForm.plan_id === plan.id && styles.planChipTextActive]}>
                      {plan.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedPlan && (
                <View style={styles.planLimitsPreview}>
                  <Text style={styles.planLimitsTitle}>Plan Limitleri</Text>
                  <View style={styles.planLimitsRow}>
                    <Text style={styles.planLimitItem}>Operator: {selectedPlan.max_operators}</Text>
                    <Text style={styles.planLimitItem}>Musteri: {selectedPlan.max_customers}</Text>
                    <Text style={styles.planLimitItem}>Sube: {selectedPlan.max_branches}</Text>
                    <Text style={styles.planLimitItem}>Depo: {selectedPlan.max_warehouses}</Text>
                  </View>
                </View>
              )}

              <Text style={styles.sectionLabel}>Ozel Limitler (Plani Gecer)</Text>
              <View style={styles.limitsGrid}>
                <View style={styles.limitInputGroup}>
                  <Text style={styles.limitInputLabel}>Operator</Text>
                  <TextInput
                    style={styles.limitInput}
                    value={subscriptionForm.max_operators}
                    onChangeText={(v) => setSubscriptionForm({ ...subscriptionForm, max_operators: v })}
                    keyboardType="numeric"
                    placeholder="Varsayilan"
                  />
                </View>
                <View style={styles.limitInputGroup}>
                  <Text style={styles.limitInputLabel}>Musteri</Text>
                  <TextInput
                    style={styles.limitInput}
                    value={subscriptionForm.max_customers}
                    onChangeText={(v) => setSubscriptionForm({ ...subscriptionForm, max_customers: v })}
                    keyboardType="numeric"
                    placeholder="Varsayilan"
                  />
                </View>
                <View style={styles.limitInputGroup}>
                  <Text style={styles.limitInputLabel}>Sube</Text>
                  <TextInput
                    style={styles.limitInput}
                    value={subscriptionForm.max_branches}
                    onChangeText={(v) => setSubscriptionForm({ ...subscriptionForm, max_branches: v })}
                    keyboardType="numeric"
                    placeholder="Varsayilan"
                  />
                </View>
                <View style={styles.limitInputGroup}>
                  <Text style={styles.limitInputLabel}>Depo</Text>
                  <TextInput
                    style={styles.limitInput}
                    value={subscriptionForm.max_warehouses}
                    onChangeText={(v) => setSubscriptionForm({ ...subscriptionForm, max_warehouses: v })}
                    keyboardType="numeric"
                    placeholder="Varsayilan"
                  />
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setSubscriptionModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Iptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, savingSubscription && styles.saveButtonDisabled]}
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
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#4caf50',
    paddingTop: 44, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    paddingHorizontal: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, fontSize: 16, color: '#333' },
  content: { flex: 1, padding: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#4caf50' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  userCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  userInfo: { flex: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  roleText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  userEmail: { fontSize: 13, color: '#666', marginBottom: 3 },
  userPhone: { fontSize: 13, color: '#666', marginBottom: 3 },
  userCompany: { fontSize: 13, color: '#4caf50', marginBottom: 3, fontWeight: '600' },
  userDate: { fontSize: 11, color: '#999' },
  userActions: { flexDirection: 'column', gap: 6, alignItems: 'center', justifyContent: 'center' },
  actionButton: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  editButton: { backgroundColor: '#2196f3' },
  deleteButton: { backgroundColor: '#f44336' },
  subscriptionButton: { backgroundColor: '#ff9800' },
  trialButton: { backgroundColor: '#10b981' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, alignSelf: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b',
  },
  disabledInput: { backgroundColor: '#f1f5f9', color: '#94a3b8' },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusButton: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  statusButtonText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  statusButtonTextActive: { color: '#fff' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, marginTop: 4 },
  planScroll: { marginBottom: 14 },
  planChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  planChipActive: { backgroundColor: '#4caf50', borderColor: '#4caf50' },
  planChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  planChipTextActive: { color: '#fff' },
  planLimitsPreview: {
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  planLimitsTitle: { fontSize: 12, fontWeight: '700', color: '#15803d', marginBottom: 8 },
  planLimitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planLimitItem: { fontSize: 12, color: '#166534', fontWeight: '500' },
  limitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  limitInputGroup: { width: '47%' },
  limitInputLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  limitInput: {
    backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f1f5f9' },
  saveButton: { backgroundColor: '#4caf50' },
  saveButtonDisabled: { backgroundColor: '#86efac' },
  cancelButtonText: { color: '#475569', fontSize: 15, fontWeight: '700' },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
