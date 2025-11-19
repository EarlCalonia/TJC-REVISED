const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Customers API
export const customersAPI = {
  getCustomers: async (search = '') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/customers${query ? `?${query}` : ''}`, {
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Authentication API
export const authAPI = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  changePassword: async (userId, current_password, new_password) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, current_password, new_password }),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  logout: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Users API
export const usersAPI = {
  list: async () => {
    const response = await fetch(`${API_BASE_URL}/users`, { credentials: 'include' });
    return handleResponse(response);
  },
  create: async (user) => {
    const isForm = typeof FormData !== 'undefined' && user instanceof FormData;
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? user : JSON.stringify(user),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  update: async (id, user) => {
    const isForm = typeof FormData !== 'undefined' && user instanceof FormData;
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? user : JSON.stringify(user),
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Settings API
export const settingsAPI = {
  get: async () => {
    const response = await fetch(`${API_BASE_URL}/settings`, { credentials: 'include' });
    return handleResponse(response);
  },
  updateBusinessInfo: async (payload) => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  updatePreferences: async (payload) => {
    const response = await fetch(`${API_BASE_URL}/settings/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Product API functions
export const productAPI = {
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'All Categories' && value !== 'All Brand' && value !== 'All Status') {
        params.append(key, value);
      }
    });
    const response = await fetch(`${API_BASE_URL}/products?${params}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getProductById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, { credentials: 'include' });
    return handleResponse(response);
  },
  createProduct: async (productData) => {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      body: productData,
      credentials: 'include'
    });
    return handleResponse(response);
  },
  updateProduct: async (id, productData) => {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      body: productData,
      credentials: 'include'
    });
    return handleResponse(response);
  },
  deleteProduct: async (id) => {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return handleResponse(response);
  },
  getCategories: async () => {
    const response = await fetch(`${API_BASE_URL}/products/categories`, { credentials: 'include' });
    return handleResponse(response);
  },
  getBrands: async () => {
    const response = await fetch(`${API_BASE_URL}/products/brands`, { credentials: 'include' });
    return handleResponse(response);
  },
};

// Sales API functions
export const salesAPI = {
  createSale: async (saleData) => {
    const response = await fetch(`${API_BASE_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  getSales: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    const response = await fetch(`${API_BASE_URL}/sales?${params}`, { credentials: 'include' });
    const result = await handleResponse(response);
    return result.data?.sales || [];
  },
  getSalesStats: async (dateFrom, dateTo) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    const response = await fetch(`${API_BASE_URL}/sales/stats?${params}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getSaleById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/sales/${id}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getSaleItems: async (saleId) => {
    const response = await fetch(`${API_BASE_URL}/sales/${saleId}/items`, { credentials: 'include' });
    const result = await handleResponse(response);
    return result.data || [];
  },
  updateSale: async (id, saleData) => {
    const response = await fetch(`${API_BASE_URL}/sales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  deleteSale: async (id) => {
    const response = await fetch(`${API_BASE_URL}/sales/${id}`, { method: 'DELETE', credentials: 'include' });
    return handleResponse(response);
  },
  uploadDeliveryProof: async (id, imageFile) => {
    const formData = new FormData();
    formData.append('proof', imageFile);
    const response = await fetch(`${API_BASE_URL}/sales/${id}/delivery-proof`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    return handleResponse(response);
  },
};

// Inventory API functions
export const inventoryAPI = {
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/inventory/stats`, { credentials: 'include' });
    return handleResponse(response);
  },
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    const response = await fetch(`${API_BASE_URL}/inventory/products?${params}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getProductsWithInventory: async () => {
    const response = await fetch(`${API_BASE_URL}/inventory/products`, { credentials: 'include' });
    return handleResponse(response);
  },
  updateStock: async (productId, data) => {
    let bodyData = data;
    if (typeof data === 'number') bodyData = { quantityToAdd: data };
    const response = await fetch(`${API_BASE_URL}/inventory/${productId}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  bulkStockIn: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/bulk-stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  returnToSupplier: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/return-to-supplier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Reports API
export const reportsAPI = {
  getSalesReport: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
    const response = await fetch(`${API_BASE_URL}/reports/sales?${params}`, { credentials: 'include' });
    const result = await handleResponse(response);
    return {
      sales: result.data?.sales || [],
      pagination: result.data?.pagination || {},
      summary: result.data?.summary || {}
    };
  },
  getInventoryReport: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
    const response = await fetch(`${API_BASE_URL}/reports/inventory?${params}`, { credentials: 'include' });
    const result = await handleResponse(response);
    return {
      inventory: result.data?.products || [],
      pagination: result.data?.pagination || {},
      summary: result.data?.summary || {}
    };
  },
  getReturnsReport: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
    const response = await fetch(`${API_BASE_URL}/reports/returns?${params}`, { credentials: 'include' });
    const result = await handleResponse(response);
    return {
      returns: result.data?.returns || [],
      pagination: result.data?.pagination || {},
      summary: result.data?.summary || {}
    };
  },
  getFilterOptions: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/filter-options`, { credentials: 'include' });
    return handleResponse(response);
  }
};

// Dashboard API
export const dashboardAPI = {
  getDashboardStats: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, { credentials: 'include' });
    return handleResponse(response);
  },
  getRecentSales: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/recent-sales`, { credentials: 'include' });
    return handleResponse(response);
  },
  getLowStockItems: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/low-stock`, { credentials: 'include' });
    return handleResponse(response);
  },
  getDailySales: async (params = 'week') => {
    const search = new URLSearchParams();
    if (typeof params === 'string') search.append('period', params);
    else if (params && typeof params === 'object') {
      if (params.period) search.append('period', params.period);
      if (params.start_date) search.append('start_date', params.start_date);
      if (params.end_date) search.append('end_date', params.end_date);
      if (params.granularity) search.append('granularity', params.granularity);
    }
    const response = await fetch(`${API_BASE_URL}/dashboard/daily-sales?${search}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getFastMovingProducts: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/fast-moving`, { credentials: 'include' });
    return handleResponse(response);
  },
  getSlowMovingProducts: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/slow-moving`, { credentials: 'include' });
    return handleResponse(response);
  },
  getSalesByCategory: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/sales-by-category`, { credentials: 'include' });
    return handleResponse(response);
  },
};

