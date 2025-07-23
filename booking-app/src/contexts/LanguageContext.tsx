import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

// Translation strings
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // General
    'book_appointment': 'احجز موعدك',
    'next': 'التالي',
    'previous': 'السابق',
    'confirm': 'تأكيد',
    'cancel': 'إلغاء',
    'select': 'اختر',
    'loading': 'جاري التحميل...',
    'error': 'خطأ',
    'success': 'نجح',
    
    // Branch Selection
    'select_branch': 'اختر الفرع',
    'branch': 'الفرع',
    'branches': 'الفروع',
    'main_branch': 'الفرع الرئيسي',
    
    // Booking Flow
    'select_service': 'اختر الخدمة',
    'select_specialist': 'اختر المختص',
    'select_date_time': 'اختر التاريخ والوقت',
    'any_specialist': 'أي مختص متاح',
    
    // Services
    'services': 'الخدمات',
    'service': 'الخدمة',
    'duration': 'المدة',
    'price': 'السعر',
    'egp': 'ج.م',
    'minutes': 'دقيقة',
    'hours': 'ساعة',
    
    // Date & Time
    'date': 'التاريخ',
    'time': 'الوقت',
    'available_times': 'الأوقات المتاحة',
    'morning': 'صباحاً',
    'afternoon': 'بعد الظهر',
    'evening': 'مساءً',
    'no_available_times': 'لا توجد أوقات متاحة',
    
    // Customer Info
    'customer_info': 'معلومات العميل',
    'name': 'الاسم',
    'phone': 'رقم الهاتف',
    'email': 'البريد الإلكتروني',
    'comments': 'ملاحظات',
    'optional': 'اختياري',
    
    // Confirmation
    'booking_confirmed': 'تم تأكيد الحجز',
    'booking_summary': 'ملخص الحجز',
    'book_another': 'حجز آخر',
    'whatsapp_confirmation': 'سيتم إرسال تأكيد عبر واتساب',
    
    // Errors
    'booking_failed': 'فشل الحجز',
    'try_again': 'حاول مرة أخرى',
    'invalid_link': 'رابط غير صالح',
    'link_not_found': 'الرابط غير موجود',
    
    // Additional
    'closed': 'مغلق',
    'no_branches_available': 'لا توجد فروع متاحة',
    'choose_branch_to_continue': 'اختر الفرع الذي تود الحجز فيه',
    'view_on_map': 'عرض على الخريطة',
    'confirmation': 'التأكيد',
    'select_multiple_services': 'يمكنك اختيار أكثر من خدمة',
    'select_one_service': 'اختر خدمة واحدة',
    'search_services': 'البحث عن الخدمات...',
    'all': 'الكل',
    'uncategorized': 'غير مصنف',
    'no_services_found': 'لا توجد خدمات متاحة',
    'selected_services': 'الخدمات المختارة',
  },
  en: {
    // General
    'book_appointment': 'Book Your Appointment',
    'next': 'Next',
    'previous': 'Previous',
    'confirm': 'Confirm',
    'cancel': 'Cancel',
    'select': 'Select',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    
    // Branch Selection
    'select_branch': 'Select Branch',
    'branch': 'Branch',
    'branches': 'Branches',
    'main_branch': 'Main Branch',
    
    // Booking Flow
    'select_service': 'Select Service',
    'select_specialist': 'Select Specialist',
    'select_date_time': 'Select Date & Time',
    'any_specialist': 'Any Available Specialist',
    
    // Services
    'services': 'Services',
    'service': 'Service',
    'duration': 'Duration',
    'price': 'Price',
    'egp': 'EGP',
    'minutes': 'minutes',
    'hours': 'hour',
    
    // Date & Time
    'date': 'Date',
    'time': 'Time',
    'available_times': 'Available Times',
    'morning': 'Morning',
    'afternoon': 'Afternoon',
    'evening': 'Evening',
    'no_available_times': 'No available times',
    
    // Customer Info
    'customer_info': 'Customer Information',
    'name': 'Name',
    'phone': 'Phone Number',
    'email': 'Email',
    'comments': 'Comments',
    'optional': 'optional',
    
    // Confirmation
    'booking_confirmed': 'Booking Confirmed',
    'booking_summary': 'Booking Summary',
    'book_another': 'Book Another',
    'whatsapp_confirmation': 'Confirmation will be sent via WhatsApp',
    
    // Errors
    'booking_failed': 'Booking Failed',
    'try_again': 'Try Again',
    'invalid_link': 'Invalid Link',
    'link_not_found': 'Link not found',
    
    // Additional
    'closed': 'Closed',
    'no_branches_available': 'No branches available',
    'choose_branch_to_continue': 'Choose the branch you would like to book at',
    'view_on_map': 'View on Map',
    'confirmation': 'Confirmation',
    'select_multiple_services': 'You can select multiple services',
    'select_one_service': 'Select one service',
    'search_services': 'Search services...',
    'all': 'All',
    'uncategorized': 'Uncategorized',
    'no_services_found': 'No services available',
    'selected_services': 'Selected Services',
  },
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('bookingLanguage');
    return (saved as Language) || 'ar';
  });

  const isRTL = language === 'ar';

  useEffect(() => {
    localStorage.setItem('bookingLanguage', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    isRTL,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};