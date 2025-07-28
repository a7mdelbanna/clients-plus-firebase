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
    
    // Client Login
    'client_login': 'تسجيل دخول العميل',
    'login': 'تسجيل الدخول',
    'logout': 'تسجيل الخروج',
    'phone_number': 'رقم الهاتف',
    'enter_phone_to_login': 'أدخل رقم هاتفك لتسجيل الدخول',
    'send_otp': 'إرسال رمز التحقق',
    'enter_otp_sent_to': 'أدخل رمز التحقق المرسل إلى',
    'verify': 'تحقق',
    'change_phone': 'تغيير رقم الهاتف',
    'invalid_phone': 'رقم هاتف غير صالح',
    'invalid_otp': 'رمز تحقق غير صالح',
    'login_failed': 'فشل تسجيل الدخول',
    'verification_failed': 'فشل التحقق',
    'my_profile': 'ملفي الشخصي',
    'my_appointments': 'مواعيدي',
    'logged_in_as': 'مسجل الدخول كـ',
    'enter_contact_details': 'أدخل معلومات الاتصال الخاصة بك',
    'enter_your_name': 'أدخل اسمك',
    'enter_phone_number': 'أدخل رقم هاتفك',
    'enter_email': 'أدخل بريدك الإلكتروني',
    'any_special_requests': 'أي طلبات خاصة؟',
    'close': 'إغلاق',
    'error_loading_appointments': 'خطأ في تحميل المواعيد',
    'no_appointments_yet': 'لا توجد مواعيد بعد',
    'confirmed': 'مؤكد',
    'completed': 'مكتمل',
    'cancelled': 'ملغي',
    'pending': 'قيد الانتظار',
    'cancel_appointment': 'إلغاء الموعد',
    'cancel_appointment_warning': 'هل أنت متأكد من رغبتك في إلغاء هذا الموعد؟ لا يمكن التراجع عن هذا الإجراء.',
    'appointment_details': 'تفاصيل الموعد',
    'cancellation_reason_optional': 'سبب الإلغاء (اختياري)',
    'cancellation_reason_placeholder': 'أخبرنا لماذا تريد إلغاء هذا الموعد',
    'keep_appointment': 'الاحتفاظ بالموعد',
    'confirm_cancellation': 'تأكيد الإلغاء',
    'error_cancelling_appointment': 'خطأ في إلغاء الموعد',
    'appointment_cancelled_successfully': 'تم إلغاء الموعد بنجاح',
    'cancel': 'إلغاء',
    'cannot_cancel_past_appointments': 'لا يمكن إلغاء المواعيد السابقة',
    'cannot_cancel_appointment': 'لا يمكن إلغاء هذا الموعد',
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
    
    // Client Login
    'client_login': 'Client Login',
    'login': 'Login',
    'logout': 'Logout',
    'phone_number': 'Phone Number',
    'enter_phone_to_login': 'Enter your phone number to login',
    'send_otp': 'Send OTP',
    'enter_otp_sent_to': 'Enter the OTP sent to',
    'verify': 'Verify',
    'change_phone': 'Change Phone',
    'invalid_phone': 'Invalid phone number',
    'invalid_otp': 'Invalid OTP',
    'login_failed': 'Login failed',
    'verification_failed': 'Verification failed',
    'my_profile': 'My Profile',
    'my_appointments': 'My Appointments',
    'logged_in_as': 'Logged in as',
    'enter_contact_details': 'Enter your contact details',
    'enter_your_name': 'Enter your name',
    'enter_phone_number': 'Enter your phone number',
    'enter_email': 'Enter your email',
    'any_special_requests': 'Any special requests?',
    'close': 'Close',
    'error_loading_appointments': 'Error loading appointments',
    'no_appointments_yet': 'No appointments yet',
    'confirmed': 'Confirmed',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'pending': 'Pending',
    'cancel_appointment': 'Cancel Appointment',
    'cancel_appointment_warning': 'Are you sure you want to cancel this appointment? This action cannot be undone.',
    'appointment_details': 'Appointment Details',
    'cancellation_reason_optional': 'Cancellation Reason (Optional)',
    'cancellation_reason_placeholder': 'Tell us why you want to cancel this appointment',
    'keep_appointment': 'Keep Appointment',
    'confirm_cancellation': 'Confirm Cancellation',
    'error_cancelling_appointment': 'Error cancelling appointment',
    'appointment_cancelled_successfully': 'Appointment cancelled successfully',
    'cancel': 'Cancel',
    'cannot_cancel_past_appointments': 'Cannot cancel past appointments',
    'cannot_cancel_appointment': 'Cannot cancel this appointment',
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