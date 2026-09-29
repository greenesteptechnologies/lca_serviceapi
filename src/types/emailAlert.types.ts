export interface LoginAlertData {
  email: string;
  userId?: string | number;
  companyId?: string | number;
  userName?: string;
  companyName?: string;
  hostName?: string;
  correlationId?: string;
  ip?: string;
  latitude?: number | null;
  longitude?: number | null;
  state?: string;
  city?: string;
  country?: string;
  deviceName?: string;
  browserName?: string;
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
  hostName?: string;
  correlationId?: string;
}
