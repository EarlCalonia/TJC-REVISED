import { Product } from '../models/Product.js';

export class ProductController {
  // Get all products with optional filtering
  static async getAllProducts(req, res) {
    try {
      const { search, category, brand, status, page = 1, limit = 10 } = req.query;

      const filters = {
        search,
        category,
        brand,
        status
      };

      const products = await Product.findAll(filters);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedProducts = products.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          products: paginatedProducts,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(products.length / limit),
            totalProducts: products.length,
            hasNextPage: endIndex < products.length,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: error.message
      });
    }
  }

  // Get product by ID
  static async getProductById(req, res) {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product',
        error: error.message
      });
    }
  }

  // Create new product
  static async createProduct(req, res) {
    try {
      const productData = req.body;
      productData.image = req.file ? `/uploads/${req.file.filename}` : null;
      productData.requires_serial = req.body.requires_serial === 'true';

      const productId = await Product.create(productData);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { id: productId }
      });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message
      });
    }
  }

  // Update product
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const productData = req.body;
      // If a new file is uploaded, use its path.
      if (req.file) {
        productData.image = `/uploads/${req.file.filename}`;
      } else {
        // Otherwise, use the image path sent from the form (or null if it's empty)
        productData.image = productData.image || null;
      }
      productData.requires_serial = req.body.requires_serial === 'true';

      const updated = await Product.update(id, productData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product updated successfully'
      });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message
      });
    }
  }

  // Delete product
  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Product.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      
      // Handle specific error for product in use
      if (error.code === 'PRODUCT_IN_USE') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product. This product is referenced in existing sales records.',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message
      });
    }
  }

  // Get categories
  static async getCategories(req, res) {
    try {
      const categories = await Product.getCategories();
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: error.message
      });
    }
  }

  // Get brands
  static async getBrands(req, res) {
    try {
      const brands = await Product.getBrands();
      res.json({
        success: true,
        data: brands
      });
    } catch (error) {
      console.error('Error fetching brands:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch brands',
        error: error.message
      });
    }
  }
}
