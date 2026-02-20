import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Mail, Lock, User, Phone, Building, CheckCircle, Users, BarChart3, Shield } from 'lucide-react-native';
import { LanguageSelector } from '@/components/LanguageSelector';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function Register() {
  const router = useRouter();
  const { t } = useLanguage();
  const { signUp, signInWithGoogle } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword || !fullName || !companyName) {
      setError('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (!email.includes('@')) {
      setError('Geçerli bir email adresi girin');
      return;
    }

    if (!acceptedPrivacy || !acceptedTerms) {
      setError('Gizlilik politikasını ve kullanıcı sözleşmesini kabul etmelisiniz');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[REGISTER] Starting registration...');
      await signUp(email, password, {
        email,
        full_name: fullName,
        phone,
        role: 'company',
        company_name: companyName,
      });
      console.log('[REGISTER] Registration successful');
      setSuccess(true);
      setTimeout(() => {
        router.replace('/auth/login');
      }, 2000);
    } catch (err: any) {
      console.error('[REGISTER] Registration error:', err);
      let errorMessage = 'Kayıt başarısız oldu';
      if (err.message?.includes('already registered')) {
        errorMessage = 'Bu email adresi zaten kayıtlı';
      } else if (err.message?.includes('invalid email')) {
        errorMessage = 'Geçersiz email adresi';
      } else if (err.message?.includes('password')) {
        errorMessage = 'Şifre gereksinimleri karşılanmıyor';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!acceptedPrivacy || !acceptedTerms) {
      setError('Gizlilik politikasını ve kullanıcı sözleşmesini kabul etmelisiniz');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[REGISTER] Starting Google OAuth registration...');
      await signInWithGoogle();
    } catch (err: any) {
      console.error('[REGISTER] Google OAuth error:', err);
      setError('Google ile kayıt başarısız oldu. Lütfen tekrar deneyin.');
      setLoading(false);
    }
  };

  if (isDesktop) {
    return (
      <View style={styles.desktopContainer}>
        {/* Left Panel - Branding */}
        <LinearGradient colors={['#10b981', '#059669']} style={styles.desktopBrandingPanel}>
          <View style={styles.desktopBrandingContent}>
            <Text style={styles.desktopLogo}>🐛 Pest360</Text>
            <Text style={styles.desktopTagline}>Professional Pest Control Management</Text>

            <View style={styles.desktopFeatures}>
              <View style={styles.desktopFeature}>
                <BarChart3 size={24} color="#fff" />
                <Text style={styles.desktopFeatureText}>Comprehensive Reporting</Text>
              </View>
              <View style={styles.desktopFeature}>
                <Users size={24} color="#fff" />
                <Text style={styles.desktopFeatureText}>Team Management</Text>
              </View>
              <View style={styles.desktopFeature}>
                <CheckCircle size={24} color="#fff" />
                <Text style={styles.desktopFeatureText}>Mobile & Desktop Access</Text>
              </View>
              <View style={styles.desktopFeature}>
                <Shield size={24} color="#fff" />
                <Text style={styles.desktopFeatureText}>Secure & Reliable</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Right Panel - Register Form */}
        <View style={styles.desktopFormPanel}>
          <ScrollView
            contentContainerStyle={styles.desktopFormScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.desktopFormContainer}>
              <View style={styles.desktopFormHeader}>
                <Text style={styles.desktopFormTitle}>Create Account</Text>
                <Text style={styles.desktopFormSubtitle}>Register your pest control company</Text>
                <View style={styles.desktopLanguageSelector}>
                  <LanguageSelector />
                </View>
              </View>

              {error ? (
                <View style={styles.desktopErrorContainer}>
                  <Text style={styles.desktopErrorText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={styles.desktopSuccessContainer}>
                  <Text style={styles.desktopSuccessText}>Registration successful! Redirecting to login...</Text>
                </View>
              ) : null}

              {/* Two-column layout for inputs */}
              <View style={styles.desktopInputRow}>
                <View style={[styles.desktopInputContainer, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.desktopInputLabel}>Full Name *</Text>
                  <View style={styles.desktopInputWrapper}>
                    <User size={20} color="#64748b" style={styles.desktopInputIcon} />
                    <TextInput
                      style={styles.desktopInput}
                      placeholder={t('fullName')}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={[styles.desktopInputContainer, { flex: 1 }]}>
                  <Text style={styles.desktopInputLabel}>Phone</Text>
                  <View style={styles.desktopInputWrapper}>
                    <Phone size={20} color="#64748b" style={styles.desktopInputIcon} />
                    <TextInput
                      style={styles.desktopInput}
                      placeholder={t('phone')}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.desktopInputContainer}>
                <Text style={styles.desktopInputLabel}>Email *</Text>
                <View style={styles.desktopInputWrapper}>
                  <Mail size={20} color="#64748b" style={styles.desktopInputIcon} />
                  <TextInput
                    style={styles.desktopInput}
                    placeholder={t('email')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </View>

              <View style={styles.desktopInputContainer}>
                <Text style={styles.desktopInputLabel}>Company Name *</Text>
                <View style={styles.desktopInputWrapper}>
                  <Building size={20} color="#64748b" style={styles.desktopInputIcon} />
                  <TextInput
                    style={styles.desktopInput}
                    placeholder="Pest Control Company Name"
                    value={companyName}
                    onChangeText={setCompanyName}
                  />
                </View>
              </View>

              <View style={styles.desktopInputRow}>
                <View style={[styles.desktopInputContainer, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.desktopInputLabel}>Password *</Text>
                  <View style={styles.desktopInputWrapper}>
                    <Lock size={20} color="#64748b" style={styles.desktopInputIcon} />
                    <TextInput
                      style={styles.desktopInput}
                      placeholder={t('password')}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={[styles.desktopInputContainer, { flex: 1 }]}>
                  <Text style={styles.desktopInputLabel}>Confirm Password *</Text>
                  <View style={styles.desktopInputWrapper}>
                    <Lock size={20} color="#64748b" style={styles.desktopInputIcon} />
                    <TextInput
                      style={styles.desktopInput}
                      placeholder={t('confirmPassword')}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.desktopLegalContainer}>
                <TouchableOpacity
                  style={styles.desktopCheckboxContainer}
                  onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.desktopCheckbox, acceptedPrivacy && styles.desktopCheckboxChecked]}>
                    {acceptedPrivacy && <Text style={styles.desktopCheckmark}>✓</Text>}
                  </View>
                  <Text style={styles.desktopCheckboxText}>
                    I accept the{' '}
                    <Text style={styles.desktopLinkText} onPress={() => router.push('/legal/privacy-policy')}>
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.desktopCheckboxContainer}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.desktopCheckbox, acceptedTerms && styles.desktopCheckboxChecked]}>
                    {acceptedTerms && <Text style={styles.desktopCheckmark}>✓</Text>}
                  </View>
                  <Text style={styles.desktopCheckboxText}>
                    I accept the{' '}
                    <Text style={styles.desktopLinkText} onPress={() => router.push('/legal/terms-of-service')}>
                      Terms of Service
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.desktopRegisterButton, (loading || !acceptedPrivacy || !acceptedTerms) && styles.desktopRegisterButtonDisabled]}
                onPress={handleRegister}
                disabled={loading || !acceptedPrivacy || !acceptedTerms}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.desktopRegisterButtonText}>{t('register')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.desktopDivider}>
                <View style={styles.desktopDividerLine} />
                <Text style={styles.desktopDividerText}>OR</Text>
                <View style={styles.desktopDividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.desktopGoogleButton, (loading || !acceptedPrivacy || !acceptedTerms) && styles.desktopGoogleButtonDisabled]}
                onPress={handleGoogleRegister}
                disabled={loading || !acceptedPrivacy || !acceptedTerms}
              >
                {loading ? (
                  <ActivityIndicator color="#666" />
                ) : (
                  <>
                    <Text style={styles.desktopGoogleIcon}>G</Text>
                    <Text style={styles.desktopGoogleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.desktopLoginLink}>
                <Text style={styles.desktopLoginText}>{t('alreadyHaveAccount')} </Text>
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.desktopLoginTextBold}>{t('login')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <LinearGradient colors={['#4caf50', '#2e7d32']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Register Pest Control Company</Text>
            <Text style={styles.subtitle}>Create your company account</Text>

            <View style={styles.languageSection}>
              <Text style={styles.languageLabel}>Select Language</Text>
              <LanguageSelector />
            </View>
          </View>

          <View style={styles.formContainer}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>Registration successful! Redirecting to login...</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <User size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('fullName')}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Mail size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputContainer}>
              <Phone size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('phone')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Building size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Pest Control Company Name"
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.legalContainer}>
              <Text style={styles.legalTitle}>Devam etmek için lütfen kabul edin:</Text>

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
                  {acceptedPrivacy && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.checkboxTextContainer}>
                  <Text style={styles.checkboxText}>
                    <Text style={styles.linkText} onPress={() => router.push('/legal/privacy-policy')}>
                      Gizlilik Politikasını
                    </Text>
                    {' '}okudum ve kabul ediyorum
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.checkboxTextContainer}>
                  <Text style={styles.checkboxText}>
                    <Text style={styles.linkText} onPress={() => router.push('/legal/terms-of-service')}>
                      Kullanıcı Sözleşmesini
                    </Text>
                    {' '}okudum ve kabul ediyorum
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionDivider} />

            <TouchableOpacity
              style={[styles.registerButton, (loading || !acceptedPrivacy || !acceptedTerms) && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading || !acceptedPrivacy || !acceptedTerms}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>{t('register')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, (loading || !acceptedPrivacy || !acceptedTerms) && styles.googleButtonDisabled]}
              onPress={handleGoogleRegister}
              disabled={loading || !acceptedPrivacy || !acceptedTerms}
            >
              {loading ? (
                <ActivityIndicator color="#666" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>Google ile Kayıt Ol</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.loginLinkText}>{t('alreadyHaveAccount')}</Text>
              <Text style={styles.loginLinkTextBold}> {t('login')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Desktop Styles
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopBrandingPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  desktopBrandingContent: {
    maxWidth: 500,
  },
  desktopLogo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  desktopTagline: {
    fontSize: 24,
    color: '#e0f2fe',
    marginBottom: 60,
    lineHeight: 32,
  },
  desktopFeatures: {
    gap: 24,
  },
  desktopFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  desktopFeatureText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  desktopFormPanel: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  desktopFormScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 60,
  },
  desktopFormContainer: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  desktopFormHeader: {
    marginBottom: 32,
  },
  desktopFormTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  desktopFormSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  desktopLanguageSelector: {
    alignSelf: 'flex-start',
  },
  desktopErrorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  desktopErrorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  desktopSuccessContainer: {
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  desktopSuccessText: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
  },
  desktopInputRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  desktopInputContainer: {
    marginBottom: 20,
  },
  desktopInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  desktopInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
  },
  desktopInputIcon: {
    marginRight: 12,
  },
  desktopInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  desktopLegalContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  desktopCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  desktopCheckboxChecked: {
    backgroundColor: '#10b981',
  },
  desktopCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  desktopCheckboxText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
  },
  desktopLinkText: {
    color: '#10b981',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  desktopRegisterButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  desktopRegisterButtonDisabled: {
    opacity: 0.6,
  },
  desktopRegisterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  desktopDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  desktopDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  desktopDividerText: {
    marginHorizontal: 16,
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  desktopGoogleButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  desktopGoogleButtonDisabled: {
    opacity: 0.6,
  },
  desktopGoogleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
    marginRight: 12,
  },
  desktopGoogleButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '600',
  },
  desktopLoginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopLoginText: {
    color: '#64748b',
    fontSize: 14,
  },
  desktopLoginTextBold: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },

  // Mobile Styles
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#e8f5e9',
  },
  languageSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  registerButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    color: '#666',
    fontSize: 14,
  },
  loginLinkTextBold: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  legalContainer: {
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#4caf50',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#4caf50',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  linkText: {
    color: '#4caf50',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
    marginRight: 12,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
