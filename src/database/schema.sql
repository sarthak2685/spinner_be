CREATE TABLE IF NOT EXISTS public."Countries" (
  countryid SERIAL PRIMARY KEY,
  countryname VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public."States" (
  stateid SERIAL PRIMARY KEY,
  countryid INTEGER NOT NULL REFERENCES public."Countries"(countryid) ON DELETE CASCADE,
  statename VARCHAR(100) NOT NULL,
  UNIQUE (countryid, statename)
);

CREATE TABLE IF NOT EXISTS public."Districts" (
  districtid SERIAL PRIMARY KEY,
  stateid INTEGER NOT NULL REFERENCES public."States"(stateid) ON DELETE CASCADE,
  districtname VARCHAR(100) NOT NULL,
  UNIQUE (stateid, districtname)
);

CREATE TABLE IF NOT EXISTS public."Cities" (
  cityid SERIAL PRIMARY KEY,
  districtid INTEGER NOT NULL REFERENCES public."Districts"(districtid) ON DELETE CASCADE,
  cityname VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS public."BusinessTypes" (
  businesstypeid SERIAL PRIMARY KEY,
  typename VARCHAR(100) UNIQUE NOT NULL,
  typecode VARCHAR(50) NOT NULL,
  hubtitle VARCHAR(100) NOT NULL,
  hubsubtitle VARCHAR(150) NOT NULL,
  hubicon VARCHAR(50) NOT NULL DEFAULT '🍽',
  hubbadge VARCHAR(50) NOT NULL DEFAULT 'Digital Order',
  catalogtitle VARCHAR(100) NOT NULL DEFAULT 'Online Menu',
  categoryterm VARCHAR(50) NOT NULL DEFAULT 'Category',
  itemterm VARCHAR(50) NOT NULL DEFAULT 'Item',
  stationlabel VARCHAR(100) NOT NULL DEFAULT 'Table / Room No.',
  stationplaceholder VARCHAR(150) NOT NULL DEFAULT 'e.g., Table 4',
  actionbuttontext VARCHAR(50) NOT NULL DEFAULT 'Place Order',
  isactive BOOLEAN NOT NULL DEFAULT true,
  displayorder INT NOT NULL DEFAULT 0,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Businesses" (
  businessid SERIAL PRIMARY KEY,
  businessname VARCHAR(200) NOT NULL,
  businesstype VARCHAR(100),
  businesstypeid INTEGER,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  isactive BOOLEAN DEFAULT true,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  businesstoken VARCHAR(50) UNIQUE,
  logoimagepath TEXT,
  bannerimagepath TEXT,
  tagline VARCHAR(250),
  description TEXT,
  facebookurl VARCHAR(500),
  instagramurl VARCHAR(500),
  linkedinurl VARCHAR(500),
  twitterurl VARCHAR(500),
  youtubeurl VARCHAR(500),
  whatsappnumber VARCHAR(20),
  website VARCHAR(200),
  supportemail VARCHAR(100),
  themecolor VARCHAR(50),
  countryid INTEGER,
  stateid INTEGER,
  districtid INTEGER,
  cityid INTEGER,
  pincode VARCHAR(20),
  latitude VARCHAR(50),
  longitude VARCHAR(50),
  googlemapurl TEXT,
  googlereviewurl VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS public."Customers" (
  customerid SERIAL PRIMARY KEY,
  businessid INTEGER,
  customername VARCHAR(200),
  mobile VARCHAR(20),
  email VARCHAR(150),
  passwordhash TEXT,
  totalcoins INTEGER DEFAULT 0,
  failedloginattempts INTEGER DEFAULT 0,
  lockoutend TIMESTAMP,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Users" (
  userid SERIAL PRIMARY KEY,
  businessid INTEGER,
  fullname VARCHAR(200),
  mobile VARCHAR(20),
  email VARCHAR(100),
  passwordhash TEXT,
  role VARCHAR(50),
  failedloginattempts INTEGER DEFAULT 0,
  lockoutend TIMESTAMP,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."BusinessExperienceSettings" (
  settingid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL UNIQUE REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  menuenabled BOOLEAN NOT NULL DEFAULT true,
  playenabled BOOLEAN NOT NULL DEFAULT true,
  reviewenabled BOOLEAN NOT NULL DEFAULT true,
  stationlabel VARCHAR(100),
  stationplaceholder VARCHAR(150),
  catalogtitle VARCHAR(100),
  reviewkeywords TEXT,
  updateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."QRCodes" (
  qrcodeid SERIAL PRIMARY KEY,
  businessid INTEGER,
  qrname VARCHAR(200),
  qrcodetext TEXT,
  code TEXT,
  imagepath TEXT,
  isactive BOOLEAN DEFAULT true,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."GameConfigurations" (
  gameconfigurationid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  configurationname VARCHAR(150) NOT NULL,
  gamecode VARCHAR(50) NOT NULL,
  isactive BOOLEAN DEFAULT true,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."PrizeConfigurations" (
  prizeconfigurationid SERIAL PRIMARY KEY,
  gameconfigurationid INTEGER,
  spinwheelconfigurationid INTEGER,
  prizename VARCHAR(150) NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  winningpercentage NUMERIC NOT NULL DEFAULT 0,
  isactive BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."GamePlays" (
  gameplayid SERIAL PRIMARY KEY,
  customerid INTEGER,
  businessid INTEGER,
  prizeconfigurationid INTEGER,
  coinswon INTEGER DEFAULT 0,
  gamecode VARCHAR(50),
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Rewards" (
  rewardid SERIAL PRIMARY KEY,
  businessid INTEGER,
  rewardname VARCHAR(200),
  description TEXT,
  coinsrequired INTEGER,
  isactive BOOLEAN DEFAULT true,
  imagepath TEXT,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."RewardRedemptions" (
  rewardredemptionid SERIAL PRIMARY KEY,
  customerid INTEGER NOT NULL,
  rewardid INTEGER NOT NULL,
  businessid INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updateddate TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."MenuCategories" (
  categoryid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  categoryname VARCHAR(150) NOT NULL,
  displayorder INTEGER NOT NULL DEFAULT 0,
  isactive BOOLEAN NOT NULL DEFAULT true,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."MenuItems" (
  itemid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  categoryid INTEGER NOT NULL REFERENCES public."MenuCategories"(categoryid) ON DELETE CASCADE,
  itemname VARCHAR(200) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  imagepath TEXT,
  displayorder INTEGER NOT NULL DEFAULT 0,
  isavailable BOOLEAN NOT NULL DEFAULT true,
  isactive BOOLEAN NOT NULL DEFAULT true,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Orders" (
  orderid SERIAL PRIMARY KEY,
  ordernumber VARCHAR(50) NOT NULL UNIQUE,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  customerid INTEGER NOT NULL REFERENCES public."Customers"(customerid) ON DELETE CASCADE,
  totalamount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  remarks TEXT,
  tablenumber VARCHAR(100),
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."OrderItems" (
  orderitemid SERIAL PRIMARY KEY,
  orderid INTEGER NOT NULL REFERENCES public."Orders"(orderid) ON DELETE CASCADE,
  itemid INTEGER NOT NULL REFERENCES public."MenuItems"(itemid) ON DELETE RESTRICT,
  itemname VARCHAR(200) NOT NULL,
  unitprice NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."PurchaseClaims" (
  purchaseclaimid SERIAL PRIMARY KEY,
  customerid INTEGER NOT NULL REFERENCES public."Customers"(customerid) ON DELETE CASCADE,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  purchaseamount NUMERIC(10,2) NOT NULL,
  coins INTEGER NOT NULL,
  purchasedate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invoicenumber VARCHAR(100),
  remarks TEXT,
  billimagepath TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  approveddate TIMESTAMP,
  approvedbyuserid INTEGER,
  rejectionreason TEXT
);

CREATE TABLE IF NOT EXISTS public."WalletTransactions" (
  wallettransactionid SERIAL PRIMARY KEY,
  customerid INTEGER,
  businessid INTEGER,
  coins INTEGER,
  transactiontype VARCHAR(50),
  description TEXT,
  remarks TEXT,
  isexpired BOOLEAN DEFAULT false,
  expirydate TIMESTAMP,
  coinsused INTEGER DEFAULT 0,
  expiredcoins INTEGER DEFAULT 0,
  purchaseclaimid INTEGER,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."NotificationTemplates" (
  templateid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  isactive BOOLEAN DEFAULT true,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Notifications" (
  notificationid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  createdby VARCHAR(100) NOT NULL,
  recipientcount INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Sent',
  targetsegment VARCHAR(100) NOT NULL,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."CustomerNotifications" (
  customernotificationid SERIAL PRIMARY KEY,
  customerid INTEGER NOT NULL REFERENCES public."Customers"(customerid) ON DELETE CASCADE,
  notificationid INTEGER,
  businessid INTEGER,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  notificationtype VARCHAR(50) NOT NULL DEFAULT 'General',
  isread BOOLEAN NOT NULL DEFAULT false,
  readdate TIMESTAMP,
  isdeleted BOOLEAN NOT NULL DEFAULT false,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."CustomerDeviceTokens" (
  deviceid SERIAL PRIMARY KEY,
  customerid INTEGER REFERENCES public."Customers"(customerid) ON DELETE CASCADE,
  devicetoken TEXT NOT NULL UNIQUE,
  devicetype VARCHAR(50) NOT NULL DEFAULT 'Web',
  isactive BOOLEAN DEFAULT true,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."UserTokens" (
  tokenid SERIAL PRIMARY KEY,
  token VARCHAR(100) NOT NULL UNIQUE,
  userid INTEGER,
  customerid INTEGER,
  expires TIMESTAMP NOT NULL,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."PasswordResets" (
  resetid SERIAL PRIMARY KEY,
  token VARCHAR(100) NOT NULL UNIQUE,
  userid INTEGER,
  customerid INTEGER,
  expires TIMESTAMP NOT NULL,
  isused BOOLEAN DEFAULT false,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."AuditLogs" (
  auditlogid SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  userid INTEGER,
  customerid INTEGER,
  action VARCHAR(100) NOT NULL,
  ipaddress VARCHAR(50),
  details TEXT
);

CREATE TABLE IF NOT EXISTS public."GuestReviews" (
  reviewid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  customername VARCHAR(200),
  rating INTEGER NOT NULL,
  body TEXT,
  aigenerated BOOLEAN DEFAULT false,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."GuestFeedback" (
  feedbackid SERIAL PRIMARY KEY,
  businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
  customername VARCHAR(200),
  phone VARCHAR(40),
  email VARCHAR(150),
  message TEXT,
  rating INTEGER,
  status VARCHAR(20) DEFAULT 'new',
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public."PrizeConfigurations" ADD COLUMN IF NOT EXISTS gameconfigurationid INTEGER;
ALTER TABLE public."PrizeConfigurations" ADD COLUMN IF NOT EXISTS spinwheelconfigurationid INTEGER;
ALTER TABLE public."MenuItems" ADD COLUMN IF NOT EXISTS imagepath TEXT;

CREATE TABLE IF NOT EXISTS public."MenuItemOptions" (
  optionid SERIAL PRIMARY KEY,
  itemid INTEGER NOT NULL REFERENCES public."MenuItems"(itemid) ON DELETE CASCADE,
  optionname VARCHAR(80) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  displayorder INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."MenuItemAddons" (
  addonid SERIAL PRIMARY KEY,
  itemid INTEGER NOT NULL REFERENCES public."MenuItems"(itemid) ON DELETE CASCADE,
  addonname VARCHAR(80) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  displayorder INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public."Orders" ADD COLUMN IF NOT EXISTS fulfillment VARCHAR(20) DEFAULT 'DineIn';
ALTER TABLE public."Orders" ADD COLUMN IF NOT EXISTS deliveryaddress TEXT;
ALTER TABLE public."OrderItems" ADD COLUMN IF NOT EXISTS optionname VARCHAR(80);
ALTER TABLE public."OrderItems" ADD COLUMN IF NOT EXISTS addons TEXT;
ALTER TABLE public."BusinessExperienceSettings" ADD COLUMN IF NOT EXISTS reviewkeywords TEXT;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS businesstype VARCHAR(100);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS businesstypeid INTEGER;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS businesstoken VARCHAR(50);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS publicslug VARCHAR(80);
CREATE UNIQUE INDEX IF NOT EXISTS businesses_publicslug_lower ON public."Businesses" (lower(publicslug)) WHERE publicslug IS NOT NULL AND publicslug <> '';
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS logoimagepath TEXT;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS bannerimagepath TEXT;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS tagline VARCHAR(250);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS facebookurl VARCHAR(500);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS instagramurl VARCHAR(500);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS linkedinurl VARCHAR(500);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS twitterurl VARCHAR(500);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS youtubeurl VARCHAR(500);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS whatsappnumber VARCHAR(20);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS website VARCHAR(200);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS supportemail VARCHAR(100);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS themecolor VARCHAR(50);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS countryid INTEGER;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS stateid INTEGER;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS districtid INTEGER;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS cityid INTEGER;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS latitude VARCHAR(50);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS longitude VARCHAR(50);
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS googlemapurl TEXT;
ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS googlereviewurl VARCHAR(500);
ALTER TABLE public."QRCodes" ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public."QRCodes" ADD COLUMN IF NOT EXISTS imagepath TEXT;
ALTER TABLE public."QRCodes" ADD COLUMN IF NOT EXISTS isactive BOOLEAN DEFAULT true;
ALTER TABLE public."Customers" ADD COLUMN IF NOT EXISTS passwordhash TEXT;
ALTER TABLE public."Customers" ADD COLUMN IF NOT EXISTS failedloginattempts INTEGER DEFAULT 0;
ALTER TABLE public."Customers" ADD COLUMN IF NOT EXISTS lockoutend TIMESTAMP;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS failedloginattempts INTEGER DEFAULT 0;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS lockoutend TIMESTAMP;

DO $$
DECLARE
  rec record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PrizeConfigurations' AND column_name = 'spinwheelconfigurationid'
  ) THEN
    EXECUTE 'ALTER TABLE public."PrizeConfigurations" ALTER COLUMN spinwheelconfigurationid DROP NOT NULL';
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('Businesses', 'businessid', 'businesses_businessid_seq'),
      ('Customers', 'customerid', 'customers_customerid_seq'),
      ('Users', 'userid', 'users_userid_seq'),
      ('QRCodes', 'qrcodeid', 'qrcodes_qrcodeid_seq'),
      ('PrizeConfigurations', 'prizeconfigurationid', 'prizeconfigurations_prizeconfigurationid_seq'),
      ('Rewards', 'rewardid', 'rewards_rewardid_seq'),
      ('RewardRedemptions', 'rewardredemptionid', 'rewardredemptions_rewardredemptionid_seq')
    ) AS ids(tbl, col, seq)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = rec.tbl AND column_name = rec.col AND column_default IS NULL
    ) THEN
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I', rec.seq);
      EXECUTE format(
        'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM public.%I), 0) + 1, false)',
        'public.' || rec.seq, rec.col, rec.tbl
      );
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT nextval(%L)',
        rec.tbl, rec.col, 'public.' || rec.seq
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO public."Countries" (countryname)
SELECT 'India' WHERE NOT EXISTS (SELECT 1 FROM public."Countries" WHERE countryname = 'India');

INSERT INTO public."BusinessTypes"
(typename, typecode, hubtitle, hubsubtitle, hubicon, hubbadge, catalogtitle, categoryterm, itemterm, stationlabel, stationplaceholder, actionbuttontext, isactive, displayorder)
VALUES
('Restaurant / Cafe', 'RESTAURANT', 'ONLINE MENU', 'View Menu • Order Food', '🍽', 'Digital Order', 'Online Menu', 'Menu Category', 'Dish / Drink', 'Table / Room No.', 'e.g., Table 4, Room 201', 'Place Food Order', true, 1),
('Salon, Spa & Beauty', 'SALON', 'SERVICE RATE CARD', 'View Services • Rate Card', '💇', 'Rate Card', 'Service Rate Card', 'Service Category', 'Treatment / Service', 'Chair / Seat No.', 'e.g., Chair 2', 'Request Service', true, 2),
('Gym & Fitness Center', 'GYM', 'PLANS & SESSIONS', 'Membership Plans • Training', '🏋️', 'Plans & Passes', 'Fitness Plans & Sessions', 'Plan Category', 'Plan / Membership', 'Slot / Batch / Trainer', 'e.g., Morning Batch', 'Join / Inquire', true, 3),
('Clinic & Healthcare', 'CLINIC', 'SERVICES & TREATMENTS', 'Treatments • Consultations', '🩺', 'Healthcare', 'Services & Consultations', 'Department', 'Treatment / Consultation', 'Cabin / Patient ID', 'e.g., Cabin 3', 'Book Appointment', true, 4),
('Retail & Boutique', 'RETAIL', 'PRODUCT CATALOG', 'Browse Products • Shop', '🛍', 'Product Catalog', 'Product Catalog', 'Product Category', 'Product / Item', 'Counter / Pickup Spot', 'e.g., Counter 1', 'Place Order', true, 5)
ON CONFLICT (typename) DO NOTHING;

INSERT INTO public."States" (countryid, statename)
SELECT c.countryid, s.name
FROM public."Countries" c
CROSS JOIN (VALUES
  ('Andaman and Nicobar Islands'), ('Andhra Pradesh'), ('Arunachal Pradesh'), ('Assam'), ('Bihar'),
  ('Chandigarh'), ('Chhattisgarh'), ('Dadra and Nagar Haveli and Daman and Diu'), ('Delhi'), ('Goa'),
  ('Gujarat'), ('Haryana'), ('Himachal Pradesh'), ('Jammu and Kashmir'), ('Jharkhand'), ('Karnataka'),
  ('Kerala'), ('Ladakh'), ('Lakshadweep'), ('Madhya Pradesh'), ('Maharashtra'), ('Manipur'), ('Meghalaya'),
  ('Mizoram'), ('Nagaland'), ('Odisha'), ('Puducherry'), ('Punjab'), ('Rajasthan'), ('Sikkim'),
  ('Tamil Nadu'), ('Telangana'), ('Tripura'), ('Uttar Pradesh'), ('Uttarakhand'), ('West Bengal')
) AS s(name)
WHERE c.countryname = 'India'
AND NOT EXISTS (
  SELECT 1 FROM public."States" st
  WHERE st.countryid = c.countryid AND LOWER(st.statename) = LOWER(s.name)
);
