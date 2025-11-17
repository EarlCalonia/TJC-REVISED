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

// Utility function to format currency
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
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
    if (start.getMonth() !== end.getMonth()) {
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      const year = end.getFullYear();
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
    } else {
      const monthName = start.toLocaleDateString('en-US', { month: 'short' });
      const year = start.getFullYear();
      return `${monthName} ${start.getDate()}–${end.getDate()}, ${year}`;
    }
  } else if (rangeLabel === 'Monthly') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }
};

// Generate Sales Report PDF
export const generateSalesReportPDF = async (salesData, startDate, endDate, adminName, rangeLabel = 'Daily') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  let yPosition = 20;

  const logoDataUrl = await loadImageAsDataURL(logoUrl);

  // === Header Section ===
  if (logoDataUrl) {
    const imgWidth = 30; 
    const imgHeight = 22; 
    const x = (pageWidth - imgWidth) / 2;
    doc.addImage(logoDataUrl, 'PNG', x, yPosition, imgWidth, imgHeight);
    yPosition += imgHeight + 5;
  }

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Report', centerX, yPosition, { align: 'center' });
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${formatPeriodText(startDate, endDate, rangeLabel)}`, centerX, yPosition, { align: 'center' });
  yPosition += 10;

  const filteredOrders = salesData || [];
  const allowedStatuses = ['Completed', 'Partially Returned', 'Pending', null];

  const flattenedData = filteredOrders.flatMap(order =>
    order.items.filter(item => allowedStatuses.includes(order.status)).map(item => ({
      orderId: order.orderId,
      customerName: order.customerName,
      orderDate: formatDate(order.orderDate),
      productName: item.productName,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: Number(item.totalPrice) || 0
    }))
  );

  // === Table Headers ===
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  const colPositions = {
    date: 15,
    productName: 50,
    quantity: 110,
    unitPrice: 130,
    totalSales: 160
  };

  const drawTableHeaders = (y) => {
    doc.setFont('helvetica', 'bold');
    doc.text('Date', colPositions.date, y);
    doc.text('Product Name', colPositions.productName, y);
    doc.text('Qty', colPositions.quantity, y);
    doc.text('Unit Price', colPositions.unitPrice, y);
    doc.text('Total', colPositions.totalSales, y);
    doc.setLineWidth(0.5);
    doc.line(15, y + 3, pageWidth - 15, y + 3);
  };

  drawTableHeaders(yPosition);
  yPosition += 8;

  // === Table Data ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let grandTotal = 0;

  flattenedData.forEach((item, index) => {
    // Page break check for rows (Footer is at ~280mm)
    // We stop at 270 to leave breathing room
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
      drawTableHeaders(yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    // Alternating row color
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPosition - 4, pageWidth - 30, 6, 'F');
    }

    const maxProductNameLength = 30;
    const productName = item.productName.length > maxProductNameLength
      ? item.productName.substring(0, maxProductNameLength) + '...'
      : item.productName;

    doc.setTextColor(0, 0, 0);
    doc.text(item.orderDate, colPositions.date, yPosition);
    doc.text(productName, colPositions.productName, yPosition);
    doc.text((Number(item.quantity) || 0).toString(), colPositions.quantity, yPosition);
    doc.text(formatCurrency(Number(item.unitPrice) || 0), colPositions.unitPrice, yPosition);
    doc.text(formatCurrency(Number(item.totalPrice) || 0), colPositions.totalSales, yPosition);

    grandTotal += (Number(item.totalPrice) || 0);
    yPosition += 6;
  });

  // === Grand Total ===
  // Check space for Grand Total (needs ~15mm)
  if (yPosition > 265) {
    doc.addPage();
    yPosition = 20;
  }

  yPosition += 2;
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Grand Total:', 130, yPosition);
  doc.text(formatCurrency(grandTotal), 160, yPosition);
  yPosition += 10; // Add space before summary

  // === Sales Summary ===
  // Calculate Summary Data
  const relevantOrders = filteredOrders.filter(order => allowedStatuses.includes(order.status));
  const totalRevenue = relevantOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
  const totalItems = flattenedData.reduce((sum, item) => sum + item.quantity, 0);
  const totalTransactions = relevantOrders.length;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const productCounts = {};
  flattenedData.forEach(item => {
    productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
  });
  const bestSellingProduct = Object.keys(productCounts).reduce((a, b) => productCounts[a] > productCounts[b] ? a : b, 'N/A');

  // Estimate Summary Height: ~35mm needed
  // If current position + 35mm exceeds footer start (280mm), start new page
  if (yPosition + 35 > 280) {
    doc.addPage();
    yPosition = 30;
  }

  // Summary Header
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F'); // Header background
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Summary', centerX, yPosition, { align: 'center' });
  yPosition += 8;

  // Summary Content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Row 1
  doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 20, yPosition);
  doc.text(`Avg Transaction Value: ${formatCurrency(avgTransactionValue)}`, pageWidth / 2 + 10, yPosition);
  yPosition += 6;

  // Row 2
  doc.text(`Total Items Sold: ${totalItems}`, 20, yPosition);
  doc.text(`Best Selling Product: ${bestSellingProduct}`, pageWidth / 2 + 10, yPosition);
  yPosition += 6;

  // Row 3
  doc.text(`Total Transactions: ${totalTransactions}`, 20, yPosition);
  
  // === Footer ===
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    const footerY = 285;
    doc.text(`Generated by: ${adminName}`, 15, footerY);
    doc.text(`Report Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, 15, footerY + 4);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, footerY, { align: 'right' });
  }

  return doc;
};

