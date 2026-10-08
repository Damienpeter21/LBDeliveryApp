import React from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, EmptyState } from '../../../components';
import { useTheme } from '../../../theme';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Product } from '../types/product';

interface WishlistScreenProps {
  onBack: () => void;
  onNavigateToProductDetails: (product: Product) => void;
  onNavigateToShop: () => void;
  onNavigateToCart: () => void;
}

export const WishlistScreen: React.FC<WishlistScreenProps> = ({
  onBack,
  onNavigateToProductDetails,
  onNavigateToShop,
  onNavigateToCart,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useTheme();
  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart, items } = useCart();

  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`My Wishlist (${wishlist.length})`}
        onBack={onBack}
        rightAction={
          wishlist.length > 0 ? (
            <TouchableOpacity onPress={clearWishlist} activeOpacity={0.7}>
              <Text style={[styles.clearAllText, { color: colors.error }]}>Clear</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {wishlist.length === 0 ? (
        <EmptyState
          iconName="heart-dislike-outline"
          badgeIcon="sparkles"
          title="Your Wishlist is Empty"
          description="You haven't saved any items yet. Browse our farm-fresh fruits, vegetables, and daily staples to bookmark your favorites!"
          actionLabel="Explore Catalog"
          onAction={onNavigateToShop}
        />
      ) : (
        <FlatList
          data={wishlist}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 30, 40) },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const inCartQty = items.find(i => i.product.id === item.id)?.quantity || 0;

            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onNavigateToProductDetails(item)}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: borderRadius.lg,
                  },
                ]}
              >
                {/* Product Thumbnail */}
                <View style={[styles.imageBox, { backgroundColor: colors.surfaceVariant }]}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name="basket-outline" size={32} color={colors.primary} />
                  )}

                  {/* 15 Mins Badge */}
                  <View style={[styles.deliveryBadge, { backgroundColor: colors.surface }]}>
                    <Ionicons name="flash" size={10} color={colors.secondary} />
                    <Text style={[styles.deliveryText, { color: colors.textPrimary }]}>
                      15 MINS
                    </Text>
                  </View>
                </View>

                {/* Product Info */}
                <View style={styles.infoCol}>
                  <View style={styles.headerRow}>
                    <Text
                      style={[styles.productName, { color: colors.textPrimary }]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    {/* Remove from Wishlist Heart Button */}
                    <TouchableOpacity
                      onPress={() => removeFromWishlist(item.id)}
                      activeOpacity={0.7}
                      style={styles.heartBtn}
                    >
                      <Ionicons name="heart" size={22} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.unitText, { color: colors.textSecondary }]}>
                    {item.unit}{item.category ? ` • ${item.category}` : ''}
                  </Text>

                  {/* Price & Cart Action Row */}
                  <View style={styles.bottomRow}>
                    <View style={styles.priceContainer}>
                      <Text style={[styles.price, { color: colors.textPrimary }]}>
                        ₹{item.price}
                      </Text>
                      {item.originalPrice > item.price && (
                        <Text style={[styles.originalPrice, { color: colors.textTertiary }]}>
                          ₹{item.originalPrice}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        handleAddToCart(item);
                        onNavigateToCart();
                      }}
                      style={[
                        styles.cartBtn,
                        {
                          backgroundColor: inCartQty > 0 ? colors.secondary : colors.primary,
                          borderRadius: borderRadius.md,
                        },
                      ]}
                    >
                      <Ionicons
                        name={inCartQty > 0 ? 'checkmark-circle' : 'cart-outline'}
                        size={15}
                        color={colors.onPrimary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.cartBtnText, { color: colors.onPrimary }]}>
                        {inCartQty > 0 ? `In Cart (${inCartQty})` : 'Add to Cart'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  imageBox: {
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 4,
  },
  image: {
    width: '100%',
    height: '100%',
    // resizeMode="contain" set inline — shows full product without cropping
  },
  deliveryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  deliveryText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    flex: 1,
    marginRight: 8,
  },
  heartBtn: {
    padding: 2,
  },
  unitText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 15.5,
    fontWeight: '900',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  cartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cartBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
