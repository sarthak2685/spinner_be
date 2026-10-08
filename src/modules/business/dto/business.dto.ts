export class BusinessProfileDto {
  businessName!: string;
  phone!: string;
  email!: string;
  address!: string;
  tagline?: string;
  description?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  whatsappNumber?: string;
  website?: string;
  supportEmail?: string;
  themeColor?: string;
  countryId?: string;
  stateId?: string;
  districtId?: string;
  cityId?: string;
  pincode?: string;
  latitude?: string;
  longitude?: string;
  googleMapUrl?: string;
  googleReviewUrl?: string;
  businessTypeId?: string;
}

export class ExperienceDto {
  menuEnabled?: string;
  playEnabled?: string;
  reviewEnabled?: string;
  stationLabel?: string;
  stationPlaceholder?: string;
  catalogTitle?: string;
  reviewKeywords?: string;
}

export class CustomerDto {
  id?: string;
  customerName!: string;
  mobile?: string;
  email?: string;
  password?: string;
  totalCoins?: string;
}
