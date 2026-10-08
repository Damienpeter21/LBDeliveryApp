import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../theme';
import { formatOdooImage } from '../services/HomeActions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const BANNER_HEIGHT = 165;

export interface BannerSliderProps {
  banners?: any[];
  onPressBanner?: (banner: any) => void;
}

export interface BannerItem {
  id: string | number;
  name: string;
  imageUrl?: string;
  hasImage: boolean;
  dateFrom?: string | boolean;
  dateTo?: string | boolean;
  programType?: string;
  typeLabel: string;
  palette: {
    bgStart: string;
    bgEnd: string;
    badgeBg: string;
    badgeColor: string;
    accent: string;
  };
  trigger_product_ids?: number[];
  rawItem: any;
}

const PALETTES = [
  { bgStart: '#0F4A24', bgEnd: '#062B14', badgeBg: '#10B981', badgeColor: '#FFFFFF', accent: '#34D399' },
  { bgStart: '#1E3A8A', bgEnd: '#0F172A', badgeBg: '#38BDF8', badgeColor: '#0B1E38', accent: '#60A5FA' },
  { bgStart: '#7C2D12', bgEnd: '#431407', badgeBg: '#FB923C', badgeColor: '#381104', accent: '#FDBA74' },
  { bgStart: '#581C87', bgEnd: '#2E1065', badgeBg: '#C084FC', badgeColor: '#280A45', accent: '#D8B4FE' },
  { bgStart: '#831843', bgEnd: '#4C0519', badgeBg: '#F472B6', badgeColor: '#3D0517', accent: '#FBCFE8' },
];

const formatProgramType = (type?: string): string => {
  if (!type) return 'SPECIAL OFFER';
  const clean = String(type).replace(/_/g, ' ').toUpperCase();
  if (clean === 'BUY X GET Y') return 'BUY 1 GET 1';
  if (clean === 'PROMO CODE') return 'COUPON DEAL';
  if (clean === 'PROMOTION') return 'PROMOTIONAL OFFER';
  if (clean === 'GIFT CARD') return 'GIFT REWARD';
  return clean;
};

export const formatToDDMMYYYY = (dateVal?: string | boolean | null): string | null => {
  if (!dateVal || typeof dateVal !== 'string') return null;
  const trimmed = dateVal.trim();
  if (!trimmed || trimmed === 'false') return null;

  // Handles 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'
  const datePart = trimmed.split(/[ T]/)[0];
  if (datePart) {
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year && month && day && year.length === 4) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  }

  // Fallback to JS Date parsing
  const parsed = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'));
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return trimmed;
};

const formatDateRange = (from?: string | boolean, to?: string | boolean): string | null => {
  const f = formatToDDMMYYYY(from);
  const t = formatToDDMMYYYY(to);
  if (f && t) return `${f} – ${t}`;
  if (t) return `Valid till ${t}`;
  if (f) return `From ${f}`;
  return null;
};

