// Mirrors the Go appdb.AttractionData JSON shape.

export interface BookingItem {
  name: string;
  price: number;
  duration: number; // minutes
}

export interface AttractionData {
  id: number;
  attractionId: string;
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

  attractionType: string[];
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
