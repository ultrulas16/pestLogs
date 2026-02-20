import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, CreditCard, Calendar, Package, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  is_popular: boolean;
};

type CompanySubscription = {
  id: string;
  plan_id: string;
  billing_period: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  start_date: string;
  end_date: string;
  subscription_plans: SubscriptionPlan;
};

export default function SubscriptionPlans() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<CompanySubscription | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get company ID
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user?.id)
        .maybeSingle();

      if (companyError) throw companyError;
      if (!companyData) {
        Alert.alert('Hata', 'Şirket bulunamadı');
        return;
      }

      setCompanyId(companyData.id);

      // Get active subscription plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (plansError) throw plansError;
      setPlans(plansData || []);

      // Get current subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          subscription_plans(*)
        `)
        .eq('company_id', companyData.id)
        .in('status', ['active', 'trial'])
        .maybeSingle();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        throw subscriptionError;
      }

      setCurrentSubscription(subscriptionData as any);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: SubscriptionPlan, billingPeriod: 'monthly' | 'yearly') => {
    if (!companyId) return;

    Alert.alert(
      'Abonelik Seç',
      `${plan.name} paketini ${billingPeriod === 'monthly' ? 'aylık' : 'yıllık'} olarak seçmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Devam Et',
          onPress: async () => {
            try {
              const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
              const endDate = new Date();
              endDate.setMonth(endDate.getMonth() + (billingPeriod === 'monthly' ? 1 : 12));

              const subscriptionData = {
                company_id: companyId,
                plan_id: plan.id,
                billing_period: billingPeriod,
                status: 'active',
                start_date: new Date().toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                amount_paid: price,
                payment_method: 'manual',
                last_payment_date: new Date().toISOString().split('T')[0],
                next_billing_date: endDate.toISOString().split('T')[0],
                created_by: user?.id,
              };

              if (currentSubscription) {
                // Update existing subscription
                const { error } = await supabase
                  .from('company_subscriptions')
                  .update(subscriptionData)
                  .eq('id', currentSubscription.id);

                if (error) throw error;
                Alert.alert('Başarılı', 'Aboneliğiniz güncellendi');
              } else {
                // Create new subscription
                const { error } = await supabase
                  .from('company_subscriptions')
                  .insert([subscriptionData]);

                if (error) throw error;
                Alert.alert('Başarılı', 'Aboneliğiniz oluşturuldu');
              }

              loadData();
            } catch (error: any) {
              console.error('Error creating subscription:', error);
              Alert.alert('Hata', error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Aktif', color: '#10b981' },
      trial: { label: 'Deneme', color: '#3b82f6' },
      cancelled: { label: 'İptal Edildi', color: '#ef4444' },
      expired: { label: 'Süresi Doldu', color: '#f59e0b' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Text style={styles.statusText}>{config.label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#7c3aed', '#6d28d9']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonelik Planları</Text>
        <Text style={styles.headerSubtitle}>İşletmeniz için en uygun planı seçin</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Subscription */}
        {currentSubscription && (
          <View style={styles.currentSubscriptionCard}>
            <View style={styles.currentSubscriptionHeader}>
              <View>
                <Text style={styles.currentSubscriptionTitle}>Mevcut Abonelik</Text>
                <Text style={styles.currentSubscriptionPlan}>
                  {currentSubscription.subscription_plans.name}
                </Text>
              </View>
              {getStatusBadge(currentSubscription.status)}
            </View>

            <View style={styles.subscriptionDetails}>
              <View style={styles.detailRow}>
                <Calendar size={16} color="#666" />
                <Text style={styles.detailText}>
                  Başlangıç: {new Date(currentSubscription.start_date).toLocaleDateString('tr-TR')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Calendar size={16} color="#666" />
                <Text style={styles.detailText}>
                  Bitiş: {new Date(currentSubscription.end_date).toLocaleDateString('tr-TR')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <CreditCard size={16} color="#666" />
                <Text style={styles.detailText}>
                  {currentSubscription.billing_period === 'monthly' ? 'Aylık' : 'Yıllık'} Ödeme
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Available Plans */}
        <Text style={styles.sectionTitle}>Mevcut Paketler</Text>

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
              </View>
              {plan.description && (
                <Text style={styles.planDescription}>{plan.description}</Text>
              )}
            </View>

            <View style={styles.priceRow}>
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>Aylık</Text>
                <Text style={styles.priceValue}>{plan.price_monthly.toFixed(2)} ₺</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => handleSelectPlan(plan, 'monthly')}
                >
                  <Text style={styles.selectButtonText}>Seç</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>Yıllık</Text>
                <Text style={styles.priceValue}>{plan.price_yearly.toFixed(2)} ₺</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => handleSelectPlan(plan, 'yearly')}
                >
                  <Text style={styles.selectButtonText}>Seç</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.limitsSection}>
              <Text style={styles.limitsSectionTitle}>Limitler</Text>
              <View style={styles.limitsGrid}>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{plan.max_users}</Text>
                  <Text style={styles.limitLabel}>Kullanıcı</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{plan.max_operators}</Text>
                  <Text style={styles.limitLabel}>Operatör</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{plan.max_warehouses}</Text>
                  <Text style={styles.limitLabel}>Depo</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{plan.max_branches}</Text>
                  <Text style={styles.limitLabel}>Şube</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{plan.max_customers}</Text>
                  <Text style={styles.limitLabel}>Müşteri</Text>
                </View>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{plan.max_storage_gb} GB</Text>
                  <Text style={styles.limitLabel}>Depolama</Text>
                </View>
              </View>
            </View>

            {plan.features.length > 0 && (
              <View style={styles.featuresSection}>
                <Text style={styles.featuresSectionTitle}>Özellikler</Text>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Check size={16} color="#10b981" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {plans.length === 0 && (
          <View style={styles.emptyState}>
            <AlertCircle size={48} color="#ccc" />
            <Text style={styles.emptyText}>Henüz aktif paket bulunmuyor</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <AlertCircle size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            Abonelik değişiklikleri için lütfen yöneticinizle iletişime geçin.
          </Text>
        </View>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  currentSubscriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  currentSubscriptionTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  currentSubscriptionPlan: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  subscriptionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
    marginBottom: 16,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
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
  planDescription: {
    fontSize: 14,
    color: '#666',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7c3aed',
    marginBottom: 8,
  },
  selectButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  limitsSection: {
    marginBottom: 16,
  },
  limitsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  limitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  limitItem: {
    width: '31%',
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  limitValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  limitLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  featuresSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  featuresSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
});
