import jsPDF from 'jspdf';
import logoUrl from '../assets/tcj_logo.png?url';

// Helper to load image URL into DataURL for jsPDF
const loadImageAsDataURL = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Convert ArrayBuffer to base64
const bufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

// Utility function to format currency
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  // Use 'PHP ' for reliability in PDF
  return `PHP ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Utility function to format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Helper to format period text based on range label
const formatPeriodText = (startDate, endDate, rangeLabel) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (rangeLabel === 'Weekly') {
    // Check if dates span different months
    if (start.getMonth() !== end.getMonth()) {
      // Format: Nov 28 - Dec 4, 2025
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      const year = end.getFullYear();
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
    } else {
      // Format: Nov 1–7, 2025 (same month)
      const monthName = start.toLocaleDateString('en-US', { month: 'short' });
      const year = start.getFullYear();
      return `${monthName} ${start.getDate()}–${end.getDate()}, ${year}`;
    }
  } else if (rangeLabel === 'Monthly') {
    // Format: November 2025
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else {
    // Daily or custom range: November 1, 2025 - November 3, 2025
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }
};

// Generate Sales Report PDF
export const generateSalesReportPDF = async (salesData, startDate, endDate, adminName, rangeLabel = 'Daily') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  const logoDataUrl = await loadImageAsDataURL(logoUrl);

  // Header section - centered
  // Header with logo and titles
if (logoDataUrl) {
  const pageWidth = doc.internal.pageSize.getWidth(); // page width
  const imgWidth = 30; // image width
  const imgHeight = 22; // image height
  const x = (pageWidth - imgWidth) / 2; // center horizontally
  const y = 12; // top margin
  doc.addImage(logoDataUrl, 'PNG', x, y, imgWidth, imgHeight);

  const centerX = pageWidth / 2;

  // Title
  const titleY = y + imgHeight + 5; // 5 = space below image
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Report', centerX, titleY, { align: 'center' });

  // Date / period
  const dateY = titleY + 7; // 7 = space below title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${formatPeriodText(startDate, endDate, rangeLabel)}`, centerX, dateY, { align: 'center' });
}

  // API already filtered the data by date, so we just use what was given.
  const filteredOrders = salesData || [];

  // REVISION: Define statuses to include (matching backend)
  const allowedStatuses = ['Completed', 'Partially Returned', 'Pending', null];

  // Flatten the filtered data for table display
  const flattenedData = filteredOrders.flatMap(order =>
    // REVISION: Use the allowedStatuses array
    order.items.filter(item => allowedStatuses.includes(order.status)).map(item => ({
      orderId: order.orderId,
      customerName: order.customerName,
      orderDate: formatDate(order.orderDate), // Format the date
      productName: item.productName,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: Number(item.totalPrice) || 0
    }))
  );

  let yPosition = 50;

  // Draw separator line
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 10;

  // Table headers
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  const colPositions = {
    date: 25,
    productName: 50,
    quantity: 110,
    unitPrice: 125,
    totalSales: 150
  };

  doc.text('Date', colPositions.date, yPosition);
  doc.text('Product Name', colPositions.productName, yPosition);
  doc.text('Qty', colPositions.quantity, yPosition);
  doc.text('Unit Price', colPositions.unitPrice, yPosition);
  doc.text('Total', colPositions.totalSales, yPosition);

  yPosition += 8;

  // Draw table header line
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 5;

  // Table data
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  let grandTotal = 0;

  flattenedData.forEach((item, index) => {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 30;

      // Repeat headers on new page
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', colPositions.date, yPosition);
      doc.text('Product Name', colPositions.productName, yPosition);
      doc.text('Qty', colPositions.quantity, yPosition);
      doc.text('Unit Price', colPositions.unitPrice, yPosition);
      doc.text('Total', colPositions.totalSales, yPosition);

      yPosition += 8;
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
    }

    const maxProductNameLength = 30;
    const productName = item.productName.length > maxProductNameLength
      ? item.productName.substring(0, maxProductNameLength) + '...'
      : item.productName;

    doc.text(item.orderDate, colPositions.date, yPosition);
    doc.text(productName, colPositions.productName, yPosition);
    doc.text((Number(item.quantity) || 0).toString(), colPositions.quantity, yPosition);
    doc.text(formatCurrency(Number(item.unitPrice) || 0), colPositions.unitPrice, yPosition);
    doc.text(formatCurrency(Number(item.totalPrice) || 0), colPositions.totalSales, yPosition);

    grandTotal += (Number(item.totalPrice) || 0);
    yPosition += 6;
  });

  // Draw line below table
  yPosition += 5;
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 10;

  // Grand Total row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Grand Total:', 120, yPosition);
  doc.text(formatCurrency(grandTotal), 150, yPosition);
  yPosition += 10;

  // Draw line below grand total
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 15;

  // Calculate summary data
  // REVISION: Update summary to use the same logic
  const relevantOrders = filteredOrders.filter(order => 
      allowedStatuses.includes(order.status)
  );
  
  const totalRevenue = relevantOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
  const totalItems = flattenedData.reduce((sum, item) => sum + item.quantity, 0); // Use flattened data
  const totalTransactions = relevantOrders.length;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Find best selling product from the flattened (and filtered) data
  const productCounts = {};
  flattenedData.forEach(item => {
    productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
  });
  
  const bestSellingProduct = Object.keys(productCounts).reduce((a, b) =>
    productCounts[a] > productCounts[b] ? a : b, 'N/A');

  // Summary section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Summary', centerX, yPosition, { align: 'center' });
  yPosition += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // First row: Total Revenue and Average transaction value
  doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 25, yPosition);
  const avgText = `Average transaction value: ${formatCurrency(avgTransactionValue)}`;
  doc.text(avgText, centerX + 20, yPosition, { align: 'left' });
  yPosition += 8;

  // Second row: Total Items sold and Best selling product
  doc.text(`Total Items sold: ${totalItems}`, 25, yPosition);
  doc.text(`Best selling product: ${bestSellingProduct}`, centerX + 20, yPosition, { align: 'left' });
  yPosition += 8;

  // Third row: Number of transactions
  doc.text(`Number of transactions: ${totalTransactions}`, 25, yPosition);
  yPosition += 15;

  // Draw line below summary
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 15;

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Generated by and Report Generated on same line
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated by: ${adminName}`, 25, 280);
    doc.text(`Report Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, 120, 280);

    // Page _ of _ centered
    doc.text(`Page ${i} of ${pageCount}`, centerX, 285, { align: 'center' });
  }

  return doc;
};


