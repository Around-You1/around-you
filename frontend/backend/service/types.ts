// Mirrors the Go appdb.ServiceData JSON shape.
// The forms treat a service category as a free string; kept permissive here.
export type ServiceCategory = string;

export interface BookingItem {
  name: string;
  price: number;
  duration: number; // minutes
}

export interface ServiceData {
  id: number;
  serviceId: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  country: string;
  province: string;
  area?: string;
  postalCode: string;
  contactNumber?: string;
  description?: string;
  profileReferenceCode?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
  serviceCategories: ServiceCategory[];
  littleExplorerApproved: boolean;
  paymentCard: boolean;
  paymentCash: boolean;
  paymentMobile: boolean;
  wheelchairAccess: boolean;
  parkingAvailability: boolean;
  discountOffered?: string;
  discountCode?: string;
  localDiscountOffered?: string;
  localDiscountCode?: string;
  imageUrl?: string;
  imageUrls?: string[];
  isActive: boolean;
  officialHoldingCompany?: string;
  officialContactName?: string;
  officialContactNumber?: string;
  officialEmail?: string;
  officialRepCode?: string;
  guestType?: string;
  accessLevel?: string;

  bookingItems?: BookingItem[];

  createdAt: string;
  updatedAt: string;
}