export const BannerSlider: React.FC<BannerSliderProps> = ({ banners: apiBanners, onPressBanner }) => {
  const { colors, spacing, borderRadius, isDark } = useTheme();
  const scrollRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const activeIndexRef = useRef<number>(0);
  const isInteractingRef = useRef<boolean>(false);

  const itemFullWidth = BANNER_WIDTH + spacing.sm;

  const displayBanners: BannerItem[] = useMemo(() => {
    if (!apiBanners || !Array.isArray(apiBanners) || apiBanners.length === 0) {
      return [];
    }

    return apiBanners.map((item, index) => {
      const name = String(item.name || '').trim();
      const img = formatOdooImage(item.image_1920 || item.imageUrl);
      const palette = PALETTES[index % PALETTES.length];
      const typeLabel = formatProgramType(item.program_type);

      return {
        id: item.id ?? `banner_${index}`,
        name,
        imageUrl: img,
        hasImage: Boolean(img),
        dateFrom: item.date_from,
        dateTo: item.date_to,
        programType: item.program_type,
        typeLabel,
        palette,
        trigger_product_ids: item.trigger_product_ids,
        rawItem: item,
      };
    });
  }, [apiBanners]);

  // Keep active index ref in sync
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Glitch-free continuous auto-scroll timer
  useEffect(() => {
    if (displayBanners.length <= 1) return;

    const interval = setInterval(() => {
      if (!isInteractingRef.current && scrollRef.current) {
        const nextIndex = (activeIndexRef.current + 1) % displayBanners.length;
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
        scrollRef.current.scrollTo({
          x: nextIndex * itemFullWidth,
          animated: true,
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [displayBanners.length, itemFullWidth]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / itemFullWidth);
      if (index >= 0 && index < displayBanners.length && index !== activeIndexRef.current) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
    },
    [displayBanners.length, itemFullWidth],
  );

  const handleScrollBeginDrag = () => {
    isInteractingRef.current = true;
  };

  const handleScrollEndDrag = () => {
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 2800);
  };

  if (displayBanners.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={itemFullWidth}
        snapToAlignment="start"
        disableIntervalMomentum={true}
        decelerationRate="fast"
        nestedScrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16 }]}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {displayBanners.map((banner, index) => {
          const isSelected = activeIndex === index;
          const dateRange = formatDateRange(banner.dateFrom, banner.dateTo);

          return (
            <TouchableOpacity
              key={banner.id}
              activeOpacity={0.92}
              onPress={() => onPressBanner && onPressBanner(banner.rawItem || banner)}
              style={[
                styles.cardContainer,
                {
                  width: BANNER_WIDTH,
                  height: BANNER_HEIGHT,
                  borderRadius: 20,
                  marginRight: index === displayBanners.length - 1 ? 0 : spacing.sm,
                  backgroundColor: banner.hasImage ? colors.surface : banner.palette.bgStart,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              {/* 1. Uncropped High-Fidelity Image Banner */}
              {banner.hasImage && banner.imageUrl ? (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: banner.imageUrl }}
                    style={styles.bannerImage}
                    resizeMode="contain"
                  />

                  {/* Frosted Metadata Pill Overlay (If active dates exist) */}
                  {dateRange ? (
                    <View style={styles.floatingDateBadge}>
                      <Ionicons name="calendar-outline" size={11.5} color="#FFFFFF" style={{ marginRight: 4.5 }} />
                      <Text style={styles.floatingDateText}>{dateRange}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                /* 2. Premium Themed Card for Non-Image Promotional Programs */
                <View style={[styles.themedCard, { backgroundColor: banner.palette.bgStart }]}>
                  {/* Subtle Ambient Shapes */}
                  <View style={styles.ambientGlow1} />
                  <View style={styles.ambientGlow2} />

                  {/* Top Header Row */}
                  <View style={styles.themedTopRow}>
                    <View style={[styles.typeBadge, { backgroundColor: banner.palette.badgeBg }]}>
                      <Text style={[styles.typeBadgeText, { color: banner.palette.badgeColor }]}>
                        {banner.typeLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Center Promotion Title */}
                  <View style={styles.themedCenterBox}>
                    <Text style={styles.themedTitle} numberOfLines={2}>
                      {banner.name || 'Special Promotional Offer'}
                    </Text>
                  </View>

                  {/* Bottom Footer Row */}
                  <View style={styles.themedBottomRow}>
                    {dateRange ? (
                      <View style={styles.themedDatePill}>
                        <Ionicons name="calendar-outline" size={12} color="#FFFFFF" style={{ marginRight: 5 }} />
                        <Text style={styles.themedDateText}>{dateRange}</Text>
                      </View>
                    ) : (
                      <View style={styles.themedDatePill}>
                        <Ionicons name="sparkles" size={12} color={banner.palette.accent} style={{ marginRight: 5 }} />
                        <Text style={styles.themedDateText}>Active Today</Text>
                      </View>
                    )}

                    <View style={[styles.actionCircle, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                      <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active Capsule Pagination Indicator */}
      {displayBanners.length > 1 && (
        <View style={styles.paginationRow}>
          {displayBanners.map((_, i) => (
            <View
              key={`dot_${i}`}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === activeIndex
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.22)'
                      : 'rgba(0, 0, 0, 0.14)',
                  width: i === activeIndex ? 22 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingVertical: 4,
  },
  cardContainer: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  floatingDateBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingDateText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  themedCard: {
    flex: 1,
    width: '100%',
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  ambientGlow1: {
    position: 'absolute',
    top: -25,
    right: -25,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  ambientGlow2: {
    position: 'absolute',
    bottom: -35,
    left: -25,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  themedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  themedCenterBox: {
    marginVertical: 6,
    zIndex: 2,
  },
  themedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 23,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  themedBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  themedDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  themedDateText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
});

export default BannerSlider;
