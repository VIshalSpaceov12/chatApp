import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Link } from 'expo-router';
import { useDispatch } from 'react-redux';
import api from '../../src/services/api';
import { setAuth } from '../../src/store/auth-slice';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await api.login(email.trim());
      api.setToken(result.token);
      dispatch(setAuth({ token: result.token, user: result.user }));
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Something went wrong';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFF' }} behavior="padding">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Area */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: '#007AFF',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)',
            }}
          >
            <Text style={{ fontSize: 36, color: '#FFF', fontWeight: '700' }}>G</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 }}>
            GymPro Chat
          </Text>
          <Text style={{ fontSize: 15, color: '#8E8E93', marginTop: 4 }}>
            Connect with your fitness community
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Email Address
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#C7C7CC"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: '#F2F2F7',
                borderRadius: 12,
                borderCurve: 'continuous',
                padding: 16,
                fontSize: 17,
                color: '#000',
              }}
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={!email.trim() || loading}
            style={({ pressed }) => ({
              backgroundColor: !email.trim() || loading ? '#B0D4FF' : pressed ? '#0066DD' : '#007AFF',
              paddingVertical: 16,
              borderRadius: 12,
              borderCurve: 'continuous',
              boxShadow: email.trim() && !loading ? '0 2px 8px rgba(0, 122, 255, 0.3)' : 'none',
            })}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
                Sign In
              </Text>
            )}
          </Pressable>
        </View>

        {/* Register Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32, gap: 4 }}>
          <Text style={{ fontSize: 15, color: '#8E8E93' }}>
            Don't have an account?
          </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={{ fontSize: 15, color: '#007AFF', fontWeight: '600' }}>
                Sign Up
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
