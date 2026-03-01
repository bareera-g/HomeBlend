import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { B, Shadows, Radius } from '../lib/theme';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignIn = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name');
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signIn(trimmed);
      navigation.replace('RoomCode');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View
        style={[
          styles.inner,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="home-outline" size={30} color={B.gold} />
          </View>
          <Text style={styles.title}>HomeBlend</Text>
          <Text style={styles.tagline}>FIND YOUR BLEND TOGETHER</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.label}>DISPLAY NAME</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Enter your name"
            placeholderTextColor={B.mutedLight}
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError('');
            }}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
            maxLength={30}
            selectionColor={B.gold}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading || !name.trim()}
            activeOpacity={0.75}
          >
            {loading ? (
              <ActivityIndicator color={B.offWhite} size="small" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>No password needed — just your name</Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: B.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: B.goldBg,
    borderWidth: 1.5,
    borderColor: B.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    color: B.ink,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  tagline: {
    fontSize: 12,
    color: B.muted,
    marginTop: 8,
    letterSpacing: 3,
    fontWeight: '400',
  },
  card: {
    backgroundColor: B.bgCard,
    borderRadius: Radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...Shadows.panel,
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: B.muted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  input: {
    backgroundColor: B.bgInput,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 17,
    color: B.ink,
    borderWidth: 1,
    borderColor: B.border,
    marginBottom: 16,
  },
  inputError: {
    borderColor: B.error,
  },
  error: {
    color: B.error,
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 2,
  },
  button: {
    backgroundColor: B.ink,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: B.offWhite,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footer: {
    textAlign: 'center',
    color: B.mutedLight,
    fontSize: 13,
    letterSpacing: 0.2,
  },
});

LoginScreen.propTypes = {
  navigation: PropTypes.shape({
    replace: PropTypes.func.isRequired,
  }).isRequired,
};