// Generate Inventory Report PDF
export const generateInventoryReportPDF = async (inventoryData, startDate, endDate, adminName) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  try {
    const logoDataUrl = await loadImageAsDataURL(logoUrl);
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
  doc.text(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

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

  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  inventoryData.forEach((item, index) => {
    if (yPosition > 270) { // Consistent threshold
      doc.addPage();
      yPosition = 20;
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

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
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

  const totalItems = inventoryData.length;
  const lowStockItems = inventoryData.filter(item => item.stockStatus === 'Low Stock').length;
  const totalRemaining = inventoryData.reduce((sum, item) => sum + item.currentStock, 0);

  if (yPosition + 30 > 280) {
    doc.addPage();
    yPosition = 30;
  }

  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
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

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const footerY = 285;
    doc.text(`Generated by: ${adminName}`, 15, footerY);
    doc.text(`Report Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, 15, footerY + 4);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, footerY, { align: 'right' });
  }

  return doc;
};

// Generate Returns Report PDF (New function)
export const generateReturnsReportPDF = async (returnsData, startDate, endDate, adminName) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  try {
    const logoDataUrl = await loadImageAsDataURL(logoUrl);
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
  doc.text('Returns Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  const colPositions = {
    returnId: 15,
    saleNumber: 50,
    customer: 80,
    date: 120,
    reason: 150,
    amount: 180
  };

  const drawTableHeaders = (y) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Return ID', colPositions.returnId, y);
    doc.text('Order ID', colPositions.saleNumber, y);
    doc.text('Customer', colPositions.customer, y);
    doc.text('Date', colPositions.date, y);
    doc.text('Reason', colPositions.reason, y);
    doc.text('Amount', colPositions.amount, y);
    doc.setLineWidth(0.5);
    doc.line(15, y + 3, pageWidth - 15, y + 3);
  };

  drawTableHeaders(yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let totalRefundAmount = 0;

  returnsData.forEach((item, index) => {
    // Page break check
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
      drawTableHeaders(yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    // Alternating row color
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPosition - 4, pageWidth - 30, 6, 'F');
    }

    // Truncate text if too long
    const customerName = item.customer_name?.length > 20 
      ? item.customer_name.substring(0, 20) + '...' 
      : item.customer_name || 'N/A';
    
    const reason = item.return_reason?.length > 15
      ? item.return_reason.substring(0, 15) + '...'
      : item.return_reason || 'N/A';

    doc.setTextColor(0, 0, 0);
    doc.text(item.return_id, colPositions.returnId, yPosition);
    doc.text(item.sale_number, colPositions.saleNumber, yPosition);
    doc.text(customerName, colPositions.customer, yPosition);
    doc.text(formatDate(item.return_date), colPositions.date, yPosition);
    doc.text(reason, colPositions.reason, yPosition);
    doc.text(formatCurrency(item.refund_amount), colPositions.amount, yPosition);

    totalRefundAmount += (Number(item.refund_amount) || 0);
    yPosition += 6;
  });

  // Totals line
  yPosition += 5;
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;

  // Summary Section
  if (yPosition + 35 > 280) {
    doc.addPage();
    yPosition = 30;
  }

  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Returns Summary', 20, yPosition);
  yPosition += 8;

  const totalReturns = returnsData.length;
  const defectiveReturns = returnsData.filter(r => r.return_reason === 'Defective/Damaged').length;
  const restockedCount = returnsData.filter(r => r.restocked).length;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Returns Processed: ${totalReturns}`, 20, yPosition);
  doc.text(`Total Refunded Amount: ${formatCurrency(totalRefundAmount)}`, pageWidth / 2 + 10, yPosition);
  yPosition += 6;
  doc.text(`Defective/Damaged Items: ${defectiveReturns}`, 20, yPosition);
  doc.text(`Items Restocked: ${restockedCount}`, pageWidth / 2 + 10, yPosition);

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const footerY = 285;
    doc.text(`Generated by: ${adminName}`, 15, footerY);
    doc.text(`Report Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, 15, footerY + 4);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, footerY, { align: 'right' });
  }

  return doc;
};


// --- STANDARD RECEIPT FUNCTION ---
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

  const peso = (n) => {
    const v = Number(n) || 0;
    const sym = 'PHP ';
    return `${sym}${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const logoDataUrl = await loadImageAsDataURL(logoUrl);
  
  if (logoDataUrl) {
    const imgWidth = 80;
    const imgHeight = 59;
    const x = (pageWidth - imgWidth) / 2; 
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('OFFICIAL RECEIPT', pageWidth / 2, y, { align: 'center' });
  y += 30;

  const panel1_X = margin;
  const panel2_X = margin + (contentWidth / 2) + 10;
  const panelWidth = (contentWidth / 2) - 10;
  
  const adminName = localStorage.getItem('username') || 'Admin';
  const dateStr = new Date(createdAt).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  
  let y1 = y;
  doc.text(`Order #:`, panel1_X, y1);
  doc.text(`Customer:`, panel1_X, y1 + LINE_HEIGHT);
  doc.text(`Address:`, panel1_X, y1 + (LINE_HEIGHT * 2));

  doc.setFont('helvetica', 'bold');
  doc.text(`${saleNumber}`, panel1_X + 70, y1);
  doc.text(`${customerName || 'N/A'}`, panel1_X + 70, y1 + LINE_HEIGHT);
  const addressLines = doc.splitTextToSize(address || (shippingOption === 'In-Store Pickup' ? 'In-Store Pickup' : 'N/A'), panelWidth - 70);
  doc.text(addressLines, panel1_X + 70, y1 + (LINE_HEIGHT * 2));
  
  let y2 = y;
  doc.setFont('helvetica', 'normal');
  doc.text(`Date:`, panel2_X, y2);
  doc.text(`Cashier:`, panel2_X, y2 + LINE_HEIGHT);
  doc.text(`Payment:`, panel2_X, y2 + (LINE_HEIGHT * 2));
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${dateStr}`, panel2_X + 80, y2);
  doc.text(`${adminName}`, panel2_X + 80, y2 + LINE_HEIGHT);
  doc.text(`${paymentMethod}`, panel2_X + 80, y2 + (LINE_HEIGHT * 2));

  y = Math.max(y1 + ((addressLines.length + 1) * LINE_HEIGHT), y2 + (LINE_HEIGHT * 3)) + 20;

  const tableHeaderY = y;
  const colAmt_Right = pageWidth - margin - 5;        
  const colUnit_Right = colAmt_Right - 90;          
  const colQty_Center = colUnit_Right - 45;         
  const colName_Left = margin + 5;                  
  const colName_Width = colQty_Center - 25 - colName_Left; 
  
  const minRowHeight = 25;

  doc.setFillColor(241, 243, 245); 
  doc.rect(margin, tableHeaderY, contentWidth, 20, 'F'); 
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.text('Item Description', colName_Left, tableHeaderY + 14);
  doc.text('Qty', colQty_Center, tableHeaderY + 14, { align: 'center' });
  doc.text('Unit Price', colUnit_Right, tableHeaderY + 14, { align: 'right' });
  doc.text('Amount', colAmt_Right, tableHeaderY + 14, { align: 'right' });

  y = tableHeaderY + 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  
  items.forEach((it, index) => {
    if (y > 750) { 
      doc.addPage();
      y = margin;
    }

    const name = String(it.name || it.product_name || it.productName || '');
    const nameLines = doc.splitTextToSize(name, colName_Width);
    
    const serials = it.serialNumbers || it.serial_numbers || [];
    let serialLines = [];
    if (serials.length > 0) {
      const serialString = "Serials: " + serials.join(', ');
      serialLines = doc.splitTextToSize(serialString, colName_Width - 5); 
    }
    
    const nameHeight = nameLines.length * LINE_HEIGHT;
    const serialHeight = serialLines.length * SMALL_LINE_HEIGHT;
    const rowHeight = Math.max(minRowHeight, nameHeight + serialHeight + 10); 
    
    const yTextStart = y + 16;

    const qty = Number(it.quantity || 0);
    const unit = Number(it.price || it.unitPrice || 0);
    const sub = unit * qty;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE_BODY);
    doc.text(nameLines, colName_Left, yTextStart);
    
    if (serialLines.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(FONT_SIZE_SMALL);
      doc.text(serialLines, colName_Left + 5, yTextStart + nameHeight); 
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE_BODY);
    }

    doc.text(String(qty), colQty_Center, yTextStart, { align: 'center' });
    doc.text(peso(unit), colUnit_Right, yTextStart, { align: 'right' });
    doc.text(peso(sub), colAmt_Right, yTextStart, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.setDrawColor(222, 226, 230); 
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight); 

    y += rowHeight; 
  });
  
  y += 15;
  const totalLabelX = contentWidth - 100; 
  const totalValueX = pageWidth - margin - 5; 

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
    y += (LINE_HEIGHT * 1.5); 
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_HEADER + 2); 
  doc.text('TOTAL:', totalLabelX, y, { align: 'right' });
  doc.text(peso(totalAmount), totalValueX, y, { align: 'right' });
  y += (LINE_HEIGHT * 2);

  y = Math.max(y, 800); 
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.text('Thank you for your purchase!', pageWidth / 2, y, { align: 'center' });

  return doc;
};