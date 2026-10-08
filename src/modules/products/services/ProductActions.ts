// src/modules/products/services/ProductActions.ts
import { callOdooRpc } from '../../../app/config';

/**
 * Fetch all active products (limited)
 * Postman: "GET Product Details" (Product item 1)
 */
export const getAllProducts = async (limit = 50): Promise<any> => {
  try {
    const res = await callOdooRpc(
      'product.template',
      'search_read',
      [
        [
          ['active', '=', true],
          ['sale_ok', '=', true],
        ],
      ],
      {
        fields: [
          'id',
          'name',
          'list_price',
          'mrp_price',
          'discount_percentage',
          'discounted_price',
          'categ_id',
          'qty_available',
          'uom_id',
          'uom_name',
          'delivery_time_days',
          'description_sale',
          'description',
          'product_tag_ids',
          'product_variant_id',
          'product_variant_ids',
          'lb_rating_avg',
          'lb_review_count',
          'image_512',
        ],
        order: 'id desc',
        ...(limit > 0 ? { limit } : {}),
      },
    );
    if (Array.isArray(res?.result) && res.result.length > 0) {
      return res;
    }
    // Fallback if sale_ok returns empty list
    return await callOdooRpc(
      'product.template',
      'search_read',
      [[['active', '=', true]]],
      {
        fields: [
          'id',
          'name',
          'list_price',
          'mrp_price',
          'discount_percentage',
          'discounted_price',
          'categ_id',
          'qty_available',
          'uom_id',
          'uom_name',
          'delivery_time_days',
          'description_sale',
          'description',
          'product_tag_ids',
          'product_variant_id',
          'product_variant_ids',
          'lb_rating_avg',
          'lb_review_count',
          'image_512',
        ],
        order: 'id desc',
        ...(limit > 0 ? { limit } : {}),
      },
    );
  } catch (error) {
    console.warn('getAllProducts error, falling back:', error);
    return await callOdooRpc(
      'product.template',
      'search_read',
      [[['active', '=', true]]],
      {
        fields: [
          'id',
          'name',
          'list_price',
          'mrp_price',
          'discount_percentage',
          'discounted_price',
          'categ_id',
          'qty_available',
          'uom_id',
          'uom_name',
          'delivery_time_days',
          'description_sale',
          'product_variant_id',
          'product_variant_ids',
          'image_512',
        ],
        limit: Math.max(limit, 20),
      },
    ).catch(() => ({ result: [] }));
  }
};

/**
 * Fetch products for a specific category
 * Postman: "GET Product By Category" (Product item 2) & "Products Category Wise" (Product item 5)
 */
export const getProductsByCategory = async (
  categoryId: string | number,
  limit = 0,
): Promise<any> => {
  return callOdooRpc(
    'product.template',
    'search_read',
    [
      [
        ['categ_id', '=', Number(categoryId)],
        ['sale_ok', '=', true],
      ],
    ],
    {
      fields: [
        'id',
        'name',
        'list_price',
        'mrp_price',
        'discount_percentage',
        'discounted_price',
        'categ_id',
        'qty_available',
        'uom_id',
        'uom_name',
        'delivery_time_days',
        'description_sale',
        'lb_rating_avg',
        'lb_review_count',
        'product_tag_ids',
        'product_variant_id',
        'product_variant_ids',
      ],
      ...(limit > 0 ? { limit } : {}),
    },
  );
};

/**
 * Search products by name
 * Postman: "GET Product Search" (Product item 3)
 */
export const searchProducts = async (query: string, limit = 20): Promise<any> => {
  return callOdooRpc(
    'product.template',
    'search_read',
    [
      [
        ['name', 'ilike', query],
        ['sale_ok', '=', true],
      ],
    ],
    {
      fields: [
        'id',
        'name',
        'list_price',
        'mrp_price',
        'discount_percentage',
        'discounted_price',
        'categ_id',
        'qty_available',
        'uom_id',
        'uom_name',
        'delivery_time_days',
        'description_sale',
        'description',
        'product_tag_ids',
        'lb_rating_avg',
        'lb_review_count',
        'product_variant_id',
        'product_variant_ids',
        'image_512',
      ],
      limit,
    },
  );
};

/**
 * Read specific product details with ratings
 * Postman: "Over Product All Rationgs" (Product item 9)
 */
export const getProductDetails = async (productId: number | string): Promise<any> => {
  try {
    const res = await callOdooRpc(
      'product.template',
      'read',
      [[Number(productId)]],
      {
        fields: [
          'id',
          'name',
          'list_price',
          'mrp_price',
          'discount_percentage',
          'discounted_price',
          'categ_id',
          'qty_available',
          'uom_id',
          'uom_name',
          'delivery_time_days',
          'description_sale',
          'description',
          'product_tag_ids',
          'product_variant_id',
          'product_variant_ids',
          'lb_rating_avg',
          'lb_review_count',
        ],
      },
    );
    if (Array.isArray(res?.result) && res.result.length > 0) {
      return res;
    }
  } catch (_) {}

  // Fallback: If not found in product.template, try reading from product.product
  return callOdooRpc(
    'product.product',
    'read',
    [[Number(productId)]],
    {
      fields: [
        'id',
        'name',
        'list_price',
        'mrp_price',
        'discount_percentage',
        'discounted_price',
        'categ_id',
        'qty_available',
        'uom_id',
        'uom_name',
        'delivery_time_days',
        'description_sale',
        'description',
        'product_tag_ids',
        'product_tmpl_id',
        'lb_rating_avg',
        'lb_review_count',
      ],
    },
  ).catch(() => ({ result: [] }));
};

