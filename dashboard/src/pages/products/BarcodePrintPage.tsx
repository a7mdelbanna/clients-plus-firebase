import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Print,
  Save,
  FileDownload,
  Settings,
  ChevronLeft,
  ChevronRight,
  Delete,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { productService } from '../../services/product.service';
import type { Product } from '../../types/product.types';
import type {
  LabelTemplate,
  PrintableProduct,
} from '../../types/labelPrinting.types';
import { PRESET_TEMPLATES } from '../../types/labelPrinting.types';
import {
  calculateLabelLayout,
  distributeProductsToLabels,
} from '../../utils/labelLayoutCalculator';
import ProductSelection from '../../components/products/ProductSelection';
import LabelPreview from '../../components/products/LabelPreview';
// import TemplateSelector from '../../components/products/TemplateSelector';

interface SavedTemplate {
  products: PrintableProduct[];
  template: LabelTemplate;
  name: string;
  savedAt: string;
}

const BarcodePrintPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isRTL = theme.direction === 'rtl';

  // State
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<PrintableProduct[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<LabelTemplate>(() => {
    const firstTemplate = PRESET_TEMPLATES[0];
    return {
      id: 'default',
      name: firstTemplate.name!,
      companyId: currentUser?.companyId || '',
      userId: currentUser?.uid || '',
      isDefault: true,
      layout: firstTemplate.layout!,
      labelDesign: firstTemplate.labelDesign!,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
  });
  const [showSettings, setShowSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);

  // Load products and saved templates
  useEffect(() => {
    loadProducts();
    loadSavedTemplates();
  }, [currentUser?.companyId]);

  const loadSavedTemplates = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('savedBarcodeTemplates') || '[]');
      setSavedTemplates(saved);
    } catch (error) {
      console.error('Error loading saved templates:', error);
      setSavedTemplates([]);
    }
  };

  const loadProducts = async () => {
    if (!currentUser?.companyId) return;

    try {
      setLoading(true);
      const result = await productService.getProducts(currentUser.companyId);
      setProducts(result.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Calculate layout
  const layoutCalculation = calculateLabelLayout(activeTemplate.layout);
  const labelPages = distributeProductsToLabels(
    selectedProducts.map(p => ({ id: p.id, quantity: p.quantity })),
    layoutCalculation.totalLabels
  );

  // Debug: Log selected products
  React.useEffect(() => {
    console.log('Selected products updated:', selectedProducts);
    console.log('Label pages:', labelPages);
    console.log('Active template:', activeTemplate);
  }, [selectedProducts, labelPages, activeTemplate]);

  const handlePrint = () => {
    if (selectedProducts.length === 0) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(isRTL ? 'فشل في فتح نافذة الطباعة' : 'Failed to open print window');
      return;
    }

    // Generate HTML content for printing
    const printContent = generatePrintContent();
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  const handleExportPDF = async () => {
    if (selectedProducts.length === 0) return;
    
    try {
      // For now, we'll use the print functionality
      // In the future, this could use jsPDF or similar library
      const printContent = generatePrintContent();
      
      const blob = new Blob([printContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode-labels-${new Date().getTime()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert(isRTL ? 'خطأ في تصدير PDF' : 'Error exporting PDF');
    }
  };

  const generatePrintContent = (): string => {
    const { layout, labelDesign } = activeTemplate;
    const layoutCalc = calculateLabelLayout(layout);
    const { labelWidth, labelHeight } = layoutCalc;
    const marginTop = layout.margins.top;
    const marginLeft = layout.margins.left;
    const gapX = layout.spacing.horizontal;
    const gapY = layout.spacing.vertical;
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Barcode Labels</title>
        <style>
          @page {
            size: ${layout.pageSize.toLowerCase()};
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            font-size: ${labelDesign.elements.productName.fontSize}px;
          }
          
          .page {
            width: 100%;
            height: 100vh;
            position: relative;
            page-break-after: always;
            padding: ${marginTop}mm 0 0 ${marginLeft}mm;
            box-sizing: border-box;
          }
          
          .page:last-child {
            page-break-after: avoid;
          }
          
          .label {
            position: absolute;
            width: ${labelWidth}mm;
            height: ${labelHeight}mm;
            border: ${labelDesign.borderWidth > 0 ? `${labelDesign.borderWidth}px solid ${labelDesign.borderColor}` : 'none'};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 2mm;
            box-sizing: border-box;
            overflow: hidden;
          }
          
          .barcode {
            max-width: 100%;
            max-height: 60%;
            margin-bottom: 2mm;
          }
          
          .product-name {
            font-size: ${Math.max(8, labelDesign.elements.productName.fontSize - 2)}px;
            font-weight: bold;
            margin-bottom: 1mm;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          
          .product-price {
            font-size: ${Math.max(6, labelDesign.elements.price.fontSize)}px;
            color: #333;
            font-weight: bold;
          }
          
          .product-sku {
            font-size: ${Math.max(6, labelDesign.elements.sku.fontSize)}px;
            color: #666;
            margin-top: 1mm;
          }
        </style>
        <script src="https://unpkg.com/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
    `;
    
    // Generate pages
    labelPages.forEach((pageProducts, pageIndex) => {
      html += `<div class="page">`;
      
      pageProducts.forEach((labelProduct, labelIndex) => {
        const product = selectedProducts.find(p => p.id === labelProduct.productId);
        if (!product) return;
        
        const row = Math.floor(labelIndex / layout.labelsPerRow);
        const col = labelIndex % layout.labelsPerRow;
        const left = col * (labelWidth + gapX);
        const top = row * (labelHeight + gapY);
        
        html += `
          <div class="label" style="left: ${left}mm; top: ${top}mm;">
            ${product.barcode ? `
              <svg class="barcode" id="barcode-${pageIndex}-${labelIndex}"></svg>
              <script>
                JsBarcode("#barcode-${pageIndex}-${labelIndex}", "${product.barcode}", {
                  format: "CODE128",
                  width: 1,
                  height: 40,
                  displayValue: false,
                  margin: 0
                });
              </script>
            ` : ''}
            
            ${labelDesign.elements.productName.visible ? `
              <div class="product-name">${isRTL ? (product.nameAr || product.name) : product.name}</div>
            ` : ''}
            
            ${labelDesign.elements.price.visible ? `
              <div class="product-price">${product.price} ${isRTL ? 'ج.م' : 'EGP'}</div>
            ` : ''}
            
            ${labelDesign.elements.sku.visible && product.sku ? `
              <div class="product-sku">${product.sku}</div>
            ` : ''}
          </div>
        `;
      });
      
      html += `</div>`;
    });
    
    html += `
      </body>
      </html>
    `;
    
    return html;
  };

  const handleSaveTemplateUnused = async () => {
    if (selectedProducts.length === 0) {
      alert(isRTL ? 'الرجاء اختيار منتجات أولاً' : 'Please select products first');
      return;
    }

    const templateName = prompt(
      isRTL ? 'ادخل اسم القالب:' : 'Enter template name:',
      `Template ${new Date().toLocaleDateString()}`
    );
    
    if (!templateName) return;
    
    try {
      const customTemplate: LabelTemplate = {
        id: `custom-${Date.now()}`,
        name: templateName,
        companyId: currentUser?.companyId || '',
        userId: currentUser?.uid || '',
        isDefault: false,
        layout: activeTemplate.layout,
        labelDesign: activeTemplate.labelDesign,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };
      
      // Save to localStorage for now (in the future, this would save to Firestore)
      const existingTemplates = JSON.parse(localStorage.getItem('customLabelTemplates') || '[]');
      existingTemplates.push(customTemplate);
      localStorage.setItem('customLabelTemplates', JSON.stringify(existingTemplates));
      
      alert(isRTL ? 'تم حفظ القالب بنجاح' : 'Template saved successfully');
      // Note: Template saving functionality needs proper implementation with Firestore
    } catch (error) {
      console.error('Error saving template:', error);
      alert(isRTL ? 'خطأ في حفظ القالب' : 'Error saving template');
    }
  };

  // Suppress unused warning
  void handleSaveTemplateUnused;

  const handleSaveSetup = async () => {
    if (selectedProducts.length === 0) {
      alert(isRTL ? 'الرجاء اختيار منتجات أولاً' : 'Please select products first');
      return;
    }

    const setupName = prompt(
      isRTL ? 'ادخل اسم الإعداد:' : 'Enter setup name:',
      `Setup ${new Date().toLocaleDateString()}`
    );
    
    if (!setupName) return;
    
    try {
      const savedSetup: SavedTemplate = {
        name: setupName,
        products: selectedProducts,
        template: activeTemplate,
        savedAt: new Date().toISOString(),
      };
      
      const existingSetups = JSON.parse(localStorage.getItem('savedBarcodeTemplates') || '[]');
      existingSetups.push(savedSetup);
      localStorage.setItem('savedBarcodeTemplates', JSON.stringify(existingSetups));
      setSavedTemplates(existingSetups);
      
      alert(isRTL ? 'تم حفظ الإعداد بنجاح' : 'Setup saved successfully');
    } catch (error) {
      console.error('Error saving setup:', error);
      alert(isRTL ? 'خطأ في حفظ الإعداد' : 'Error saving setup');
    }
  };

  const handleLoadSetup = (setup: SavedTemplate) => {
    setSelectedProducts(setup.products);
    setActiveTemplate(setup.template);
    alert(isRTL ? 'تم تحميل الإعداد بنجاح' : 'Setup loaded successfully');
  };

  const handleDeleteSetup = (index: number) => {
    if (confirm(isRTL ? 'هل أنت متأكد من حذف هذا الإعداد؟' : 'Are you sure you want to delete this setup?')) {
      const updated = savedTemplates.filter((_, i) => i !== index);
      setSavedTemplates(updated);
      localStorage.setItem('savedBarcodeTemplates', JSON.stringify(updated));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" component="h1">
          {isRTL ? 'طباعة الباركود' : 'Barcode Printing'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={isRTL ? <ChevronRight /> : <ChevronLeft />}
          onClick={() => navigate('/products')}
        >
          {isRTL ? 'العودة للمنتجات' : 'Back to Products'}
        </Button>
      </Box>

      {/* Top Row: Product Selection */}
      <Box sx={{ mb: 2 }}>
        <Paper sx={{ 
          p: 2, 
          height: '400px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Typography variant="h6" gutterBottom>
            {isRTL ? 'اختر المنتجات' : 'Select Products'}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <ProductSelection
              products={products}
              selectedProducts={selectedProducts}
              onSelectionChange={setSelectedProducts}
              loading={loading}
            />
          </Box>
        </Paper>
      </Box>

      {/* Second Row: Settings and Templates */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        flexDirection: { xs: 'column', md: 'row' },
        mb: 2
      }}>
        {/* Left Panel - Quick Stats and Actions */}
        <Box sx={{ 
          flex: 1,
          minWidth: 0
        }}>
          <Paper sx={{ 
            p: 2, 
            height: '300px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Typography variant="h6" gutterBottom>
              {isRTL ? 'الإعدادات السريعة' : 'Quick Settings'}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Quick stats */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {isRTL ? 'إحصائيات سريعة' : 'Quick Stats'}
              </Typography>
              <Typography variant="body2">
                {isRTL 
                  ? `المنتجات المحددة: ${selectedProducts.length}`
                  : `Selected Products: ${selectedProducts.length}`
                }
              </Typography>
              <Typography variant="body2">
                {isRTL 
                  ? `إجمالي الملصقات: ${selectedProducts.reduce((sum, p) => sum + p.quantity, 0)}`
                  : `Total Labels: ${selectedProducts.reduce((sum, p) => sum + p.quantity, 0)}`
                }
              </Typography>
              <Typography variant="body2">
                {isRTL 
                  ? `الصفحات المطلوبة: ${labelPages.length}`
                  : `Pages Required: ${labelPages.length}`
                }
              </Typography>
            </Box>

            {/* Saved Setups */}
            {savedTemplates.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {isRTL ? 'الإعدادات المحفوظة' : 'Saved Setups'}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 120, overflow: 'auto' }}>
                  {savedTemplates.map((setup, index) => (
                    <Box key={index} sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      p: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      fontSize: '0.75rem'
                    }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" noWrap fontWeight="bold">
                          {setup.name}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {setup.products.length} {isRTL ? 'منتج' : 'products'}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => handleLoadSetup(setup)} title={isRTL ? 'تحميل' : 'Load'}>
                        <FileDownload sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteSetup(index)} title={isRTL ? 'حذف' : 'Delete'}>
                        <Delete sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 'auto' }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Print />}
                onClick={handlePrint}
                disabled={selectedProducts.length === 0}
                size="small"
              >
                {isRTL ? 'طباعة' : 'Print'}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<FileDownload />}
                onClick={handleExportPDF}
                disabled={selectedProducts.length === 0}
                size="small"
              >
                {isRTL ? 'تصدير PDF' : 'Export PDF'}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<Save />}
                onClick={handleSaveSetup}
                disabled={selectedProducts.length === 0}
                size="small"
              >
                {isRTL ? 'حفظ الإعداد' : 'Save Setup'}
              </Button>
            </Box>
          </Paper>
        </Box>

        {/* Right Panel - Template Selection */}
        <Box sx={{ 
          flex: 1,
          minWidth: 0
        }}>
          <Paper sx={{ 
            p: 2, 
            height: '300px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Typography variant="h6" gutterBottom>
              {isRTL ? 'قوالب الملصقات' : 'Label Templates'}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: 2,
              flex: 1,
              overflow: 'auto'
            }}>
              {PRESET_TEMPLATES.map((template, index) => {
                const isActive = activeTemplate.name === template.name;
                return (
                  <Box
                    key={index}
                    onClick={() => {
                      if (template.layout && template.labelDesign) {
                        setActiveTemplate({
                          id: `preset-${index}`,
                          name: template.name!,
                          companyId: currentUser?.companyId || '',
                          userId: currentUser?.uid || '',
                          isDefault: index === 0,
                          layout: template.layout,
                          labelDesign: template.labelDesign,
                          createdAt: new Date() as any,
                          updatedAt: new Date() as any,
                        });
                      }
                    }}
                    sx={{
                      p: 2,
                      border: '2px solid',
                      borderColor: isActive ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: isActive ? 'primary.50' : 'background.paper',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: isActive ? 'primary.100' : 'primary.25',
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      },
                      transition: 'all 0.2s ease-in-out',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      minHeight: '100px',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      fontWeight={isActive ? 'bold' : 'medium'}
                      gutterBottom
                      sx={{ color: isActive ? 'primary.main' : 'text.primary' }}
                    >
                      {template.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {template.layout ? `${template.layout.labelsPerRow} × ${template.layout.labelsPerColumn}` : 'Layout'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {template.layout ? `${template.layout.labelsPerRow * template.layout.labelsPerColumn} labels` : 'N/A'}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Bottom Row: Full-Width Preview */}
      <Paper sx={{ 
        p: 2, 
        height: 'calc(100vh - 620px)',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            {isRTL ? 'معاينة الملصقات' : 'Label Preview'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setPreviewScale(s => Math.max(0.3, s - 0.1))}
            >
              -
            </Button>
            <Typography sx={{ px: 2, minWidth: '60px', textAlign: 'center' }}>
              {Math.round(previewScale * 100)}%
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setPreviewScale(s => Math.min(3, s + 0.1))}
            >
              +
            </Button>
            {/* Page navigation */}
            {labelPages.length > 1 && (
              <>
                <Divider orientation="vertical" sx={{ height: 28, mx: 1 }} />
                <IconButton
                  size="small"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  {isRTL ? <ChevronRight /> : <ChevronLeft />}
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: '80px', textAlign: 'center' }}>
                  {isRTL 
                    ? `${currentPage + 1}/${labelPages.length}`
                    : `${currentPage + 1}/${labelPages.length}`
                  }
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setCurrentPage(p => Math.min(labelPages.length - 1, p + 1))}
                  disabled={currentPage === labelPages.length - 1}
                >
                  {isRTL ? <ChevronLeft /> : <ChevronRight />}
                </IconButton>
              </>
            )}
          </Box>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {/* Preview area - Full width */}
        <Box
          sx={{
            backgroundColor: '#f5f5f5',
            borderRadius: 1,
            p: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            position: 'relative'
          }}
        >
          {/* Debug Info */}
          <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, bgcolor: 'background.paper', p: 1, borderRadius: 1, fontSize: '10px' }}>
            Selected: {selectedProducts.length} | Template: {activeTemplate.name} | Layout: {activeTemplate.layout.labelsPerRow}x{activeTemplate.layout.labelsPerColumn}
          </Box>

          {selectedProducts.length === 0 ? (
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              textAlign: 'center'
            }}>
              <Box>
                <Typography color="text.secondary" variant="h6" gutterBottom>
                  {isRTL ? 'اختر منتجات لعرض المعاينة' : 'Select products to preview labels'}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {isRTL ? 'استخدم القائمة أعلاه لاختيار المنتجات' : 'Use the product selection above to choose products'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ 
              flex: 1, 
              overflow: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              py: 3
            }}>
              <Box
                sx={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                }}
              >
                {/* Professional Label Preview */}
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${activeTemplate.layout?.labelsPerRow || 3}, 1fr)`,
                  gap: '2mm',
                  p: '5mm',
                  bgcolor: '#e8e8e8',
                  border: '1px solid #999',
                  borderRadius: 1,
                  minWidth: '400px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  mb: 2
                }}>
                  {selectedProducts.map((product, index) => (
                    <Box
                      key={`${product.id}-${index}`}
                      sx={{
                        width: '63.5mm',
                        height: '25.4mm',
                        border: activeTemplate.labelDesign.borderWidth > 0 ? `${activeTemplate.labelDesign.borderWidth}px solid ${activeTemplate.labelDesign.borderColor}` : 'none',
                        borderRadius: `${activeTemplate.labelDesign.borderRadius}px`,
                        p: '1mm',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'center',
                        bgcolor: activeTemplate.labelDesign.backgroundColor || 'white',
                        position: 'relative',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Product Name */}
                      {activeTemplate.labelDesign.elements.productName.visible && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: activeTemplate.labelDesign.elements.productName.fontWeight,
                            fontSize: `${Math.max(6, activeTemplate.labelDesign.elements.productName.fontSize * 0.6)}px`,
                            color: activeTemplate.labelDesign.elements.productName.color,
                            textAlign: activeTemplate.labelDesign.elements.productName.alignment,
                            lineHeight: 1,
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: '0.5mm'
                          }}
                        >
                          {isRTL && product.nameAr ? product.nameAr : product.name}
                        </Typography>
                      )}
                      
                      {/* Barcode with react-barcode */}
                      {activeTemplate.labelDesign.elements.barcode.visible && product.barcode && (
                        <Box sx={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 1,
                          width: '100%',
                          maxWidth: '100%',
                          my: '0.5mm'
                        }}>
                          <Box 
                            sx={{ 
                              '& svg': { 
                                maxWidth: '100%', 
                                height: 'auto',
                                maxHeight: '12mm'
                              } 
                            }}
                          >
                            <div 
                              dangerouslySetInnerHTML={{
                                __html: `<svg width="150" height="40" xmlns="http://www.w3.org/2000/svg">
                                  <!-- Barcode bars -->
                                  <rect x="5" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="9" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="12" y="5" width="3" height="25" fill="#000"/>
                                  <rect x="17" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="20" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="24" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="27" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="31" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="34" y="5" width="3" height="25" fill="#000"/>
                                  <rect x="39" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="42" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="46" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="49" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="53" y="5" width="3" height="25" fill="#000"/>
                                  <rect x="58" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="61" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="65" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="68" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="72" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="75" y="5" width="3" height="25" fill="#000"/>
                                  <rect x="80" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="83" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="87" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="90" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="94" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="97" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="101" y="5" width="3" height="25" fill="#000"/>
                                  <rect x="106" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="109" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="113" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="116" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="120" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="123" y="5" width="3" height="25" fill="#000"/>
                                  <rect x="128" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="131" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="135" y="5" width="1" height="25" fill="#000"/>
                                  <rect x="138" y="5" width="2" height="25" fill="#000"/>
                                  <rect x="142" y="5" width="2" height="25" fill="#000"/>
                                  <text x="75" y="38" text-anchor="middle" font-family="monospace" font-size="6" fill="#000">${product.barcode}</text>
                                </svg>`
                              }}
                            />
                          </Box>
                        </Box>
                      )}
                      
                      {/* Price */}
                      {activeTemplate.labelDesign.elements.price.visible && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: activeTemplate.labelDesign.elements.price.fontWeight,
                            fontSize: `${Math.max(8, activeTemplate.labelDesign.elements.price.fontSize * 0.7)}px`,
                            color: activeTemplate.labelDesign.elements.price.color,
                            textAlign: activeTemplate.labelDesign.elements.price.alignment,
                            lineHeight: 1,
                            mt: '0.5mm'
                          }}
                        >
                          {product.price} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                      )}
                      
                      {/* SKU */}
                      {activeTemplate.labelDesign.elements.sku.visible && product.sku && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: activeTemplate.labelDesign.elements.sku.fontWeight,
                            fontSize: `${Math.max(5, activeTemplate.labelDesign.elements.sku.fontSize * 0.6)}px`,
                            color: activeTemplate.labelDesign.elements.sku.color,
                            textAlign: activeTemplate.labelDesign.elements.sku.alignment,
                            position: 'absolute',
                            bottom: '0.5mm',
                            right: '0.5mm',
                            opacity: 0.7
                          }}
                        >
                          {product.sku}
                        </Typography>
                      )}
                      
                      {/* Quantity indicator */}
                      {product.quantity > 1 && (
                        <Box sx={{ 
                          position: 'absolute',
                          top: '1mm',
                          right: '1mm',
                          bgcolor: '#ff4444',
                          color: 'white',
                          borderRadius: '50%',
                          width: '4mm',
                          height: '4mm',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '6px',
                          fontWeight: 'bold'
                        }}>
                          {product.quantity}
                        </Box>
                      )}
                    </Box>
                  ))}
                  
                  {/* Fill empty slots with realistic placeholders */}
                  {Array.from({ 
                    length: Math.max(0, (activeTemplate.layout?.labelsPerRow || 3) * (activeTemplate.layout?.labelsPerColumn || 10) - selectedProducts.length) 
                  }).slice(0, 11).map((_, index) => (  // Show max 11 empty slots for visual purposes
                    <Box
                      key={`empty-${index}`}
                      sx={{
                        width: '63.5mm',
                        height: '25.4mm',
                        border: '1px dashed #ccc',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                        fontSize: '8px',
                        bgcolor: '#fafafa'
                      }}
                    >
                      Empty Label
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Print styles */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default BarcodePrintPage;