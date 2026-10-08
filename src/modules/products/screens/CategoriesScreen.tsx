import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Skeleton } from '../../../components';
import { useTheme } from '../../../theme';
import { formatOdooImage, getProductCategoriesData } from '../../home/services/HomeActions';
import { useCart } from '../context/CartContext';
import { Category } from '../types/product';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2;

interface CategoriesScreenProps {
  initialCategories?: Category[];
  onBack: () => void;
  onSelectCategory: (categoryId: string, categoryName: string) => void;
  onNavigateToCart: () => void;
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  initialCategories,
  onBack,
  onSelectCategory,
  onNavigateToCart,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, isDark } = useTheme();
  const { totalQuantity, totalAmount } = useCart();

  const [categories, setCategories] = useState<Category[]>(initialCategories ?? []);
  const [loading, setLoading] = useState<boolean>(!initialCategories || initialCategories.length === 0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchCategories = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await getProductCategoriesData();
      if (res?.result && Array.isArray(res.result)) {
        setCategories(res.result);
      }
    } catch (err) {
      console.error('Error fetching categories in CategoriesScreen:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialCategories || initialCategories.length === 0) {
      fetchCategories();
    }
  }, [initialCategories]);

  // Filter categories based on search input and exclude any "All" / "All Category" items
  const filteredCategories = useMemo(() => {
    const valid = categories.filter(c => {
      const name = (c?.name || '').trim().toLowerCase();
      const id = String(c?.id || '').trim().toLowerCase();
      return id !== 'all' && name !== 'all' && name !== 'all category' && name !== 'all categories';
    });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return valid;
    return valid.filter(c => (c.name ?? '').toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const formatAmount = (val: number | string): string => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toFixed(2).replace(/\.00$/, '');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Safe Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 16),
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={onBack}
            style={[styles.iconButton, { backgroundColor: colors.surfaceVariant }]}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Categories
              </Text>
              <View style={[styles.countBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                  {filteredCategories.length}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={onNavigateToCart}
            style={[styles.cartHeaderBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            accessibilityLabel="Open cart"
          >
            <Ionicons name="cart-outline" size={19} color={colors.onPrimary} />
            {totalQuantity > 0 && (
              <View
                style={[
                  styles.cartBadge,
                  { backgroundColor: colors.secondary, borderColor: colors.surface },
                ]}
              >
                <Text style={[styles.cartBadgeText, { color: colors.onSecondary }]}>
                  {totalQuantity}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Amazon / Flipkart Style Category Search Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surfaceVariant,
              borderColor: searchQuery.length > 0 ? colors.primary : colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search categories (Fruits, Dairy, Staples...)"
            placeholderTextColor={colors.inputPlaceholder}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content Grid */}
      {loading ? (
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View
              key={`cat_skel_${i}`}
              style={[
                styles.skeletonCard,
                {
                  width: CARD_WIDTH,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <Skeleton width="100%" height={110} borderRadius={borderRadius.lg} />
              <View style={{ padding: 10 }}>
                <Skeleton width="80%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
                <Skeleton width="45%" height={11} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      ) : filteredCategories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="search-outline" size={40} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Category Found</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            We couldn't find any category matching "{searchQuery}".
          </Text>
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={[styles.clearSearchBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.clearSearchText, { color: colors.onPrimary }]}>Show All Categories</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          numColumns={2}
          keyExtractor={(item, index) => (item?.id ? String(item.id) : `cat_${index}`)}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 85, 110) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCategories(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            if (!item) return null;

            const rawName = typeof item?.name === 'string' ? item.name : 'Category';
            const categoryId = String(item?.id ?? '');
            const productCount = Number((item as any)?.product_count ?? 0);
            const imageUrl = formatOdooImage(item.image_1920 || (item as any).imageUrl);
            const initials = rawName.slice(0, 2).toUpperCase();

            return (
              <TouchableOpacity
                onPress={() => onSelectCategory(categoryId, rawName)}
                activeOpacity={0.86}
                style={[
                  styles.categoryCard,
                  {
                    width: CARD_WIDTH,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: borderRadius.lg + 2,
                  },
                ]}
              >
                {/* Hero Category Image from API */}
                <View style={styles.imageContainer}>
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.placeholderBox, { backgroundColor: `${colors.primary}12` }]}>
                      <Text style={[styles.placeholderInitials, { color: colors.primary }]}>
                        {initials}
                      </Text>
                    </View>
                  )}

                  {/* Product Count Pill */}
                  {productCount > 0 && (
                    <View style={[styles.countBadgeOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.65)' }]}>
                      <Text style={styles.countBadgeOverlayText}>
                        {productCount} items
                      </Text>
                    </View>
                  )}
                </View>

                {/* Category Details */}
                <View style={styles.cardInfo}>
                  <Text
                    style={[styles.categoryName, { color: colors.textPrimary }]}
                    numberOfLines={2}
                  >
                    {rawName}
                  </Text>
                  <View style={styles.actionRow}>
                    <Text style={[styles.exploreText, { color: colors.primary }]}>
                      Explore
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating Cart Bar */}
      {totalQuantity > 0 && (
        <View
          style={[
            styles.floatingCart,
            {
              backgroundColor: colors.primary,
              borderRadius: borderRadius.lg,
              bottom: Math.max(insets.bottom + 10, 16),
            },
          ]}
        >
          <View>
            <Text style={[styles.floatingCartCount, { color: colors.onPrimary }]}>
              {totalQuantity} {totalQuantity === 1 ? 'ITEM' : 'ITEMS'} • ₹{formatAmount(totalAmount)}
            </Text>
            <Text style={[styles.floatingCartSub, { color: colors.onPrimary }]}>
              Extra savings applied at checkout!
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onNavigateToCart}
            style={styles.viewCartButton}
          >
            <Text style={[styles.viewCartText, { color: colors.onPrimary }]}>View Cart</Text>
            <Ionicons name="cart" size={16} color={colors.onPrimary} style={{ marginLeft: 6 }} />
            <Ionicons name="chevron-forward" size={14} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  cartHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  categoryCard: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2.5,
  },
  imageContainer: {
    width: '100%',
    height: 116,
    position: 'relative',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderBox: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderInitials: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  countBadgeOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  countBadgeOverlayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cardInfo: {
    padding: 10,
    justifyContent: 'space-between',
    minHeight: 64,
  },
  categoryName: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  exploreText: {
    fontSize: 11.5,
    fontWeight: '800',
    marginRight: 3,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  skeletonCard: {
    marginBottom: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  clearSearchBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearSearchText: {
    fontSize: 13,
    fontWeight: '700',
  },
  floatingCart: {
    position: 'absolute',
    left: 14,
    right: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  floatingCartCount: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  floatingCartSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
    opacity: 0.9,
  },
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  viewCartText: {
    fontSize: 13,
    fontWeight: '800',
  },
});

export default CategoriesScreen;
