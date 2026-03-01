import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { B, Shadows, Radius } from '../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.58;

/**
 * PropertyCard — full swipe card (default) or compact list card.
 * compact=true renders a smaller horizontal card for the "Swiped" tab.
 */
export default function PropertyCard({ listing, compact = false, onPress, autoScroll = false }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [showAI, setShowAI] = useState(false);
  const images = listing.images?.length ? listing.images : [listing.imageUrl];

  // Auto-advance images every 3 seconds (only when autoScroll is true)
  const timerRef = useRef(null);

  useEffect(() => {
    if (!autoScroll || images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setImgIndex((i) => (i + 1) % images.length);
    }, 3000);
    return () => clearInterval(timerRef.current);
  }, [autoScroll, images.length]);

  const formatPrice = (price, priceNum) => {
    if (!price && !priceNum) return 'N/A';
    if (typeof price === 'string' && price.includes('$')) return price;
    const num = priceNum || Number(price);
    if (Number.isNaN(num)) return String(price);
    return '$' + num.toLocaleString();
  };

  // Amenities (matching web app)
  const amenities = [
    listing.parking && { icon: 'car-outline', label: listing.parking },
    listing.laundry && { icon: 'water-outline', label: listing.laundry },
    listing.petFriendly && { icon: 'paw-outline', label: 'Pets OK' },
  ].filter(Boolean);

  // Tags
  const tags = listing.tags || [];

  /* ── Compact card for Swiped list ── */
  if (compact) {
    const Wrapper = onPress ? TouchableOpacity : View;
    const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};
    return (
      <Wrapper style={cStyles.card} {...wrapperProps}>
        <Image
          source={{ uri: images[0] }}
          style={cStyles.image}
          resizeMode="cover"
        />
        <View style={cStyles.info}>
          <Text style={cStyles.title} numberOfLines={1}>
            {listing.title || listing.address}
          </Text>
          <View style={cStyles.locationRow}>
            <Ionicons name="location" size={11} color={B.gold} />
            <Text style={cStyles.locationText} numberOfLines={1}>
              {listing.location || [listing.city, listing.state].filter(Boolean).join(', ')}
            </Text>
          </View>
          <Text style={cStyles.price}>
            {formatPrice(listing.price, listing.priceNum)}
          </Text>
          <Text style={cStyles.stats}>
            {listing.beds} bd · {listing.baths} ba
            {listing.sqft ? ` · ${listing.sqft.toLocaleString()} sqft` : ''}
          </Text>
        </View>
      </Wrapper>
    );
  }

  /* ── Full swipe card ── */
  return (
    <View style={styles.card}>
      {/* Image Section */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: images[imgIndex] }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Gradient scrims */}
        <View style={styles.topScrim} />
        <View style={styles.bottomScrim} />

        {/* Image indicator bars */}
        {images.length > 1 && (
          <View style={styles.barContainer}>
            {images.map((img, i) => (
              <View
                key={`bar-${img}`}
                style={[styles.bar, i === imgIndex && styles.barActive]}
              />
            ))}
          </View>
        )}

        {/* Price badge — bottom left */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>
            {formatPrice(listing.price, listing.priceNum)}
          </Text>
        </View>

        {/* Category badge — top right */}
        {(listing.propertyType || listing.category) && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>
              {(listing.propertyType || listing.category || '').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Details Section */}
      <ScrollView
        style={styles.details}
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {listing.title || listing.address}
        </Text>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color={B.gold} />
          <Text style={styles.locationText} numberOfLines={1}>
            {listing.location || [listing.city, listing.state, listing.zipCode].filter(Boolean).join(', ')}
          </Text>
        </View>

        {/* Stats row — beds, baths, sqft */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{listing.beds}</Text>
            <Text style={styles.statLabel}> bd</Text>
          </View>
          <Text style={styles.statDot}>·</Text>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{listing.baths}</Text>
            <Text style={styles.statLabel}> ba</Text>
          </View>
          <Text style={styles.statDot}>·</Text>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {listing.sqft ? listing.sqft.toLocaleString() : '—'}
            </Text>
            <Text style={styles.statLabel}> sqft</Text>
          </View>
        </View>

        {/* Amenity chips */}
        {amenities.length > 0 && (
          <View style={styles.chipsRow}>
            {amenities.map((a) => (
              <View key={a.label} style={styles.amenityChip}>
                <Ionicons name={a.icon} size={12} color={B.muted} />
                <Text style={styles.amenityText}>{a.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.chipsRow}>
            {tags.slice(0, 6).map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* AI Overview toggle */}
        {(listing.description || listing.aiOverview) && (
          <>
            <TouchableOpacity
              style={[styles.aiToggle, showAI && styles.aiToggleActive]}
              onPress={() => setShowAI((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={styles.aiToggleLeft}>
                <Ionicons
                  name="flash"
                  size={13}
                  color={showAI ? B.gold : B.muted}
                />
                <Text style={[styles.aiToggleLabel, showAI && { color: B.gold }]}>
                  AI Overview
                </Text>
              </View>
              <Ionicons
                name={showAI ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={showAI ? B.gold : B.muted}
              />
            </TouchableOpacity>

            {showAI && (
              <Text style={styles.aiText}>
                {listing.aiOverview || listing.description}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

PropertyCard.propTypes = {
  listing: PropTypes.shape({
    images: PropTypes.arrayOf(PropTypes.string),
    imageUrl: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    priceNum: PropTypes.number,
    propertyType: PropTypes.string,
    category: PropTypes.string,
    title: PropTypes.string,
    address: PropTypes.string,
    location: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    zipCode: PropTypes.string,
    beds: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    baths: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    sqft: PropTypes.number,
    description: PropTypes.string,
    aiOverview: PropTypes.string,
    parking: PropTypes.string,
    laundry: PropTypes.string,
    petFriendly: PropTypes.bool,
    tags: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  compact: PropTypes.bool,
  onPress: PropTypes.func,
};

/* ── Full card styles ── */
const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    backgroundColor: B.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    ...Shadows.cardHover,
  },
  imageContainer: {
    width: '100%',
    height: '48%',
    position: 'relative',
    backgroundColor: '#E8DDD0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(12,5,2,0.2)',
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(12,5,2,0.18)',
  },
  barContainer: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 3,
    zIndex: 3,
  },
  bar: {
    flex: 1,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  barActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(12,5,2,0.62)',
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  priceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '300',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  typeBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(12,5,2,0.58)',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  details: {
    flex: 1,
    backgroundColor: B.white,
  },
  detailsContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '300',
    color: B.ink,
    marginBottom: 3,
    lineHeight: 23,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    color: B.muted,
    fontSize: 12,
    flex: 1,
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: B.goldBg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: B.goldBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    color: B.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  statLabel: {
    color: B.muted,
    fontSize: 11,
    fontWeight: '400',
  },
  statDot: {
    color: B.muted,
    fontSize: 12,
    marginHorizontal: 8,
    opacity: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: B.goldBg,
    borderWidth: 1,
    borderColor: B.goldBorder,
  },
  amenityText: {
    color: B.muted,
    fontSize: 10,
    fontWeight: '500',
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: B.border,
  },
  tagText: {
    color: B.muted,
    fontSize: 9,
    fontWeight: '500',
  },
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(166,124,61,0.2)',
    backgroundColor: 'rgba(166,124,61,0.03)',
    marginTop: 2,
  },
  aiToggleActive: {
    borderColor: B.gold,
    backgroundColor: 'rgba(166,124,61,0.06)',
  },
  aiToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiToggleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: B.muted,
  },
  aiText: {
    color: B.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    letterSpacing: 0.1,
  },
});

/* ── Compact card styles (Swiped tab) ── */
const cStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: B.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: B.borderLight,
    ...Shadows.card,
  },
  image: {
    width: 110,
    height: 110,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: B.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    color: B.muted,
    fontSize: 11,
    flex: 1,
  },
  price: {
    color: B.ink,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  stats: {
    color: B.muted,
    fontSize: 11,
    fontWeight: '500',
  },
});
