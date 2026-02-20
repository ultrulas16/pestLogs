import React, { useState, useEffect } from 'react';
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
import { ArrowLeft, Mail, Lock, CheckCircle, Users, BarChart3, Shield } from 'lucide-react-native';
import { LanguageSelector } from '@/components/LanguageSelector';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const { t } = useLanguage();
  const { signIn, signInWithGoogle, user, profile, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (user && profile) {
      router.replace('/');
    }
  }, [user, profile, authLoading]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('fillAllFields'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      setTimeout(() => {
        router.replace('/');
      }, 500);
    } catch (err: any) {
      console.error('[LOGIN] Login error:', err);
      let errorMessage = 'Giriş başarısız oldu';
      if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Email veya şifre hatalı';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Email adresinizi doğrulayın';
      } else if (err.message?.includes('network')) {
        errorMessage = 'İnternet bağlantınızı kontrol edin';
      }
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('[LOGIN] Google OAuth error:', err);
      setError('Google ile giriş başarısız oldu. Lütfen tekrar deneyin.');
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

        {/* Right Panel - Login Form */}
        <View style={styles.desktopFormPanel}>
          <ScrollView
            contentContainerStyle={styles.desktopFormScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.desktopFormContainer}>
              <View style={styles.desktopFormHeader}>
                <Text style={styles.desktopFormTitle}>{t('login')}</Text>
                <Text style={styles.desktopFormSubtitle}>Welcome back! Please login to your account.</Text>
                <View style={styles.desktopLanguageSelector}>
                  <LanguageSelector />
                </View>
              </View>

              {error ? (
                <View style={styles.desktopErrorContainer}>
                  <Text style={styles.desktopErrorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.desktopInputContainer}>
                <Text style={styles.desktopInputLabel}>Email</Text>
                <View style={styles.desktopInputWrapper}>
                  <Mail size={20} color="#64748b" style={styles.desktopInputIcon} />
                  <TextInput
                    style={styles.desktopInput}
                    placeholder={t('email')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.desktopInputContainer}>
                <Text style={styles.desktopInputLabel}>Password</Text>
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

              <TouchableOpacity
                style={styles.desktopForgotPassword}
                onPress={() => router.push('/auth/forgot-password')}
              >
                <Text style={styles.desktopForgotPasswordText}>{t('forgotPassword')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.desktopLoginButton, loading && styles.desktopLoginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.desktopLoginButtonText}>{t('login')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.desktopDivider}>
                <View style={styles.desktopDividerLine} />
                <Text style={styles.desktopDividerText}>OR</Text>
                <View style={styles.desktopDividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.desktopGoogleButton, loading && styles.desktopGoogleButtonDisabled]}
                onPress={handleGoogleLogin}
                disabled={loading}
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

              <View style={styles.desktopRegisterLink}>
                <Text style={styles.desktopRegisterText}>{t('dontHaveAccount')} </Text>
                <TouchableOpacity onPress={() => router.push('/auth/register')}>
                  <Text style={styles.desktopRegisterTextBold}>{t('register')}</Text>
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
        >
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.languageContainer}>
              <LanguageSelector />
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>{t('login')}</Text>
            <Text style={styles.subtitle}>Pest Control System</Text>
          </View>

          <View style={styles.formContainer}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Mail size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
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

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>{t('login')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, loading && styles.googleButtonDisabled]}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#666" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.linksContainer}>
              <TouchableOpacity
                style={styles.forgotPasswordLink}
                onPress={() => router.push('/auth/forgot-password')}
              >
                <Text style={styles.forgotPasswordText}>{t('forgotPassword')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => router.push('/auth/register')}
              >
                <Text style={styles.registerLinkText}>{t('dontHaveAccount')}</Text>
                <Text style={styles.registerLinkTextBold}> {t('register')}</Text>
              </TouchableOpacity>
            </View>
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
    maxWidth: 480,
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
  desktopForgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  desktopForgotPasswordText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  desktopLoginButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  desktopLoginButtonDisabled: {
    opacity: 0.6,
  },
  desktopLoginButtonText: {
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
  desktopRegisterLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopRegisterText: {
    color: '#64748b',
    fontSize: 14,
  },
  desktopRegisterTextBold: {
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e8f5e9',
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
  loginButton: {
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
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
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
  linksContainer: {
    marginTop: 20,
    gap: 16,
  },
  forgotPasswordLink: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '600',
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerLinkText: {
    color: '#666',
    fontSize: 14,
  },
  registerLinkTextBold: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: 'bold',
  },
});