/**
 * Fetch specific products by product.product IDs
 * Used for loyalty program banners, promotional triggers (trigger_product_ids)
 * Model: product.product
 */
export const getProductsByProductIds = async (
  productIds: (number | string)[],
): Promise<any> => {
  const numericIds = Array.from(
    new Set(
      (productIds || [])
        .map(id => Number(id))
        .filter(id => !isNaN(id) && id > 0),
    ),
  );

  if (numericIds.length === 0) {
    return { result: [] };
  }

  const fields = [
    'id',
    'name',
    'list_price',
    'mrp_price',
    'discount_percentage',
    'discounted_price',
    'categ_id',
    'qty_available',
    'virtual_available',
    'free_qty',
    'uom_id',
    'uom_name',
    'delivery_time_days',
    'description_sale',
    'description',
    'product_tag_ids',
    'product_tmpl_id',
    'lb_rating_avg',
    'lb_review_count',
    'image_512',
    'image_1920',
  ];

  try {
    const res = await callOdooRpc(
      'product.product',
      'search_read',
      [[['id', 'in', numericIds]]],
      {
        fields,
      },
    );
    if (Array.isArray(res?.result) && res.result.length > 0) {
      return res;
    }

    // Direct read fallback
    const readRes = await callOdooRpc(
      'product.product',
      'read',
      [numericIds],
      {
        fields,
      },
    );
    if (Array.isArray(readRes?.result) && readRes.result.length > 0) {
      return readRes;
    }
    return { result: [] };
  } catch (err) {
    console.warn('[getProductsByProductIds] search_read failed, trying direct read:', err);
    try {
      const readRes = await callOdooRpc(
        'product.product',
        'read',
        [numericIds],
        {
          fields,
        },
      );
      return readRes?.result ? readRes : { result: [] };
    } catch (readErr) {
      console.error('[getProductsByProductIds] read fallback error:', readErr);
      return { result: [] };
    }
  }
};

/**
 * Fetch product availability
 * Postman: "GET Product Availability" (Product item 4)
 */
export const getProductAvailability = async (limit = 20): Promise<any> => {
  return callOdooRpc(
    'product.product',
    'search_read',
    [
      [
        ['qty_available', '>', 0],
        ['sale_ok', '=', true],
      ],
    ],
    {
      fields: [
        'id',
        'name',
        'list_price',
        'mrp_price',
        'discount_percentage',
        'discounted_price',
        'categ_id',
        'qty_available',
        'virtual_available',
        'free_qty',
        'uom_id',
        'uom_name',
        'delivery_time_days',
        'description_sale',
        'description',
        'product_tag_ids',
        'lb_rating_avg',
        'lb_review_count',
      ],
      limit,
    },
  );
};

/**
 * Submit customer product review & rating
 * Postman: "Customer Add Ratings" (Product item 10)
 */
export const addProductReview = async (payload: {
  productTmplId: number | string;
  partnerId: number | string;
  rating: string | number;
  review: string;
}): Promise<any> => {
  return callOdooRpc(
    'lb.product.review',
    'create',
    [
      {
        product_tmpl_id: Number(payload.productTmplId),
        partner_id: Number(payload.partnerId),
        rating: String(payload.rating),
        review: payload.review,
        state: 'approved',
        active: true,
      },
    ],
  );
};

/**
 * Fetch customer product reviews
 * Postman: "All my rationgs" (Product item 11)
 * Supports querying all active reviews, by specific product, or by customer partner
 */
export const getAllProductReviews = async (
  limitOrOptions:
    | number
    | {
        productTmplId?: number | string;
        partnerId?: number | string;
        limit?: number;
        offset?: number;
      } = 100,
  offset = 0,
): Promise<any> => {
  let limit = 100;
  let currentOffset = offset;
  const domain: any[] = [['active', '=', true]];

  if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
    if (limitOrOptions.productTmplId) {
      domain.push(['product_tmpl_id', '=', Number(limitOrOptions.productTmplId)]);
    }
    if (limitOrOptions.partnerId) {
      domain.push(['partner_id', '=', Number(limitOrOptions.partnerId)]);
    }
    if (limitOrOptions.limit !== undefined) limit = limitOrOptions.limit;
    if (limitOrOptions.offset !== undefined) currentOffset = limitOrOptions.offset;
  } else if (typeof limitOrOptions === 'number') {
    limit = limitOrOptions;
  }

  return callOdooRpc(
    'lb.product.review',
    'search_read',
    [domain],
    {
      fields: [
        'id',
        'product_tmpl_id',
        'partner_id',
        'rating',
        'review',
        'state',
        'verified_purchase',
        'helpful_count',
        'create_date',
      ],
      order: 'create_date desc',
      limit,
      offset: currentOffset,
    },
  );
};
