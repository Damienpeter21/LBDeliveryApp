// src/app/config/odooConfig.ts
import axiosInstance from './axios/AxiosInstance';

/**
 * Standard Odoo JSON-RPC & API Configuration Constants
 * Matches the official Postman collection for LB Delivery Partner
 */
export const ODOO_CONFIG = {
  DB: 'odoo18',
  UID: 15,
  PASSWORD: '1234',
  LOGIN: 'karthik.delivery@example.com',
  API_KEY: 'f0cdb9807be1d3368fa9b949004ada4e02fca716',
};


/** Default headers for Odoo API endpoints matching Postman collection */
export const ODOO_DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'x-api-key': ODOO_CONFIG.API_KEY,
};

let rpcCounter = 1;

/**
 * Executes a standard Odoo JSON-RPC `execute_kw` method call against `/jsonrpc`.
 *
 * @param model Odoo model name (e.g. 'sale.order', 'res.partner', 'product.template')
 * @param method Odoo ORM method (e.g. 'search_read', 'read', 'create', 'write', 'unlink', 'action_cancel')
 * @param args Positional arguments passed to the model method
 * @param kwargs Keyword arguments / options (e.g. fields, order, limit, offset)
 * @param auth Override DB, UID, or password if needed
 */
export async function callOdooRpc<T = any>(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: Record<string, any> = {},
  auth?: { db?: string; uid?: number | null; password?: string | null },
): Promise<T> {
  const db = auth?.db ?? ODOO_CONFIG.DB;
  const uid = auth?.uid !== undefined ? auth.uid : ODOO_CONFIG.UID;
  const password = auth?.password !== undefined ? auth.password : ODOO_CONFIG.PASSWORD;

  const rpcId = ++rpcCounter;

  try {
    const response = await axiosInstance({
      method: 'POST',
      url: '/jsonrpc',
      headers: ODOO_DEFAULT_HEADERS,
      skipAuth: true,
      skipGlobalErrorToast: true,
      data: {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [db, uid, password, model, method, args, kwargs],
        },
        id: rpcId,
      },
    });

    if (response.data?.error) {
      const err = response.data.error;
      const message =
        err.data?.message ||
        err.message ||
        `Odoo RPC Error in ${model}.${method}`;
      console.warn(`[Odoo RPC Error] ${model}.${method}:`, message);
      throw new Error(message);
    }

    return response.data;
  } catch (error) {
    console.warn(`[Odoo RPC Note] (${model}.${method}):`, (error as any)?.message || error);
    throw error;
  }
}

/**
 * Executes a custom Odoo API endpoint (e.g. `/api/products/top_selling`).
 */
export async function callOdooCustomApi<T = any>(
  endpoint: string,
  params: Record<string, any> = {},
): Promise<T> {
  const rpcId = ++rpcCounter;

  // Auto-normalize endpoint to prevent duplicated /api/ pathing (e.g. /api/products/api/top_selling -> /api/products/top_selling)
  const cleanEndpoint = endpoint
    .replace('/api/products/api/top_selling', '/api/products/top_selling')
    .replace(/\/api\/api\//g, '/api/');

  try {
    const response = await axiosInstance({
      method: 'POST',
      url: cleanEndpoint,
      headers: ODOO_DEFAULT_HEADERS,
      skipAuth: true,
      skipGlobalErrorToast: true,
      data: {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: ODOO_CONFIG.DB,
          login: ODOO_CONFIG.LOGIN,
          password: ODOO_CONFIG.PASSWORD,
          ...params,
        },
        id: rpcId,
      },
    });

    if (response.data?.error) {
      const err = response.data.error;
      const message =
        err.data?.message ||
        err.message ||
        `Odoo Custom API Error at ${cleanEndpoint}`;
      console.warn(`[Odoo API Error] ${cleanEndpoint}:`, message);
      throw new Error(message);
    }

    return response.data;
  } catch (error) {
    console.warn(`[Odoo Custom API Note] (${cleanEndpoint}):`, (error as any)?.message || error);
    throw error;
  }
}
