import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { IMAGES } from '../../../assets';
import { useTheme } from '../../../theme';

interface AuthLogoProps {
  size?: 'small' | 'medium' | 'large';
  tagline?: string;
}

export const AuthLogo: React.FC<AuthLogoProps> = ({
  size = 'large',
  tagline,
}) => {
  const { colors, borderRadius } = useTheme();

  const isLarge = size === 'large';
  const isSmall = size === 'small';

  const badgeSize = isLarge ? 88 : isSmall ? 52 : 68;
  const titleSize = isLarge ? 28 : isSmall ? 20 : 24;

  return (
    <View style={styles.container}>
      {/* Brand Logo in primaryVariant Tile */}
      <View
        style={[
          styles.iconBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primaryVariant,
            borderColor: colors.secondary,
          },
        ]}
      >
        <Image
          source={IMAGES.LOGO}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* Brand Title Row */}
      <View style={styles.titleRow}>
        <Text style={[styles.brandTitle, { color: colors.primary, fontSize: titleSize }]}>
          LB Delivery
        </Text>
        <View style={[styles.superstoreTag, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.superstoreText, { color: colors.onSecondary }]}>PARTNER</Text>
        </View>
      </View>


      {tagline && (
        <Text style={[styles.taglineText, { color: colors.textSecondary }]}>
          {tagline}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  superstoreTag: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  superstoreText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  taglineText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});
