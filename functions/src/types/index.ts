export interface UserRole {
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CLIENT";
  companyId: string | null;
  permissions?: string[];
  isSuperAdmin?: boolean;
}

export interface Company {
  id: string;
  name: string;
  country: string;
  currency: string;
  createdAt: FirebaseFirestore.Timestamp;
  active: boolean;
  subscription: {
    plan: "TRIAL" | "BASIC" | "PREMIUM" | "ENTERPRISE";
    status: "ACTIVE" | "EXPIRED" | "CANCELLED";
    startDate: FirebaseFirestore.Timestamp;
    endDate: Date;
  };
  settings: {
    language: string;
    timezone: string;
    workingHours: {
      [key: string]: {
        open: string;
        close: string;
        isOpen: boolean;
      };
    };
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CLIENT";
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  companyId?: string;
  phone?: string;
  permissions?: string[];
}