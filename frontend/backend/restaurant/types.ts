// Mirrors the Go appdb.Restaurant JSON shape.

export interface BookingItem {
  name: string;
  price: number;
  duration: number; // minutes
}

export interface Restaurant {
  id: number;
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

  cuisineTypes: string[];
  menuLink?: string;
  serviceDineIn: boolean;
  serviceTakeaway: boolean;
  serviceDelivery: boolean;
  littleExplorerApproved: boolean;

  paymentCard: boolean;
  paymentCash: boolean;
  paymentMobile: boolean;

  wheelchairAccess: boolean;
  parkingAvailability: boolean;

  wifiNetwork?: string;
  wifiPassword?: string;
  wifiCredentials?: string;

  discountOffered?: string;
  discountCode?: string;

  bookingsEmail?: string;
  bookingsContactNumber?: string;

  socialsWebsite?: string;
  socialsFacebook?: string;
  socialsInstagram?: string;
  socialsTwitter?: string;
  socialsTiktok?: string;
  socialsYoutube?: string;

  imageUrl?: string;
  menuPdfUrls?: string[];
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
