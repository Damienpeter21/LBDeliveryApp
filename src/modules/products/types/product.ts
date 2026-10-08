export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  discountPercentage: number;
  unit: string;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  deliveryTime: string;
  description: string;
  imageUrl?: string;
  tags?: string[];
  // Raw Odoo optional fields for fallback compatibility
  list_price?: number;
  mrp_price?: number;
  discount_percentage?: number;
  discounted_price?: number;
  categ_id?: [number, string] | boolean;
  qty_available?: number;
  uom_id?: [number, string] | boolean;
  uom_name?: string;
  delivery_time_days?: number;
  sale_delay?: number;
  is_deal_of_the_day?: boolean;
  description_sale?: string | boolean;
  product_tag_ids?: number[];
  product_variant_id?: number | [number, string];
  product_variant_ids?: number[];
  product_tmpl_id?: number | [number, string];
  templateId?: number;
  lb_rating_avg?: number;
  lb_review_count?: number;
}

export interface OdooProductRaw {
  id: number;
  name: string;
  list_price?: number;
  mrp_price?: number;
  discount_percentage?: number;
  discounted_price?: number;
  categ_id?: [number, string] | boolean;
  qty_available?: number;
  uom_id?: [number, string] | boolean;
  uom_name?: string;
  delivery_time_days?: number;
  sale_delay?: number;
  is_deal_of_the_day?: boolean;
  description_sale?: string | boolean;
  description?: string | boolean;
  product_tag_ids?: number[];
  product_variant_id?: number | [number, string];
  product_variant_ids?: number[];
  product_tmpl_id?: number | [number, string];
  templateId?: number;
  lb_rating_avg?: number;
  lb_review_count?: number;
  imageUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  iconName?: string;
  itemCount?: number;
  product_count?: number;
  image_1920?: string | boolean;
  imageUrl?: string;
  complete_name?: string;
  parent_id?: [number, string] | boolean;
}

