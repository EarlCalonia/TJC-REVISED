const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
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
  // Get all products with optional filters
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'All Categories' && value !== 'All Brand' && value !== 'All Status') {
        params.append(key, value);
      }
    });

    const queryString = params.toString();
    const url = `${API_BASE_URL}/products${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get product by ID
  getProductById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Create new product
  createProduct: async (productData) => {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      body: productData, // FormData will set the correct Content-Type
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Update product
  updateProduct: async (id, productData) => {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      body: productData, // FormData will set the correct Content-Type
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Delete product
  deleteProduct: async (id) => {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get categories
  getCategories: async () => {
    const response = await fetch(`${API_BASE_URL}/products/categories`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get brands
  getBrands: async () => {
    const response = await fetch(`${API_BASE_URL}/products/brands`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },
};

// Sales API functions
export const salesAPI = {
  // Create a new sale
  createSale: async (saleData) => {
    const response = await fetch(`${API_BASE_URL}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saleData),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get all sales with optional filters
  getSales: async (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });

    const queryString = params.toString();
    const url = `${API_BASE_URL}/sales${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include'
    });
    const result = await handleResponse(response);

    // Backend returns { success: true, data: { sales: [], pagination: {} } }
    // Extract the sales array from the response
    return result.data?.sales || [];
  },

  // Get sales statistics
  getSalesStats: async (dateFrom, dateTo) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/sales/stats${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get sale by ID
  getSaleById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/sales/${id}`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get sale items
  getSaleItems: async (saleId) => {
    const response = await fetch(`${API_BASE_URL}/sales/${saleId}/items`, {
      credentials: 'include'
    });
    const result = await handleResponse(response);

    // Backend returns { success: true, data: items[] }
    // Extract the items array from the response
    return result.data || [];
  },

  // Update sale
  updateSale: async (id, saleData) => {
    const response = await fetch(`${API_BASE_URL}/sales/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saleData),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Delete sale
  deleteSale: async (id) => {
    const response = await fetch(`${API_BASE_URL}/sales/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Upload delivery proof
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
  // Get inventory statistics
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/inventory/stats`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get products with inventory information (from inventoryApi.js)
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/inventory/products?${params}`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get products with inventory information (from api.js)
  getProductsWithInventory: async () => {
    const response = await fetch(`${API_BASE_URL}/inventory/products`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Update product stock (from inventoryApi.js)
  updateStock: async (productId, data) => {
    // Check if data is just quantity (old signature)
    let bodyData = data;
    if (typeof data === 'number') {
        console.warn("Using deprecated updateStock signature. Pass an object instead.");
        bodyData = { quantityToAdd: data };
    }

    const response = await fetch(`${API_BASE_URL}/inventory/${productId}/stock`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Bulk stock in for multiple products (from inventoryApi.js)
  bulkStockIn: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/bulk-stock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Return to supplier for multiple products (from inventoryApi.js)
  returnToSupplier: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/return-to-supplier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Reports API functions
export const reportsAPI = {
  // Get sales report data with date filtering and pagination
  getSalesReport: async (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });

    const queryString = params.toString();
    const url = `${API_BASE_URL}/reports/sales${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include'
    });
    const result = await handleResponse(response);

    // Backend returns { success: true, data: { sales: [], pagination: {}, summary: {} } }
    // Extract the sales array from the response
    return {
      sales: result.data?.sales || result.sales || [],
      pagination: result.data?.pagination || result.pagination || {},
      summary: result.data?.summary || {}
    };
  },

  // Get inventory report data with pagination
  getInventoryReport: async (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });

    const queryString = params.toString();
    const url = `${API_BASE_URL}/reports/inventory${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include'
    });
    const result = await handleResponse(response);

    // Backend returns { success: true, data: { products: [] } }
    // Extract the products array from the response and add pagination info
    return {
      inventory: result.data?.products || result.inventory || [],
      pagination: result.data?.pagination || { totalPages: 1, currentPage: 1, totalItems: result.data?.products?.length || 0 },
      summary: result.data?.summary || {}
    };
  },

  // Get filter options (brands and categories)
  getFilterOptions: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/filter-options`, {
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Dashboard API functions
export const dashboardAPI = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get recent sales transactions
  getRecentSales: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/recent-sales`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get low stock items
  getLowStockItems: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/low-stock`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get sales aggregated by period
  // period: 'week' | 'month' | 'year'
  getDailySales: async (params = 'week') => {
    const search = new URLSearchParams();
    if (typeof params === 'string') {
      search.append('period', params);
    } 
    // REVISION: Fixed 'else' to 'else if'
    else if (params && typeof params === 'object') {
      if (params.period) search.append('period', params.period);
      if (params.start_date) search.append('start_date', params.start_date);
      if (params.end_date) search.append('end_date', params.end_date);
      if (params.granularity) search.append('granularity', params.granularity);
    }
    const qs = search.toString();
    const url = `${API_BASE_URL}/dashboard/daily-sales${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get fast moving products
  getFastMovingProducts: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/fast-moving`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get slow moving products
  getSlowMovingProducts: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/slow-moving`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },
};

// Returns API functions
export const returnsAPI = {
  // Process a return
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

  // Get returns for a specific order
  getReturnsByOrder: async (orderId) => {
    const response = await fetch(`${API_BASE_URL}/returns/order/${orderId}`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get all returns with filters
  getAllReturns: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.returnReason) params.append('returnReason', filters.returnReason);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/returns${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // Get return statistics
  getReturnStats: async () => {
    const response = await fetch(`${API_BASE_URL}/returns/stats`, {
      credentials: 'include'
    });
    return handleResponse(response);
  }
};