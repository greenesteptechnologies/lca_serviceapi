export interface LoginAlertData {
  email: string;
  userId?: string | number;
  companyId?: string | number;
  userName?: string;
  companyName?: string;
  correlationId?: string;
}

export interface RegistrationAlertData {
  email: string;
  userName?: string;
  userId?: string | number;
  companyName?: string;
  companyId?: string | number;
  role?: string;
  phoneNumber?: string;
  companyType?: string;
  industry?: string;
  registrationStatus?: string;
  registeredAt?: string;
  correlationId?: string;
}
