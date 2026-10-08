export class BusinessRegisterDto {
  businessName!: string;
  phone!: string;
  email!: string;
  address!: string;
  ownerName!: string;
  ownerMobile!: string;
  ownerEmail!: string;
  password!: string;
  businessTypeId?: string;
  businessType?: string;
  countryId?: string;
  stateId?: string;
  districtId?: string;
  cityId?: string;
  pincode?: string;
}

export class CustomerRegisterDto {
  name!: string;
  mobile!: string;
  email?: string;
  password!: string;
  token?: string;
  guestId?: number;
}

export class ProfileDto {
  name!: string;
  email?: string;
  countryId?: string;
  stateId?: string;
  districtId?: string;
  cityId?: string;
  address?: string;
  pincode?: string;
}
