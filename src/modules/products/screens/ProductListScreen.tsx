import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { EmptyState } from '../../../components';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ProductCardSkeleton';
import { useCart } from '../context/CartContext';
import { Category, Product } from '../types/product';
import { mapOdooProductToProduct } from '../utils/productMapper';
import {
  getAllProducts,
  getProductsByCategory,
  getProductsByProductIds,
  searchProducts,
} from '../services/ProductActions';
import { getProductCategoriesData } from '../../home/services/HomeActions';

const { width } = Dimensions.get('window');
const GRID_CARD_WIDTH = (width - 36) / 2;

type SortOption = 'relevance' | 'price_low' | 'price_high' | 'rating' | 'discount';

interface ProductListScreenProps {
  initialCategoryId?: string;
  initialCategoryName?: string;
  initialSearchQuery?: string;
  products?: Product[];
  productIds?: (number | string)[];
  categories?: Category[];
  onBack: () => void;
  onNavigateToProductDetails: (product: Product) => void;
  onNavigateToCart: () => void;
  onRequireAuth: () => void;
}

export const ProductListScreen: React.FC<ProductListScreenProps> = ({
  initialCategoryId = 'all',
  initialCategoryName = '',
  initialSearchQuery = '',
  products: initialProducts,
  productIds: initialProductIds,
  categories: initialCategories,
  onBack,
  onNavigateToProductDetails,
  onNavigateToCart,
  onRequireAuth,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius } = useTheme();
  const { isAuthenticated } = useAuth();
  const { totalQuantity, totalAmount } = useCart();
  const categoryListRef = React.useRef<FlatList>(null);

  const [categoriesList, setCategoriesList] = useState<Category[]>(initialCategories ?? []);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadedProducts, setLoadedProducts] = useState<Product[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategoryId ? String(initialCategoryId) : 'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || '');
  const [showSearch, setShowSearch] = useState<boolean>(!!initialSearchQuery);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showSortModal, setShowSortModal] = useState<boolean>(false);

  // Fetch categories if not passed from navigation
  useEffect(() => {
    if (!initialCategories || initialCategories.length === 0) {
      getProductCategoriesData()
        .then((res: any) => {
          if (res?.result && Array.isArray(res.result)) {
            setCategoriesList(res.result);
          }
        })
        .catch((err: any) => console.error('Error fetching categories:', err));

    } else {
      setCategoriesList(initialCategories);
    }
  }, [initialCategories]);

  const activeCategories = useMemo(() => {
    const allTab: Category = {
      id: 'all',
      name:
        initialProductIds && initialProductIds.length > 0 && initialCategoryName
          ? initialCategoryName
          : 'All Products',
      itemCount: 0,
      iconName: 'grid-outline',
    };
    const list = Array.isArray(categoriesList) && categoriesList.length > 0
      ? categoriesList
      : (Array.isArray(initialCategories) ? initialCategories : []);
    return [allTab, ...list];
  }, [categoriesList, initialCategories, initialProductIds, initialCategoryName]);

  // Synchronize initial props
  useEffect(() => {
    if (initialCategoryId !== undefined && initialCategoryId !== null) {
      setSelectedCategory(String(initialCategoryId));
    }
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
      if (initialSearchQuery.trim()) {
        setShowSearch(true);
      }
    }
  }, [initialCategoryId, initialSearchQuery]);

  // Scroll to active category tab helper
  const scrollToCategory = useCallback((categoryId: string) => {
    if (activeCategories.length > 0 && categoryListRef.current) {
      const idx = activeCategories.findIndex(
        c => String(c?.id) === String(categoryId) || (c?.name && c.name.toLowerCase() === String(categoryId).toLowerCase())
      );
      if (idx >= 0) {
        setTimeout(() => {
          try {
            categoryListRef.current?.scrollToIndex({
              index: idx,
              animated: true,
              viewPosition: 0.5,
            });
          } catch (_) {}
        }, 120);
      }
    }
  }, [activeCategories]);

  // Auto-scroll category tabs whenever selectedCategory or activeCategories change
  useEffect(() => {
    if (selectedCategory && activeCategories.length > 0) {
      scrollToCategory(selectedCategory);
    }
  }, [selectedCategory, activeCategories, scrollToCategory]);

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategory(categoryId);
    scrollToCategory(categoryId);
  };

  const fetchCategoryProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      let res: any;
      if (selectedCategory && selectedCategory !== 'all') {
        res = await getProductsByCategory(selectedCategory);
      } else if (initialProductIds && initialProductIds.length > 0) {
        // Query product.product table for banner trigger_product_ids
        res = await getProductsByProductIds(initialProductIds);
      } else {
        res = await getAllProducts();
      }
      const rawProducts = res?.result && Array.isArray(res.result) ? res.result : [];
      const products = rawProducts.map(mapOdooProductToProduct);
      setLoadedProducts(products);
    } catch (err) {
      console.error('Error fetching category products:', err);
      setLoadedProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, initialProductIds]);

  // Fetch category-wise products via Odoo JSON-RPC API whenever category changes
  useEffect(() => {
    // If navigation provided pre-loaded products and we are still on that initial category, use them
    if (
      initialProducts &&
      Array.isArray(initialProducts) &&
      initialProducts.length > 0 &&
      String(selectedCategory) === String(initialCategoryId)
    ) {
      const mapped =
        (initialProducts[0] as any)?.price !== undefined
          ? (initialProducts as Product[])
          : initialProducts.map(mapOdooProductToProduct);
      setLoadedProducts(mapped);
      return;
    }

    fetchCategoryProducts();
  }, [selectedCategory, initialProducts, initialCategoryId, fetchCategoryProducts]);

  // Robust Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    const query = (searchQuery ?? '').trim().toLowerCase();

    let result = loadedProducts.filter(p => {
      if (!p) return false;

      const pCategory = (p.category ?? '').toLowerCase();
      const pName = (p.name ?? '').toLowerCase();
      const pTags = p.tags ?? [];

      const matchesSearch =
        query === '' ||
        pName.includes(query) ||
        pCategory.includes(query) ||
        pTags.some(t => (t ?? '').toLowerCase().includes(query));

      return matchesSearch;
    });

    // Apply Sorting
    switch (sortBy) {
      case 'price_low':
        result = [...result].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
      case 'price_high':
        result = [...result].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case 'rating':
        result = [...result].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case 'discount':
        result = [...result].sort(
          (a, b) => (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0)
        );
        break;
      default:
        break;
    }

    return result;
  }, [loadedProducts, searchQuery, sortBy]);

  const activeFiltersCount = sortBy !== 'relevance' ? 1 : 0;

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setSortBy('relevance');
  };

  const getActiveCategoryTitle = () => {
    const trimmed = (searchQuery ?? '').trim();
    if (trimmed) return `Results for "${trimmed}"`;
    const cat = activeCategories.find(c => String(c.id) === String(selectedCategory));
    if (cat) return cat.name;
    if (String(selectedCategory) === String(initialCategoryId) && initialCategoryName) {
      return initialCategoryName;
    }
    return selectedCategory === 'all' ? 'All Products' : 'Products';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top + 8, 16),
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceVariant }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {getActiveCategoryTitle()}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {loading
                ? 'Loading...'
                : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'Product' : 'Products'} Available`}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setShowSearch(!showSearch)}
              style={[styles.headerIconBtn, { backgroundColor: colors.surfaceVariant }]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showSearch ? 'close' : 'search-outline'}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onNavigateToCart}
              style={[styles.cartHeaderBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Ionicons name="cart-outline" size={18} color={colors.onPrimary} />
              {totalQuantity > 0 && (
                <View style={[styles.cartHeaderBadge, { backgroundColor: colors.secondary, borderColor: colors.surface }]}>
                  <Text style={[styles.cartHeaderBadgeText, { color: colors.onSecondary }]}>
                    {totalQuantity}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Search Input */}
        {showSearch && (
          <View style={[styles.searchRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search for products, brands and more..."
              placeholderTextColor={colors.inputPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus={!initialSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Horizontal Category Selector Bar */}
        <View style={styles.categoryScrollWrapper}>
          <FlatList
            ref={categoryListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={activeCategories}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.categoryScrollContent}
            onScrollToIndexFailed={info => {
              setTimeout(() => {
                categoryListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
              }, 100);
            }}
            renderItem={({ item }) => {
              const isSelected = String(selectedCategory) === String(item.id);
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  onPress={() => handleCategoryPress(String(item.id))}
                  activeOpacity={0.75}
                  style={[
                    styles.catTab,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catTabText,
                      {
                        color: isSelected ? colors.onPrimary : colors.textPrimary,
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Filter & Sort Bar */}
        <View style={[styles.filterBar, { borderTopColor: colors.divider }]}>
          {/* Sort Button */}
          <TouchableOpacity
            onPress={() => setShowSortModal(true)}
            style={[styles.filterBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <Ionicons name="swap-vertical" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.filterBtnText, { color: colors.textPrimary }]}>
              {sortBy === 'relevance'
                ? 'Sort'
                : sortBy === 'price_low'
                  ? 'Price: Low'
                  : sortBy === 'price_high'
                    ? 'Price: High'
                    : sortBy === 'rating'
                      ? 'Top Rated'
                      : 'Discount'}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 3 }} />
          </TouchableOpacity>

          {/* Results Count */}
          <Text style={[styles.itemCountSummary, { color: colors.textSecondary }]}>
            {loading ? 'Loading...' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'item' : 'items'}`}
          </Text>

          {/* Reset Filters / Sort Icon if active */}
          {sortBy !== 'relevance' && (
            <TouchableOpacity onPress={resetAllFilters} style={styles.resetBtn}>
              <Ionicons name="refresh" size={14} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Products Grid, Skeletons, or Empty State */}
      {loading ? (
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <ProductCardSkeleton key={`prod_skel_${i}`} cardWidth={GRID_CARD_WIDTH} />
          ))}
        </View>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          iconName="search-outline"
          badgeIcon="alert-circle"
          title="No Products Found"
          description={
            searchQuery.trim()
              ? `We couldn't find any products matching "${searchQuery}". Check the spelling or try different keywords.`
              : 'There are currently no products matching your selected filter criteria.'
          }
          actionLabel="Clear All Filters"
          onAction={resetAllFilters}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item, index) => (item?.id ? String(item.id) : `prod_${index}`)}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 90, 110) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCategoryProducts(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              cardWidth={GRID_CARD_WIDTH}
              onPress={onNavigateToProductDetails}
              onRequireAuth={!isAuthenticated ? onRequireAuth : undefined}
            />
          )}
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
              bottom: Math.max(insets.bottom + 8, 16),
            },
          ]}
        >
          <View>
            <Text style={[styles.floatingCartCount, { color: colors.onPrimary }]}>
              {totalQuantity} {totalQuantity === 1 ? 'ITEM' : 'ITEMS'} • ₹{totalAmount}
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

      {/* Sort Options Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderRadius: borderRadius.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sort Products By</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              { id: 'relevance', label: 'Relevance (Popular)' },
              { id: 'price_low', label: 'Price: Low to High' },
              { id: 'price_high', label: 'Price: High to Low' },
              { id: 'rating', label: 'Customer Rating (High to Low)' },
              { id: 'discount', label: 'Discount (High to Low)' },
            ].map(opt => {
              const isChosen = sortBy === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => {
                    setSortBy(opt.id as SortOption);
                    setShowSortModal(false);
                  }}
                  style={[
                    styles.sortOptionRow,
                    { borderBottomColor: colors.divider },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      {
                        color: isChosen ? colors.primary : colors.textPrimary,
                        fontWeight: isChosen ? '800' : '500',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isChosen && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartHeaderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  cartHeaderBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  categoryScrollWrapper: {
    paddingBottom: 6,
  },
  categoryScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  catTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  catTabText: {
    fontSize: 12,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  itemCountSummary: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    padding: 6,
  },
  columnWrapper: {
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  listContent: {
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  resetFiltersBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resetFiltersText: {
    fontSize: 13,
    fontWeight: '800',
  },
  floatingCart: {
    position: 'absolute',
    left: 14,
    right: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
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
    fontSize: 14,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewCartText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sortOptionText: {
    fontSize: 14,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    paddingTop: 8,
  },
});
