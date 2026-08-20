// Mirrors the Go appdb.Accommodation JSON shape (camelCase per json tags).

export interface EmergencyContact {
  role: string;
  name: string;
  number: string;
}

export interface Accommodation {
  id: number;
  name: string;
  address: string;

  latitude?: number | null;
  longitude?: number | null;

  country: string;
  province: string;
  area?: string;
  postalCode: string;

  contact?: string;
  description?: string;

  profileReferenceCode?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;

  wheelchairAccess: boolean;
  parkingAvailability: boolean;
  facilities: string[];

  wifiName?: string;
  wifiPassword?: string;
  wifiCredentials?: string;

  checkInInstructions?: string;
  checkOutInstructions?: string;
  amenities?: string;
  guidelines?: string;

  primaryContact?: string;
  policeContact?: string;
  doctorContact?: string;
  ambulanceContact?: string;
  hospitalContact?: string;
  fireDepartmentContact?: string;
  snakeCatchersContact?: string;
  nsriContact?: string;
  vetContact?: string;
  communityWatchContact?: string;
  localSecurityContact?: string;

  emergencyContacts?: EmergencyContact[];

  imageUrl?: string;
  imageUrls?: string[];

  isActive: boolean;

  officialHoldingCompany?: string;
  officialContactName?: string;
  officialContactNumber?: string;
  officialEmail?: string;
  officialRepCode?: string;
  officialRepName?: string;
  companyRegNumber?: string;
  companyVatNumber?: string;
  guestType?: string;
  accessLevel?: string;

  createdAt: string;
  updatedAt: string;
}
