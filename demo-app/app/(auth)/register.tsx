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

const ROLES = [
  { key: 'member', label: 'Member', icon: '💪' },
  { key: 'trainer', label: 'Trainer', icon: '🏋️' },
  { key: 'staff', label: 'Staff', icon: '🏢' },
];

export default function RegisterScreen() {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const result = await api.register(name.trim(), email.trim(), role);
      api.setToken(result.token);
      dispatch(setAuth({ token: result.token, user: result.user }));
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Something went wrong';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0 && email.trim().length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFF' }} behavior="padding">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginBottom: 36 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 }}>
            Create Account
          </Text>
          <Text style={{ fontSize: 15, color: '#8E8E93', marginTop: 4 }}>
            Join the GymPro fitness community
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 20 }}>
          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Full Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              placeholderTextColor="#C7C7CC"
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

          {/* Email */}
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

          {/* Role Picker */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              I am a
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {ROLES.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: role === r.key ? '#007AFF' : '#F2F2F7',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{r.icon}</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: role === r.key ? '#FFF' : '#000',
                    }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Register Button */}
          <Pressable
            onPress={handleRegister}
            disabled={!isValid || loading}
            style={({ pressed }) => ({
              backgroundColor: !isValid || loading ? '#B0D4FF' : pressed ? '#0066DD' : '#007AFF',
              paddingVertical: 16,
              borderRadius: 12,
              borderCurve: 'continuous',
              marginTop: 8,
              boxShadow: isValid && !loading ? '0 2px 8px rgba(0, 122, 255, 0.3)' : 'none',
            })}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
                Create Account
              </Text>
            )}
          </Pressable>
        </View>

        {/* Login Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32, gap: 4 }}>
          <Text style={{ fontSize: 15, color: '#8E8E93' }}>
            Already have an account?
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={{ fontSize: 15, color: '#007AFF', fontWeight: '600' }}>
                Sign In
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
