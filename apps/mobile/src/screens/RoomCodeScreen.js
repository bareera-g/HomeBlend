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
import { fetchRoom, joinRoom, isMember } from '../lib/api';
import { saveSession } from '../lib/storage';
import { B, Shadows, Radius } from '../lib/theme';

export default function RoomCodeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Look up room in Firestore by code
      const room = await fetchRoom(trimmed);
      if (!room) {
        setError('Room not found — check the code and try again');
        setLoading(false);
        return;
      }

      // Join if not already a member
      const alreadyMember = await isMember(room.id, user.id);
      if (!alreadyMember) {
        await joinRoom(room.id, user.id, user.display_name, user.avatar_color);
      }

      await saveSession({
        code: trimmed,
        roomId: room.id,
        roomName: room.name,
      });

      navigation.replace('Swipe', {
        sessionCode: trimmed,
        roomId: room.id,
        roomName: room.name,
      });
    } catch (err) {
      setError(err.message || 'Could not join room');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigation.replace('Login');
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userBadge}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: user?.avatar_color || B.gold },
              ]}
            >
              <Text style={styles.avatarText}>
                {user?.display_name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>{user?.display_name}</Text>
              <Text style={styles.userHint}>Signed in</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={B.muted} />
          </TouchableOpacity>
        </View>

        {/* Card */}
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="people" size={36} color={B.gold} />
            </View>
            <Text style={styles.title}>Join a Session</Text>
            <Text style={styles.subtitle}>
              Enter the code shared by your group host
            </Text>

            <Text style={styles.label}>SESSION CODE</Text>
            <TextInput
              style={[styles.codeInput, error ? styles.inputError : null]}
              placeholder="ABCD12"
              placeholderTextColor={B.mutedLight}
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase());
                setError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleJoin}
              maxLength={10}
              textAlign="center"
              selectionColor={B.gold}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !code.trim() && styles.buttonDisabled]}
              onPress={handleJoin}
              disabled={loading || !code.trim()}
              activeOpacity={0.75}
            >
              {loading ? (
                <ActivityIndicator color={B.offWhite} size="small" />
              ) : (
                <Text style={styles.buttonText}>Join Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.hint}>
          Sessions are created from the HomeBlend web app
        </Text>
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
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.avatar,
  },
  avatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  userName: {
    color: B.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  userHint: {
    color: B.muted,
    fontSize: 12,
    marginTop: 1,
  },
  signOutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: B.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: B.border,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -40,
  },
  card: {
    backgroundColor: B.bgCard,
    borderRadius: Radius.xl,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    ...Shadows.panel,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: B.goldBg,
    borderWidth: 1.5,
    borderColor: B.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '300',
    color: B.ink,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  subtitle: {
    fontSize: 14,
    color: B.muted,
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: B.muted,
    letterSpacing: 2,
    marginBottom: 8,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: B.bgInput,
    borderRadius: Radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 18,
    fontSize: 26,
    fontWeight: '700',
    color: B.ink,
    borderWidth: 1.5,
    borderColor: B.border,
    letterSpacing: 8,
    width: '100%',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputError: {
    borderColor: B.error,
  },
  error: {
    color: B.error,
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: B.ink,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
  hint: {
    textAlign: 'center',
    color: B.mutedLight,
    fontSize: 13,
    paddingBottom: 32,
  },
});

RoomCodeScreen.propTypes = {
  navigation: PropTypes.shape({
    replace: PropTypes.func.isRequired,
  }).isRequired,
};
