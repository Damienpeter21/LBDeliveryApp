import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, EmptyState, Skeleton, useStatusModal } from '../../../components';
import { API_SETTINGS } from '../../../app/config';
import { useTheme } from '../../../theme';
import { useAuth } from '../../auth';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Product } from '../types/product';
import { mapOdooProductToProduct } from '../utils/productMapper';
import {
  addProductReview,
  getAllProductReviews,
  getProductDetails,
} from '../services/ProductActions';

interface ProductDetailsScreenProps {
  product: Product;
  onBack: () => void;
  onNavigateToCart: () => void;
  onRequireAuthForCheckout: () => void;
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

interface RatingStatusMeta {
  status: 'Good' | 'Average' | 'Bad' | 'New';
  subStatus: string;
  color: string;
  bg: string;
  icon: string;
}

const getRatingStatus = (numRating: number | string): RatingStatusMeta => {
  const r = Number(numRating) || 0;
  if (r <= 0) {
    return {
      status: 'New',
      subStatus: 'No ratings yet',
      color: '#6B7280', // Neutral Slate Gray
      bg: '#F3F4F6',
      icon: 'sparkles-outline',
    };
  } else if (r >= 4) {
    return {
      status: 'Good',
      subStatus: r === 5 ? 'Excellent' : 'Good',
      color: '#15803D', // Green
      bg: '#DCFCE7', // Soft Light Green
      icon: 'thumbs-up',
    };
  } else if (r >= 2.5) {
    return {
      status: 'Average',
      subStatus: 'Average',
      color: '#D97706', // Amber / Warning
      bg: '#FEF3C7', // Soft Light Amber
      icon: 'remove-circle',
    };
  } else {
    return {
      status: 'Bad',
      subStatus: r === 2 ? 'Below Average' : 'Poor',
      color: '#DC2626', // Red / Error
      bg: '#FEE2E2', // Soft Light Red
      icon: 'thumbs-down',
    };
  }
};

const getDisplayReviewText = (reviewText: string | undefined, numRating: number | string): string => {
  const clean = (reviewText || '').trim();
  const r = Number(numRating) || 0;

  // If review is empty or the generic static string "Good" / "Great" from test data
  if (!clean || clean.toLowerCase() === 'good' || clean.toLowerCase() === 'great') {
    if (r <= 2) {
      return 'Bad experience. Product quality or freshness did not meet expectations.';
    }
    if (r === 3) {
      return 'Average product. It was satisfactory but has scope for improvement.';
    }
    return clean || 'Good quality product! Fresh and delivered promptly.';
  }
  return clean;
};

export const ProductDetailsScreen: React.FC<ProductDetailsScreenProps> = ({
  product: initialProduct,
  onBack,
  onNavigateToCart,
  onRequireAuthForCheckout,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { addToCart, items, updateQuantity } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { showStatusModal } = useStatusModal();

  const [imageError, setImageError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);
  const [heroImageUri, setHeroImageUri] = useState<string | undefined>(undefined);
  const [liveDetails, setLiveDetails] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [newRating, setNewRating] = useState<number>(5);
  const [newReviewText, setNewReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const product = React.useMemo(
    () => (initialProduct ? mapOdooProductToProduct(initialProduct) : null),
    [initialProduct],
  );

  useEffect(() => {
    setHeroImageUri(product?.imageUrl);
    setImageError(false);
    setTriedFallback(false);
  }, [product?.id, product?.imageUrl]);

  // 1. Fetch live product details (Postman: "Over Product All Rationgs")
  useEffect(() => {
    if (!product?.id) return;
    let isMounted = true;
    getProductDetails(product.id)
      .then(res => {
        const details = Array.isArray(res?.result) ? res.result[0] : res?.result;
        if (isMounted && details) {
          setLiveDetails(details);
        }
      })
      .catch(err => console.warn('getProductDetails error:', err));

    return () => {
      isMounted = false;
    };
  }, [product?.id]);

  const targetTmplId = React.useMemo(() => {
    if (!product) return null;
    const rawTmpl = (product as any)?.product_tmpl_id;
    if (rawTmpl) {
      return Array.isArray(rawTmpl) ? rawTmpl[0] : rawTmpl;
    }
    return product.id;
  }, [product]);

  // 2. Fetch all product reviews (Postman: "All my rationgs")
  const loadProductReviews = async () => {
    if (!targetTmplId) return;
    setLoadingReviews(true);
    try {
      // Query reviews strictly for this product template from API
      const res = await getAllProductReviews({ productTmplId: targetTmplId });
      const rawList = Array.isArray(res?.result) ? res.result : [];

      // Only include reviews that genuinely match this product template
      const productReviews = rawList.filter((r: any) => {
        if (!r.product_tmpl_id) return false;
        const revTmplId = Array.isArray(r.product_tmpl_id) ? r.product_tmpl_id[0] : r.product_tmpl_id;
        return String(revTmplId) === String(targetTmplId) || String(revTmplId) === String(product?.id);
      });

      // ONLY display genuine API reviews for this product. No fallback to other products' reviews!
      setReviews(productReviews);
    } catch (err) {
      console.warn('getAllProductReviews error:', err);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    loadProductReviews();
  }, [targetTmplId]);

  // 3. Submit Customer Review (Postman: "Customer Add Ratings")
  const handleSubmitReview = async () => {
    if (!targetTmplId) return;
    if (!newReviewText.trim()) {
      showStatusModal({
        type: 'warning',
        title: 'Review Required',
        message: 'Please enter your thoughts before submitting.',
      });
      return;
    }

    setSubmittingReview(true);
    try {
      const partnerId = user?.partnerId || user?.id || 2;
      await addProductReview({
        productTmplId: targetTmplId,
        partnerId,
        rating: newRating,
        review: newReviewText.trim(),
      });

      setShowReviewModal(false);
      setNewReviewText('');
      showStatusModal({
        type: 'success',
        title: 'Review Submitted',
        message: 'Thank you! Your verified review has been submitted.',
      });
      loadProductReviews();
    } catch (err: any) {
      console.error('Error submitting review:', err);
      showStatusModal({
        type: 'error',
        title: 'Submission Error',
        message: 'Failed to submit review. Please try again.',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const isFavorite = product ? isInWishlist(product.id) : false;

  const cartItem = items.find(item => String(item.product.id) === String(product?.id));
  const quantity = cartItem ? cartItem.quantity : 0;

  const handleBuyNow = () => {
    if (!product) return;
    if (quantity === 0) {
      addToCart(product, 1);
    }
    if (!isAuthenticated) {
      onRequireAuthForCheckout();
    } else {
      onNavigateToCart();
    }
  };

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Product Details" onBack={onBack} />
        <EmptyState
          iconName="cube-outline"
          badgeIcon="alert-circle"
          title="Product Unavailable"
          description="The product you are looking for is currently unavailable or has been moved."
          actionLabel="Go Back"
          onAction={onBack}
        />
      </View>
    );
  }

  const category = product.category;
  const categoryIcon = getCategoryIcon(category);
  const discount = product.discountPercentage ?? 0;
  const originalPrice = product.originalPrice ?? product.price ?? 0;
  // Genuine ratings and reviews count purely from API / liveDetails
  const reviewsCount = reviews.length > 0
    ? reviews.length
    : (Number(liveDetails?.lb_review_count) || Number(product.reviewsCount) || 0);

  const reviewsAvgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : 0;

  const liveAvg = Number(liveDetails?.lb_rating_avg) || 0;
  const prodRating = Number(product.rating) || 0;

  const overallRatingScore = reviewsAvgRating > 0
    ? reviewsAvgRating
    : (liveAvg > 0 ? liveAvg : prodRating);

  const overallRatingMeta = getRatingStatus(overallRatingScore);
  const unit = product.unit ?? '1 unit';
  const deliveryTime = product.deliveryTime ?? '15 mins';
  const tags = product.tags && product.tags.length > 0 ? product.tags : ['BASKET Verified'];
  const description =
    product.description ||
    'High quality product sourced directly from verified suppliers and inspected for peak freshness and reliability.';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={product.name ?? 'Details'}
        onBack={onBack}
        rightAction={
          <TouchableOpacity
            onPress={() => toggleWishlist(product)}
            activeOpacity={0.7}
            style={{ padding: 4 }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? colors.error : colors.textPrimary}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Hero Image / Modern Placeholder */}
        <View style={[styles.heroContainer, { backgroundColor: colors.surfaceVariant }]}>
          {heroImageUri && !imageError ? (
            <Image
              source={{ uri: heroImageUri }}
              style={styles.heroImage}
              resizeMode="contain"
              onError={() => {
                if (!triedFallback && product?.id && heroImageUri?.includes('product.template')) {
                  setTriedFallback(true);
                  const baseUrl = (API_SETTINGS?.baseUrl || 'https://9d6f-122-187-121-222.ngrok-free.app').replace(/\/+$/, '');
                  setHeroImageUri(`${baseUrl}/web/image/product.product/${product.id}/image_512`);
                } else {
                  setImageError(true);
                }
              }}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <View
                style={[
                  styles.heroIconCircle,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name={categoryIcon} size={64} color={colors.primary} />
              </View>
              <View style={[styles.verifiedPill, { backgroundColor: colors.primaryVariant }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.secondary} style={{ marginRight: 4 }} />
                <Text style={[styles.verifiedPillText, { color: colors.onPrimary }]}>
                  LB Delivery 100% Quality Guaranteed
                </Text>
              </View>
            </View>

          )}

          {discount > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: '#DC2626' }]}>
              <Text style={[styles.discountBadgeText, { color: '#FFFFFF' }]}>
                {discount}% OFF
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
          {/* Tags & Express Delivery Badge */}
          <View style={styles.tagRow}>
            <View style={styles.tagChipsList}>
              {tags.map((tag, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                </View>
              ))}
            </View>

            <View style={styles.deliveryBadge}>
              <Ionicons name="flash" size={13} color={colors.secondary} style={{ marginRight: 3 }} />
              <Text style={[styles.deliveryInfo, { color: colors.primary }]}>
                {deliveryTime}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {product.name}
          </Text>

          {/* Unit, Category & Rating */}
          <View style={styles.metaRow}>
            <Text style={[styles.unit, { color: colors.textSecondary }]}>
              {unit}{category ? ` • ${category}` : ''}
            </Text>
            {overallRatingScore > 0 ? (
              <View style={[styles.ratingBadge, { backgroundColor: colors.surfaceVariant, borderColor: colors.warning }]}>
                <Ionicons name="star" size={12} color={colors.warning} style={{ marginRight: 3 }} />
                <Text style={[styles.ratingText, { color: colors.textPrimary }]}>
                  {overallRatingScore.toFixed(1)} ({reviewsCount})
                </Text>
              </View>
            ) : (
              <View style={[styles.ratingBadge, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                <Ionicons name="sparkles-outline" size={12} color={colors.primary} style={{ marginRight: 3 }} />
                <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                  New
                </Text>
              </View>
            )}
          </View>

          {/* Price Row with Savings pill */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.textPrimary }]}>
              ₹{product.price ?? 0}
            </Text>
            {originalPrice > (product.price ?? 0) && (
              <Text style={[styles.originalPrice, { color: colors.textTertiary }]}>
                MRP ₹{originalPrice}
              </Text>
            )}
            <Text style={[styles.inclusiveText, { color: colors.textSecondary }]}>
              (Inclusive of all taxes)
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Product Highlights */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Product Highlights
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {description}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Customer Reviews Section (Postman: "All my rationgs" & "Customer Add Ratings") */}
          <View style={styles.reviewsHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 2 }]}>
                Customer Ratings & Reviews
              </Text>
              <View style={styles.overallRatingRow}>
                {overallRatingScore > 0 ? (
                  <>
                    <Ionicons name="star" size={15} color={colors.warning} style={{ marginRight: 4 }} />
                    <Text style={[styles.overallRatingVal, { color: colors.textPrimary }]}>
                      {overallRatingScore.toFixed(1)}
                    </Text>
                    <View
                      style={[
                        styles.overallStatusBadge,
                        {
                          backgroundColor: overallRatingMeta.bg,
                          borderColor: overallRatingMeta.color,
                        },
                      ]}
                    >
                      <Text style={[styles.overallStatusBadgeText, { color: overallRatingMeta.color }]}>
                        {overallRatingMeta.status}
                      </Text>
                    </View>
                    <Text style={[styles.overallRatingSub, { color: colors.textSecondary }]}>
                      • {reviewsCount} {reviewsCount === 1 ? 'verified rating' : 'verified ratings'}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.overallRatingSub, { color: colors.textSecondary, marginLeft: 0 }]}>
                    No ratings yet • Be the first to rate!
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (!isAuthenticated) {
                  onRequireAuthForCheckout();
                  return;
                }
                setShowReviewModal(true);
              }}
              style={[styles.writeReviewBtn, { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }]}
            >
              <Ionicons name="create-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.writeReviewBtnText, { color: colors.primary }]}>
                Write Review
              </Text>
            </TouchableOpacity>
          </View>

          {loadingReviews ? (
            <View style={{ gap: 10, marginVertical: 10 }}>
              {[1, 2].map(i => (
                <View
                  key={`rev_skel_${i}`}
                  style={[
                    styles.reviewItemCard,
                    {
                      backgroundColor: colors.surfaceVariant,
                      borderColor: colors.border,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Skeleton width={42} height={20} borderRadius={6} style={{ marginRight: 8 }} />
                    <Skeleton width={70} height={20} borderRadius={10} style={{ marginRight: 10 }} />
                    <Skeleton width={110} height={14} borderRadius={4} />
                  </View>
                  <Skeleton width="90%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="65%" height={14} borderRadius={4} />
                </View>
              ))}
            </View>
          ) : reviews.length > 0 ? (
            <View style={styles.reviewsList}>
              {reviews.map((rev, idx) => {
                const revRating = Number(rev.rating) || 5;
                const ratingMeta = getRatingStatus(revRating);
                const reviewerName = Array.isArray(rev.partner_id)
                  ? rev.partner_id[1]
                  : 'Verified Customer';
                const reviewComment = getDisplayReviewText(rev.review, revRating);

                return (
                  <View
                    key={rev.id || idx}
                    style={[
                      styles.reviewItemCard,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <View style={styles.reviewItemTop}>
                      <View style={[styles.starBadge, { backgroundColor: ratingMeta.color }]}>
                        <Text style={[styles.starBadgeText, { color: '#FFFFFF' }]}>
                          {revRating} ★
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.ratingStatusPill,
                          {
                            backgroundColor: ratingMeta.bg,
                            borderColor: ratingMeta.color,
                          },
                        ]}
                      >
                        <Ionicons
                          name={ratingMeta.icon as any}
                          size={11}
                          color={ratingMeta.color}
                          style={{ marginRight: 3 }}
                        />
                        <Text style={[styles.ratingStatusPillText, { color: ratingMeta.color }]}>
                          {ratingMeta.status.toUpperCase()}
                        </Text>
                      </View>

                      <Text style={[styles.reviewerName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {reviewerName}
                      </Text>

                      <View style={styles.verifiedBuyerTag}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.primary} style={{ marginRight: 2 }} />
                        <Text style={[styles.verifiedBuyerText, { color: colors.primary }]}>Verified</Text>
                      </View>
                    </View>
                    <Text style={[styles.reviewContentText, { color: colors.textSecondary }]}>
                      {reviewComment}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noReviewsBox}>
              <Text style={[styles.noReviewsText, { color: colors.textSecondary }]}>
                No reviews yet. Be the first to share your experience!
              </Text>
            </View>
          )}

          {/* Trust Guarantees */}
          <View style={styles.featuresWrapper}>
            <View style={styles.featureRow}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                100% Genuine & Verified Product Quality
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="flash" size={18} color={colors.secondary} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                Express Delivery with Live Order Tracking
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="repeat" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                Hassle-free 7 Days Easy Returns & Replacement
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Write a Review Modal (Postman: "Customer Add Ratings") */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReviewModal(false)}
        >
          <View
            style={[
              styles.reviewModalContent,
              { backgroundColor: colors.surface, borderRadius: borderRadius.xl },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeading, { color: colors.textPrimary }]}>
                Rate & Review Product
              </Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.productNameInModal, { color: colors.textSecondary }]}>
              {product.name}
            </Text>

            {/* 1-5 Star Picker */}
            <View style={styles.starPickerRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setNewRating(star)}
                  style={{ padding: 6 }}
                >
                  <Ionicons
                    name={star <= newRating ? 'star' : 'star-outline'}
                    size={34}
                    color={star <= newRating ? colors.warning : colors.textTertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.starSelectedHint, { color: getRatingStatus(newRating).color }]}>
              {newRating >= 4
                ? `${newRating === 5 ? 'Excellent' : 'Good'} (${newRating}/5) • Good`
                : newRating === 3
                ? 'Average (3/5) • Average'
                : `${newRating === 2 ? 'Below Average' : 'Poor'} (${newRating}/5) • Bad`}
            </Text>

            {/* Review Comment Input */}
            <TextInput
              style={[
                styles.reviewTextInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  borderRadius: borderRadius.md,
                },
              ]}
              placeholder="Write your review here... (e.g. fresh quality, great packaging)"
              placeholderTextColor={colors.inputPlaceholder}
              value={newReviewText}
              onChangeText={setNewReviewText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSubmitReview}
              disabled={submittingReview || !newReviewText.trim()}
              style={[
                styles.submitReviewBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: borderRadius.md,
                  opacity: submittingReview || !newReviewText.trim() ? 0.6 : 1,
                },
              ]}
            >
              {submittingReview ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={[styles.submitReviewBtnText, { color: colors.onPrimary }]}>
                  Submit Verified Review
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom Bar with Safe Insets */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        {quantity === 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (!isAuthenticated) {
                onRequireAuthForCheckout();
                return;
              }
              addToCart(product, 1);
            }}
            style={[
              styles.cartActionButton,
              {
                borderColor: colors.primary,
                borderWidth: 1.5,
                borderRadius: borderRadius.md,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Text style={[styles.cartActionText, { color: colors.primary }]}>
              ADD TO CART
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.stepperContainer,
              {
                borderColor: colors.primary,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => updateQuantity(product.id, quantity - 1)}
              style={styles.stepperBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={18} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.stepperQty, { color: colors.primary }]}>{quantity}</Text>
            <TouchableOpacity
              onPress={() => updateQuantity(product.id, quantity + 1)}
              style={styles.stepperBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleBuyNow}
          style={[
            styles.buyNowButton,
            {
              backgroundColor: colors.primary,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.buyNowText, { color: colors.onPrimary }]}>BUY NOW</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  backHomeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backHomeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  heroContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    // resizeMode="contain" set inline — shows full product without cropping
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  heroIconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailsCard: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagChipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryInfo: {
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 16,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
  },
  originalPrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  inclusiveText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  featuresWrapper: {
    marginTop: 14,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13.5,
    fontWeight: '600',
    flex: 1,
  },
  bottomBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  cartActionButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepperContainer: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  stepperBtn: {
    padding: 8,
  },
  stepperQty: {
    fontSize: 16,
    fontWeight: '800',
  },
  buyNowButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buyNowText: {
    fontSize: 14,
    fontWeight: '800',
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overallRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  overallRatingVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  overallRatingSub: {
    fontSize: 12,
    marginLeft: 4,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  writeReviewBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  reviewsList: {
    gap: 8,
    marginBottom: 14,
  },
  reviewItemCard: {
    padding: 12,
    borderWidth: 1,
  },
  reviewItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  overallStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 6,
  },
  overallStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  starBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  starBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  ratingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 8,
  },
  ratingStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  reviewerName: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  verifiedBuyerTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBuyerText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reviewContentText: {
    fontSize: 12,
    lineHeight: 16,
  },
  noReviewsBox: {
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  noReviewsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewModalContent: {
    width: '100%',
    maxWidth: 380,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  productNameInModal: {
    fontSize: 13,
    marginBottom: 16,
  },
  starPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  starSelectedHint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  reviewTextInput: {
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    minHeight: 90,
    marginBottom: 16,
  },
  submitReviewBtn: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReviewBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
