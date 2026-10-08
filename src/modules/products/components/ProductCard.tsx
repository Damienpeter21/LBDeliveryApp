import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_SETTINGS } from '../../../app/config';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth/hooks/useAuth';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Product } from '../types/product';

const { width } = Dimensions.get('window');
const DEFAULT_CARD_WIDTH = (width - 36) / 2;

interface ProductCardProps {
  product: Product;
  cardWidth?: number;
  onPress: (product: Product) => void;
  onRequireAuth?: () => void;
}

const getCategoryIcon = (category?: string): string => {
  switch ((category ?? '').toLowerCase()) {
    case 'vegetables':
      return 'leaf-outline';
    case 'fruits':
      return 'nutrition-outline';
    case 'grocery':
      return 'basket-outline';
    case 'electronics':
      return 'headset-outline';
    case 'dairy':
      return 'cafe-outline';
    case 'snacks':
      return 'fast-food-outline';
    default:
      return 'cube-outline';
  }
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cardWidth,
  onPress,
  onRequireAuth,
}) => {
  const { colors, spacing, borderRadius } = useTheme();
  const { isAuthenticated } = useAuth();
  const { items, addToCart, updateQuantity } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  if (!product) return null;

  const productId = String(product.id ?? '');
  const isFavorite = productId ? isInWishlist(productId) : false;

  const cartItem = productId ? items.find(item => String(item?.product?.id) === productId) : undefined;
  const quantity = cartItem ? cartItem.quantity : 0;

  const handleAdd = (e: any) => {
    e?.stopPropagation?.();
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    addToCart(product, 1);
  };

  const handleIncrement = (e: any) => {
    e?.stopPropagation?.();
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrement = (e: any) => {
    e?.stopPropagation?.();
    updateQuantity(product.id, quantity - 1);
  };

  const rawItem = product as any;
  const category =
    Array.isArray(rawItem?.categ_id) && rawItem.categ_id[1]
      ? String(rawItem.categ_id[1]).split('/').pop()?.trim()
      : product.category ?? 'Grocery';

  const categoryIcon = getCategoryIcon(category);

  const price =
    product.price !== undefined
      ? product.price
      : rawItem.discounted_price !== undefined && rawItem.discounted_price > 0
      ? rawItem.discounted_price
      : rawItem.list_price ?? 0;

  const rawOriginalPrice =
    product.originalPrice !== undefined && product.originalPrice > 0
      ? product.originalPrice
      : rawItem.mrp_price && rawItem.mrp_price > 0
      ? rawItem.mrp_price
      : rawItem.list_price ?? price;

  const originalPrice = rawOriginalPrice > price ? rawOriginalPrice : price;

  const discount =
    product.discountPercentage !== undefined && product.discountPercentage > 0
      ? product.discountPercentage
      : rawItem.discount_percentage !== undefined && rawItem.discount_percentage > 0
      ? rawItem.discount_percentage
      : originalPrice > price && originalPrice > 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const rating =
    product.rating !== undefined && product.rating > 0
      ? product.rating
      : rawItem.lb_rating_avg && rawItem.lb_rating_avg > 0
      ? rawItem.lb_rating_avg
      : 0;

  let unit =
    product.unit ??
    rawItem.uom_name ??
    (Array.isArray(rawItem.uom_id) ? rawItem.uom_id[1] : '1 unit');

  const weightMatch = (product.name ?? '').match(
    /(\d+(\.\d+)?\s*(kg|g|gm|l|ml|ltr|pack|pcs|units|kg|g|g\b|kg\b))/i,
  );
  if (weightMatch && (!unit || unit === 'Units' || unit === 'Unit' || unit === '1 unit')) {
    unit = weightMatch[0].toUpperCase();
  }

  const deliveryTime =
    product.deliveryTime ??
    (rawItem.delivery_time_days !== undefined
      ? rawItem.delivery_time_days === 0
        ? '15 mins'
        : rawItem.delivery_time_days === 1
        ? '1 day'
        : `${rawItem.delivery_time_days} days`
      : '15 mins');

  // Image resolution: supports base64, template route, and variant route
  const rawImage = product.imageUrl || rawItem.image_512 || rawItem.image_1920;
  const initialImageUrl = React.useMemo(() => {
    if (typeof rawImage === 'string' && rawImage.trim()) {
      if (rawImage.startsWith('http://') || rawImage.startsWith('https://') || rawImage.startsWith('data:image')) {
        return rawImage.trim();
      }
      return `data:image/jpeg;base64,${rawImage.trim()}`;
    }
    const baseUrl = (API_SETTINGS?.baseUrl || 'https://9d6f-122-187-121-222.ngrok-free.app').replace(/\/+$/, '');
    if (rawItem.product_tmpl_id) {
      const tmplId = Array.isArray(rawItem.product_tmpl_id) ? rawItem.product_tmpl_id[0] : rawItem.product_tmpl_id;
      if (tmplId) return `${baseUrl}/web/image/product.template/${tmplId}/image_512`;
    }
    if (rawItem.id) {
      return `${baseUrl}/web/image/product.template/${rawItem.id}/image_512`;
    }
    return undefined;
  }, [rawImage, rawItem.id, rawItem.product_tmpl_id]);

  const [currentImageUrl, setCurrentImageUrl] = React.useState<string | undefined>(initialImageUrl);
  const [triedFallback, setTriedFallback] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  // Reset image states when product changes (fixes card recycling bug in FlatList)
  React.useEffect(() => {
    setCurrentImageUrl(initialImageUrl);
    setTriedFallback(false);
    setImageError(false);
  }, [initialImageUrl, product.id]);

  const handleImageError = () => {
    if (!triedFallback && rawItem.id && currentImageUrl?.includes('product.template')) {
      // Auto-fallback to product.product route if product.template fails
      setTriedFallback(true);
      const baseUrl = (API_SETTINGS?.baseUrl || 'https://9d6f-122-187-121-222.ngrok-free.app').replace(/\/+$/, '');
      setCurrentImageUrl(`${baseUrl}/web/image/product.product/${rawItem.id}/image_512`);
    } else {
      setImageError(true);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(product)}
      style={[
        styles.card,
        {
          width: cardWidth ?? DEFAULT_CARD_WIDTH,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          padding: spacing.sm + 2,
        },
      ]}
    >
      {/* Discount Badge */}
      {discount > 0 && (
        <View
          style={[
            styles.discountBadge,
            { backgroundColor: '#DC2626' },
          ]}
        >
          <Text
            style={[
              styles.discountText,
              { color: '#FFFFFF' },
            ]}
          >
            {discount}% OFF
          </Text>
        </View>
      )}

      {/* Product Image / Modern Placeholder */}
      <View
        style={[
          styles.imageContainer,
          {
            backgroundColor: colors.surfaceVariant,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        {currentImageUrl && !imageError ? (
          <Image
            source={{ uri: currentImageUrl }}
            style={styles.productImage}
            resizeMode="contain"
            onError={handleImageError}
          />
        ) : (
          <View style={styles.placeholderBox}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name={categoryIcon} size={28} color={colors.primary} />
            </View>
            <Text style={[styles.placeholderLabel, { color: colors.textSecondary }]}>
              {(category ?? 'ESSENTIAL').toUpperCase()}
            </Text>
          </View>
        )}

        {/* Floating Wishlist Heart Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            toggleWishlist(product);
          }}
          style={[
            styles.wishlistHeartBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={16}
            color={isFavorite ? colors.error : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Delivery Time & Rating */}
      <View style={styles.metaRow}>
        <View style={[styles.timerBadge, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name="time-outline" size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
          <Text style={[styles.deliveryTime, { color: colors.textSecondary }]}>
            {deliveryTime}
          </Text>
        </View>
        {Number(rating) > 0 ? (
          <View
            style={[
              styles.ratingBadge,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.warning,
              },
            ]}
          >
            <Ionicons name="star" size={10} color={colors.warning} style={{ marginRight: 2 }} />
            <Text style={[styles.ratingText, { color: colors.textPrimary }]}>
              {Number(rating).toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Title */}
      <Text
        style={[styles.title, { color: colors.textPrimary }]}
        numberOfLines={2}
      >
        {product.name ?? 'Product'}
      </Text>

      {/* Unit Row */}
      <Text style={[styles.unit, { color: colors.textSecondary }]} numberOfLines={1}>
        {unit}
      </Text>

      {/* Category Row */}
      {category ? (
        <View style={[styles.categoryPill, { backgroundColor: colors.surfaceVariant }]}>
          <Text style={[styles.categoryText, { color: colors.primary }]} numberOfLines={1}>
            {category}
          </Text>
        </View>
      ) : null}

      {/* Price & Action Row */}
      <View style={styles.bottomRow}>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: colors.textPrimary }]}>
            ₹{price}
          </Text>
          {originalPrice > price && (
            <Text style={[styles.originalPrice, { color: colors.textTertiary }]}>
              ₹{originalPrice}
            </Text>
          )}
        </View>

        {quantity === 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAdd}
            style={[
              styles.addButton,
              {
                borderColor: colors.primary,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.sm,
              },
            ]}
          >
            <Text style={[styles.addButtonText, { color: colors.primary }]}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.stepperContainer,
              {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.sm,
              },
            ]}
          >
            <TouchableOpacity onPress={handleDecrement} style={styles.stepperBtn} activeOpacity={0.7}>
              <Ionicons name="remove" size={14} color={colors.onPrimary} />
            </TouchableOpacity>
            <Text style={[styles.quantityText, { color: colors.onPrimary }]}>{quantity}</Text>
            <TouchableOpacity onPress={handleIncrement} style={styles.stepperBtn} activeOpacity={0.7}>
              <Ionicons name="add" size={14} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginVertical: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  discountText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  imageContainer: {
    height: 112,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
    padding: 4,
  },
  wishlistHeartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: '100%',
    // resizeMode="contain" is set inline; width/height fill the padded container
  },
  placeholderBox: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  placeholderLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  deliveryTime: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 2,
  },
  unit: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    marginBottom: 4,
    maxWidth: '100%',
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 3,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  originalPrice: {
    fontSize: 11.5,
    textDecorationLine: 'line-through',
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  stepperBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  quantityText: {
    fontSize: 12.5,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
});
