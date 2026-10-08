import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Skeleton } from '../../../components';
import { useTheme } from '../../../theme';

const { width } = Dimensions.get('window');
const DEFAULT_CARD_WIDTH = (width - 36) / 2;

interface ProductCardSkeletonProps {
  cardWidth?: number;
}

export const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({
  cardWidth = DEFAULT_CARD_WIDTH,
}) => {
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          width: cardWidth,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          padding: spacing.xs + 2,
        },
      ]}
    >
      {/* Image Skeleton Box */}
      <Skeleton
        width="100%"
        height={cardWidth * 0.72}
        borderRadius={borderRadius.sm}
        style={styles.imageSkeleton}
      />

      {/* Meta Row: delivery badge + rating */}
      <View style={styles.metaRow}>
        <Skeleton width={50} height={14} borderRadius={4} />
        <Skeleton width={32} height={14} borderRadius={4} />
      </View>

      {/* Title Lines */}
      <Skeleton width="90%" height={14} borderRadius={4} style={styles.titleLine} />
      <Skeleton width="60%" height={12} borderRadius={4} style={styles.subLine} />

      {/* Category Pill Skeleton */}
      <Skeleton width={64} height={14} borderRadius={4} style={styles.categoryPill} />

      {/* Bottom Row: Price & Add Button */}
      <View style={styles.bottomRow}>
        <View style={styles.priceCol}>
          <Skeleton width={48} height={18} borderRadius={4} />
          <Skeleton width={32} height={12} borderRadius={4} style={{ marginTop: 2 }} />
        </View>
        <Skeleton width={64} height={28} borderRadius={borderRadius.sm} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginBottom: 12,
    justifyContent: 'flex-start',
  },
  imageSkeleton: {
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleLine: {
    marginBottom: 4,
  },
  subLine: {
    marginBottom: 6,
  },
  categoryPill: {
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 4,
  },
  priceCol: {
    justifyContent: 'center',
  },
});
