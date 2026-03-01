import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { B, Radius } from '../lib/theme';

/**
 * LIKE / NOPE stamp overlay shown while swiping.
 */
export default function OverlayLabel({ label }) {
  const isLike = label === 'LIKE';

  return (
    <View
      style={[
        styles.container,
        isLike ? styles.likeContainer : styles.nopeContainer,
      ]}
    >
      <View
        style={[
          styles.badge,
          { borderColor: isLike ? B.like : B.pass },
        ]}
      >
        <Ionicons
          name={isLike ? 'heart' : 'close'}
          size={28}
          color={isLike ? B.like : B.pass}
        />
        <Text
          style={[
            styles.text,
            { color: isLike ? B.like : B.pass },
          ]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

OverlayLabel.propTypes = {
  label: PropTypes.string.isRequired,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeContainer: {
    backgroundColor: B.likeBg,
    borderRadius: Radius.xl,
  },
  nopeContainer: {
    backgroundColor: B.passBg,
    borderRadius: Radius.xl,
  },
  badge: {
    borderWidth: 3.5,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    transform: [{ rotate: '-15deg' }],
  },
  text: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
  },
});
