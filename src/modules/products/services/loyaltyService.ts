// src/modules/products/services/loyaltyService.ts
import { callOdooRpc } from '../../../app/config';

export interface LoyaltyCoupon {
  id: number;
  code: string;
  partner_id: false | [number, string];
  points: number;
  expiration_date: false | string;
  program_id: false | [number, string];
}

export class LoyaltyService {
  /**
   * Fetches active coupons and loyalty cards available for a partner.
   * Also includes public/general coupons where partner_id is false.
   *
   * @param partnerId User/Customer partner ID in Odoo
   */
  static async getCustomerCoupons(partnerId?: number | string): Promise<LoyaltyCoupon[]> {
    if (!partnerId) {
      return [];
    }
    const pid = Number(partnerId);
    if (!pid || isNaN(pid)) {
      return [];
    }

    try {
      // Query loyalty.card directly filtered by customer partner_id and active status
      const domain: any[] = [
        ['partner_id', '=', pid],
        ['active', '=', true],
      ];

      const res = await callOdooRpc<any>(
        'loyalty.card',
        'search_read',
        [domain],
        {
          fields: ['id', 'code', 'partner_id', 'points', 'expiration_date', 'program_id'],
          limit: 100,
        },
      );

      const cards: LoyaltyCoupon[] = Array.isArray(res?.result) ? res.result : [];
      const todayStr = new Date().toISOString().split('T')[0];

      return cards.filter(card => {
        // Must have discount points > 0
        if (!card.points || card.points <= 0) return false;

        // Check expiration date if set
        if (card.expiration_date && typeof card.expiration_date === 'string') {
          if (card.expiration_date < todayStr) return false;
        }

        // Verify card belongs to this customer
        if (card.partner_id) {
          const cardPid = Array.isArray(card.partner_id) ? card.partner_id[0] : card.partner_id;
          if (cardPid && Number(cardPid) !== pid) {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      console.warn('LoyaltyService.getCustomerCoupons error:', error);
      return [];
    }
  }

  /**
   * Validates a specific coupon code entered by the user.
   *
   * @param code The coupon promo code string
   * @param partnerId Optional partner ID to verify user ownership
   */
  static async validateCouponCode(
    code: string,
    partnerId?: number | string,
  ): Promise<{ success: boolean; coupon?: LoyaltyCoupon; message?: string }> {
    const cleanCode = (code || '').trim();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a valid coupon code.' };
    }

    const pid = partnerId ? Number(partnerId) : undefined;

    try {
      const domain: any[] = [
        ['code', '=', cleanCode],
        ['active', '=', true],
      ];

      if (pid && !isNaN(pid)) {
        domain.push(['partner_id', '=', pid]);
      }

      const res = await callOdooRpc<any>(
        'loyalty.card',
        'search_read',
        [domain],
        {
          fields: ['id', 'code', 'partner_id', 'points', 'expiration_date', 'program_id'],
          limit: 1,
        },
      );

      const cards: LoyaltyCoupon[] = Array.isArray(res?.result) ? res.result : [];
      if (cards.length === 0) {
        return { success: false, message: 'Coupon code not found or not valid for your account.' };
      }

      const coupon = cards[0];
      const todayStr = new Date().toISOString().split('T')[0];

      // Expiration check
      if (coupon.expiration_date && typeof coupon.expiration_date === 'string') {
        if (coupon.expiration_date < todayStr) {
          return { success: false, message: 'This coupon code has expired.' };
        }
      }

      // Check partner assignment if card is private
      if (coupon.partner_id && Array.isArray(coupon.partner_id)) {
        if (pid && coupon.partner_id[0] !== pid) {
          return { success: false, message: 'This coupon is assigned to another account.' };
        }
      }

      // Points check
      if (!coupon.points || coupon.points <= 0) {
        return { success: false, message: 'This coupon has zero discount balance.' };
      }

      return {
        success: true,
        coupon,
        message: `Coupon applied: ₹${coupon.points} discount!`,
      };
    } catch (error: any) {
      console.warn('LoyaltyService.validateCouponCode error:', error);
      return { success: false, message: error?.message || 'Failed to validate coupon code.' };
    }
  }
}
