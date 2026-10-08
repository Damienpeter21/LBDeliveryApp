import React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Skeleton } from '../../../components';
import { useTheme } from '../../../theme';
import { ProductCardSkeleton } from '../../products/components/ProductCardSkeleton';

const { width } = Dimensions.get('window');
const GRID_CARD_WIDTH = (width - 36) / 2;
const HORIZONTAL_CARD_WIDTH = 165;

export const HomeSkeleton: React.FC = () => {
  const { spacing, borderRadius } = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. Promotional Banner Skeleton */}
      <View style={[styles.bannerWrapper, { marginHorizontal: spacing.md }]}>
        <Skeleton
          width="100%"
          height={145}
          borderRadius={borderRadius.lg}
        />
      </View>

      {/* 2. Explore Categories Skeleton Chips */}
      <View style={styles.categorySection}>
        <View style={[styles.sectionHeader, { paddingHorizontal: spacing.md }]}>
          <Skeleton width={140} height={18} borderRadius={4} />
          <Skeleton width={55} height={14} borderRadius={4} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoryRow, { paddingHorizontal: spacing.md }]}
        >
          {[80, 95, 75, 110, 85, 90].map((pillWidth, idx) => (
            <Skeleton
              key={`cat_skel_${idx}`}
              width={pillWidth}
              height={34}
              borderRadius={17}
              style={{ marginRight: 8 }}
            />
          ))}
        </ScrollView>
      </View>

      {/* 3. Section: Deals of the Day (Horizontal Carousel) Skeleton */}
      <View style={styles.section}>
        <View style={[styles.sectionHeader, { paddingHorizontal: spacing.md }]}>
          <Skeleton width={150} height={18} borderRadius={4} />
          <Skeleton width={55} height={14} borderRadius={4} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.horizontalProducts, { paddingHorizontal: spacing.md }]}
        >
          {[1, 2, 3].map(i => (
            <View key={`deal_skel_${i}`} style={{ marginRight: 10 }}>
              <ProductCardSkeleton cardWidth={HORIZONTAL_CARD_WIDTH} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 4. Section: New Arrivals (2-Column Grid) Skeleton */}
      <View style={styles.section}>
        <View style={[styles.sectionHeader, { paddingHorizontal: spacing.md }]}>
          <Skeleton width={130} height={18} borderRadius={4} />
          <Skeleton width={55} height={14} borderRadius={4} />
        </View>

        <View style={styles.grid}>
          {[1, 2, 3, 4].map(i => (
            <ProductCardSkeleton key={`arr_skel_${i}`} cardWidth={GRID_CARD_WIDTH} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  bannerWrapper: {
    marginVertical: 8,
  },
  categorySection: {
    marginVertical: 10,
  },
  section: {
    marginTop: 14,
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  horizontalProducts: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
});
