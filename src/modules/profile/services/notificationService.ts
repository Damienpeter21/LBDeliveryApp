// src/modules/profile/services/notificationService.ts
import { callOdooRpc, ODOO_CONFIG } from '../../../app/config';

export class NotificationService {
  /**
   * Fetches pending notifications for the customer partner.
   * Postman: "GET Notifications" (Notifications item 1)
   */
  static async getNotifications(partnerId?: number | string): Promise<any> {
    if (!partnerId) {
      return { result: [] };
    }
    const pid = Number(partnerId);
    if (!pid || isNaN(pid)) {
      return { result: [] };
    }

    return callOdooRpc(
      'mail.notification',
      'search_read',
      [
        [
          ['res_partner_id', '=', pid],
          ['notification_status', '=', 'ready'],
        ],
      ],
      {
        fields: [
          'id',
          'mail_message_id',
          'notification_type',
          'notification_status',
          'failure_type',
        ],
      },
    );
  }

  /**
   * Marks a notification as read/sent.
   * Postman: "POST Mark Notification Read" (Notifications item 2)
   */
  static async markNotificationRead(notificationId: number | string): Promise<any> {
    return callOdooRpc(
      'mail.notification',
      'write',
      [
        [Number(notificationId)],
        {
          notification_status: 'sent',
        },
      ],
    );
  }

  /**
   * Registers a push device token for the partner.
   * Postman: "POST Register Device Token" (Notifications item 3)
   */
  static async registerDeviceToken(
    partnerId: number | string,
    deviceToken: string,
  ): Promise<any> {
    const pid = Number(partnerId || ODOO_CONFIG.UID);

    return callOdooRpc(
      'res.partner',
      'write',
      [
        [pid],
        {
          comment: deviceToken,
        },
      ],
    );
  }

  /**
   * Clears registered device token.
   * Postman: "DELETE Device Token" (Notifications item 4)
   */
  static async deleteDeviceToken(partnerId: number | string): Promise<any> {
    const pid = Number(partnerId || ODOO_CONFIG.UID);

    return callOdooRpc(
      'res.partner',
      'write',
      [
        [pid],
        {
          comment: false,
        },
      ],
    );
  }
}