// --- STANDARD RECEIPT FUNCTION (WITH LAYOUT FIX) ---
export const generateSaleReceipt = async ({
  saleNumber,
  customerName,
  items = [],
  totalAmount = 0,
  paymentMethod = 'Cash',
  tenderedAmount = 0,
  changeAmount = 0,
  address = '',
  shippingOption = 'In-Store Pickup',
  createdAt = new Date()
}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;
  const FONT_SIZE_BODY = 10;
  const FONT_SIZE_SMALL = 8;
  const FONT_SIZE_HEADER = 12;
  const LINE_HEIGHT = 1.2 * FONT_SIZE_BODY;
  const SMALL_LINE_HEIGHT = 1.2 * FONT_SIZE_SMALL;


  // Use 'PHP ' for reliability
  const peso = (n) => {
    const v = Number(n) || 0;
    const sym = 'PHP ';
    return `${sym}${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const logoDataUrl = await loadImageAsDataURL(logoUrl);
  
  // === 1. HEADER (CENTERED) ===
  if (logoDataUrl) {
    const imgWidth = 80;
    const imgHeight = 59;
    const x = (pageWidth - imgWidth) / 2; // Center the logo
    doc.addImage(logoDataUrl, 'PNG', x, y, imgWidth, imgHeight);
    y += imgHeight + 10;
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_HEADER);
  doc.text('TJC AUTO SUPPLY', pageWidth / 2, y, { align: 'center' });
  y += LINE_HEIGHT;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.text('General Hizon Avenue, Santa Lucia, City of San Fernando, Pampanga', pageWidth / 2, y, { align: 'center' });
  y += LINE_HEIGHT;
  doc.text('0912 345 6789 | tjcautosupply@gmail.com', pageWidth / 2, y, { align: 'center' });
  y += 25;

  // === 2. RECEIPT TITLE & DETAILS (PANEL LAYOUT) ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('OFFICIAL RECEIPT', pageWidth / 2, y, { align: 'center' });
  y += 30;

  const panel1_X = margin;
  const panel2_X = margin + (contentWidth / 2) + 10;
  const panelWidth = (contentWidth / 2) - 10;
  
  const adminName = localStorage.getItem('username') || 'Admin';
  const dateStr = new Date(createdAt).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

  // Draw details in two columns
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  
  // Column 1
  let y1 = y;
  doc.text(`Order #:`, panel1_X, y1);
  doc.text(`Customer:`, panel1_X, y1 + LINE_HEIGHT);
  doc.text(`Address:`, panel1_X, y1 + (LINE_HEIGHT * 2));

  doc.setFont('helvetica', 'bold');
  doc.text(`${saleNumber}`, panel1_X + 70, y1);
  doc.text(`${customerName || 'N/A'}`, panel1_X + 70, y1 + LINE_HEIGHT);
  // Wrap address if it's long
  const addressLines = doc.splitTextToSize(address || (shippingOption === 'In-Store Pickup' ? 'In-Store Pickup' : 'N/A'), panelWidth - 70);
  doc.text(addressLines, panel1_X + 70, y1 + (LINE_HEIGHT * 2));
  
  // Column 2
  let y2 = y;
  doc.setFont('helvetica', 'normal');
  doc.text(`Date:`, panel2_X, y2);
  doc.text(`Cashier:`, panel2_X, y2 + LINE_HEIGHT);
  doc.text(`Payment:`, panel2_X, y2 + (LINE_HEIGHT * 2));
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${dateStr}`, panel2_X + 80, y2);
  doc.text(`${adminName}`, panel2_X + 80, y2 + LINE_HEIGHT);
  doc.text(`${paymentMethod}`, panel2_X + 80, y2 + (LINE_HEIGHT * 2));

  // Adjust 'y' to the bottom of the tallest panel
  y = Math.max(y1 + ((addressLines.length + 1) * LINE_HEIGHT), y2 + (LINE_HEIGHT * 3)) + 20;

  // === 3. ITEMS TABLE ===
  const tableHeaderY = y;
  
  // --- THIS IS THE FIX ---
  // Redefine column X positions to give more space
  const colAmt_Right = pageWidth - margin - 5;        // Right edge of Amount
  const colUnit_Right = colAmt_Right - 90;          // Right edge of Unit Price (90pt wide)
  const colQty_Center = colUnit_Right - 45;         // Center of Qty (45pt from Unit Price)
  const colName_Left = margin + 5;                  // Left edge of Item
  const colName_Width = colQty_Center - 25 - colName_Left; // Width of Item column
  // --- END OF FIX ---
  
  const minRowHeight = 25; // Minimum height for a row

  // Table Header
  doc.setFillColor(241, 243, 245); // Set fill to light gray (like the report)
  doc.rect(margin, tableHeaderY, contentWidth, 20, 'F'); // Draw the header rectangle
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.text('Item Description', colName_Left, tableHeaderY + 14);
  doc.text('Qty', colQty_Center, tableHeaderY + 14, { align: 'center' });
  doc.text('Unit Price', colUnit_Right, tableHeaderY + 14, { align: 'right' });
  doc.text('Amount', colAmt_Right, tableHeaderY + 14, { align: 'right' });

  y = tableHeaderY + 20;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  
  items.forEach((it, index) => {
    // Check for page break
    if (y > 750) { 
      doc.addPage();
      y = margin;
      //... (Repeat table header logic if needed) ...
    }

    const name = String(it.name || it.product_name || it.productName || '');
    const nameLines = doc.splitTextToSize(name, colName_Width);
    
    // Check for serial numbers
    const serials = it.serialNumbers || it.serial_numbers || [];
    let serialLines = [];
    if (serials.length > 0) {
      const serialString = "Serials: " + serials.join(', ');
      // Indent serial numbers slightly
      serialLines = doc.splitTextToSize(serialString, colName_Width - 5); 
    }
    
    // Calculate row height based on wrapped text for BOTH name and serials
    const nameHeight = nameLines.length * LINE_HEIGHT;
    const serialHeight = serialLines.length * SMALL_LINE_HEIGHT;
    const rowHeight = Math.max(minRowHeight, nameHeight + serialHeight + 10); // +10 for padding
    
    const yTextStart = y + 16; // Vertical position for text (16pt from top of row)

    const qty = Number(it.quantity || 0);
    const unit = Number(it.price || it.unitPrice || 0);
    const sub = unit * qty;
    
    // Draw text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE_BODY);
    doc.text(nameLines, colName_Left, yTextStart);
    
    if (serialLines.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(FONT_SIZE_SMALL);
      doc.text(serialLines, colName_Left + 5, yTextStart + nameHeight); // Place below the name
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE_BODY);
    }

    // Draw the rest of the row, aligned with the top text
    doc.text(String(qty), colQty_Center, yTextStart, { align: 'center' });
    doc.text(peso(unit), colUnit_Right, yTextStart, { align: 'right' });
    doc.text(peso(sub), colAmt_Right, yTextStart, { align: 'right' });

    // Draw lines for the row
    doc.setLineWidth(0.5);
    doc.setDrawColor(222, 226, 230); // Light gray border
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight); // Horizontal line

    y += rowHeight; // Move y by the calculated row height
  });
  
  
  // === 4. TOTALS SECTION ===
  y += 15;
  const totalLabelX = contentWidth - 100; // Right-align point for labels
  const totalValueX = pageWidth - margin - 5; // Right-align point for values

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.text('Subtotal:', totalLabelX, y, { align: 'right' });
  doc.text(peso(totalAmount), totalValueX, y, { align: 'right' });
  y += LINE_HEIGHT;

  if (paymentMethod.toLowerCase() === 'cash' && tenderedAmount > 0) {
    doc.text('Cash Tendered:', totalLabelX, y, { align: 'right' });
    doc.text(peso(tenderedAmount), totalValueX, y, { align: 'right' });
    y += LINE_HEIGHT;
    
    doc.text('Change:', totalLabelX, y, { align: 'right' });
    doc.text(peso(changeAmount), totalValueX, y, { align: 'right' });
    y += (LINE_HEIGHT * 1.5); // Extra space before total
  }

  // Grand Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_HEADER + 2); // Make total bigger
  doc.text('TOTAL:', totalLabelX, y, { align: 'right' });
  doc.text(peso(totalAmount), totalValueX, y, { align: 'right' });
  y += (LINE_HEIGHT * 2);

  // === 5. FOOTER ===
  y = Math.max(y, 800); // Push footer to bottom
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.text('Thank you for your purchase!', pageWidth / 2, y, { align: 'center' });

  return doc;
};


// Generate Inventory Report PDF
export const generateInventoryReportPDF = async (inventoryData, startDate, endDate, adminName) => {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header: Logo + Title + Period
  try {
    const logoDataUrl = await loadImageAsDataURL(logoUrl);// replace with your logo loading function
    const imgWidth = 30;
    const imgHeight = 22;
    const x = (pageWidth - imgWidth) / 2;
    doc.addImage(logoDataUrl, 'PNG', x, yPosition, imgWidth, imgHeight);
    yPosition += imgHeight + 5;
  } catch (error) {
    console.warn('Could not load logo:', error);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Inventory Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  // REVISION: Use the provided date range for the inventory report title
  doc.text(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Table headers
  const colPositions = {
    productName: 20,
    category: 70,
    brand: 110,
    quantity: 150,
    status: 175
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Product Name', colPositions.productName, yPosition);
  doc.text('Category', colPositions.category, yPosition);
  doc.text('Brand', colPositions.brand, yPosition);
  doc.text('Remaining Qty', colPositions.quantity, yPosition);
  doc.text('Status', colPositions.status, yPosition);
  yPosition += 3;

  // Header line
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 5;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  inventoryData.forEach((item, index) => {
    // Check for new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;

      // Repeat headers
      doc.setFont('helvetica', 'bold');
      doc.text('Product Name', colPositions.productName, yPosition);
      doc.text('Category', colPositions.category, yPosition);
      doc.text('Brand', colPositions.brand, yPosition);
      doc.text('Remaining Qty', colPositions.quantity, yPosition);
      doc.text('Status', colPositions.status, yPosition);
      yPosition += 3;
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    // Optional: alternating row color
    if (index % 2 === 0) {
      doc.setFillColor(240, 240, 240); // light gray
      doc.rect(15, yPosition - 4, pageWidth - 30, 6, 'F');
    }

    const maxProductNameLength = 35;
    const productName = item.productName.length > maxProductNameLength
      ? item.productName.substring(0, maxProductNameLength) + '...'
      : item.productName;

    doc.setTextColor(0, 0, 0);
    doc.text(productName, colPositions.productName, yPosition);
    doc.text(item.category, colPositions.category, yPosition);
    doc.text(item.brand, colPositions.brand, yPosition);
    doc.text(item.currentStock.toString(), colPositions.quantity, yPosition);
    doc.text(item.stockStatus, colPositions.status, yPosition);

    yPosition += 6;
  });

  yPosition += 5;
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;

  // Summary
  const totalItems = inventoryData.length;
  const lowStockItems = inventoryData.filter(item => item.stockStatus === 'Low Stock').length;
  const totalRemaining = inventoryData.reduce((sum, item) => sum + item.currentStock, 0);

  if (yPosition > 200) {
    doc.addPage();
    yPosition = 30;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Inventory Summary', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Items: ${totalItems}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Low Stock Items: ${lowStockItems}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Total Remaining: ${totalRemaining}`, 20, yPosition);

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated by: ${adminName}`, 15, 285);
    doc.text(`Report Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, 15, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, 290, { align: 'right' });
  }

 

  return doc;
};