// Returns API
export const returnsAPI = {
  processReturn: async (returnData) => {
    const isFormData = returnData instanceof FormData;
    const response = await fetch(`${API_BASE_URL}/returns/process`, {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: isFormData ? returnData : JSON.stringify(returnData),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  getReturnsByOrder: async (orderId) => {
    const response = await fetch(`${API_BASE_URL}/returns/order/${orderId}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getAllReturns: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.returnReason) params.append('returnReason', filters.returnReason);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    const response = await fetch(`${API_BASE_URL}/returns?${params}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getReturnStats: async () => {
    const response = await fetch(`${API_BASE_URL}/returns/stats`, { credentials: 'include' });
    return handleResponse(response);
  }
};

// Serial Numbers API
export const serialNumberAPI = {
  getAvailableSerials: async (productId) => {
    const response = await fetch(`${API_BASE_URL}/serial-numbers/product/${productId}/available`, { credentials: 'include' });
    return handleResponse(response);
  },
  getAllSerials: async (productId) => {
    const response = await fetch(`${API_BASE_URL}/serial-numbers/product/${productId}`, { credentials: 'include' });
    return handleResponse(response);
  },
  getBySaleId: async (saleId) => {
    const response = await fetch(`${API_BASE_URL}/serial-numbers/sale/${saleId}`, { credentials: 'include' });
    return handleResponse(response);
  },
  createSerials: async (serialNumbers) => {
    const response = await fetch(`${API_BASE_URL}/serial-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumbers }),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  markAsSold: async (serialNumbers, saleId, saleItemId = null) => {
    const response = await fetch(`${API_BASE_URL}/serial-numbers/mark-sold`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumbers, saleId, saleItemId }),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  markAsDefective: async (serialNumbers, notes = null) => {
    const response = await fetch(`${API_BASE_URL}/serial-numbers/defective`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumbers, notes }),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  deleteSerials: async (serialNumbers) => {
    const response = await fetch(`${API_BASE_URL}/serial-numbers`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumbers }),
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Suppliers API (THIS WAS MISSING)
export const suppliersAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/suppliers`, { credentials: 'include' });
    return handleResponse(response);
  },
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  update: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return handleResponse(response);
  },
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return handleResponse(response);
  }
};