import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1791354094491 implements MigrationInterface {
  name = 'Init1791354094491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "vins" ("vin" character varying(17) NOT NULL, "make" character varying(80), "model" character varying(120), "year" integer, "trim" character varying(120), "engine" character varying(120), "transmission" character varying(80), "drive" character varying(80), "bodyType" character varying(80), "country" character varying(80), "source" character varying(20) NOT NULL, "raw" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_56951a7b9111b9969dbaa077fc5" PRIMARY KEY ("vin"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "seller_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerId" uuid NOT NULL, "type" character varying(50) NOT NULL, "url" character varying(500) NOT NULL, CONSTRAINT "PK_21b439eb3e12ca544b8031c8423" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "stores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerId" uuid NOT NULL, "name" character varying(200) NOT NULL, "country" character varying(2) NOT NULL, "city" character varying(100) NOT NULL, "address" character varying(300), "description" text, "logoUrl" character varying(500), "workingHours" jsonb, "warehouseId" uuid, "viewsCount" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88ed45f215d6ddb29c83d8d300" ON "stores" ("sellerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b250aff4dbe94d29b286dcb537" ON "stores" ("country") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sellers_type_enum" AS ENUM('SHOP', 'SCRAPYARD', 'PRIVATE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sellers_verificationstatus_enum" AS ENUM('PENDING', 'VERIFIED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sellers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "type" "public"."sellers_type_enum" NOT NULL, "displayName" character varying(200) NOT NULL, "legalName" character varying(200), "inn" character varying(20), "verificationStatus" "public"."sellers_verificationstatus_enum" NOT NULL DEFAULT 'PENDING', "verificationComment" text, "rating" numeric(3,2) NOT NULL DEFAULT '0', "reviewsCount" integer NOT NULL DEFAULT '0', "balanceAvailable" numeric(14,2) NOT NULL DEFAULT '0', "balanceHold" numeric(14,2) NOT NULL DEFAULT '0', "payoutDetails" jsonb, "offersPerDayLimit" integer, CONSTRAINT "REL_4c1c59db4ac1ed90a1a7c0ff3d" UNIQUE ("userId"), CONSTRAINT "PK_97337ccbf692c58e6c7682de8a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4c1c59db4ac1ed90a1a7c0ff3d" ON "sellers" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_90c322f4cf3a43b2914c38f1cb" ON "sellers" ("verificationStatus") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "deviceId" character varying(200) NOT NULL, "platform" character varying(20) NOT NULL DEFAULT 'web', "pushToken" character varying(500), CONSTRAINT "PK_c9e7e648903a9e537347aba4371" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a3699a8ee632fc3527fec16a7d" ON "user_devices" ("userId", "deviceId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_roles_enum" AS ENUM('CLIENT', 'SELLER', 'ADMIN', 'LOGISTICS', 'SUPPORT')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."users_language_enum" AS ENUM('ru', 'ky', 'en')`);
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'BLOCKED', 'DELETED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "phone" character varying(20) NOT NULL, "email" character varying(255), "name" character varying(120), "avatarUrl" character varying(500), "roles" "public"."users_roles_enum" array NOT NULL DEFAULT '{CLIENT}', "language" "public"."users_language_enum" NOT NULL DEFAULT 'ru', "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE', "city" character varying(100), "country" character varying(2) NOT NULL DEFAULT 'KG', "telegramChatId" character varying(64), "chatViolations" integer NOT NULL DEFAULT '0', "chatRestrictedUntil" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a000cca60bcf04454e72769949" ON "users" ("phone") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e2dd77cb8a46c78d8ea34de039" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "vin" character varying(17), "frameNumber" character varying(30), "make" character varying(80) NOT NULL, "model" character varying(120) NOT NULL, "year" integer, "engine" character varying(120), "transmission" character varying(80), "drive" character varying(80), "nickname" character varying(100), CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20f139b9d79f917ef735efacb0" ON "vehicles" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "system_settings" ("key" character varying(100) NOT NULL, "value" jsonb NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b1b5bc664526d375c94ce9ad43d" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "authorId" uuid NOT NULL, "sellerId" uuid NOT NULL, "rating" smallint NOT NULL, "text" text, "photos" text array NOT NULL DEFAULT '{}', "sellerReply" text, "sellerReplyAt" TIMESTAMP WITH TIME ZONE, "isHidden" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_53a68dc905777554b7f702791f" ON "reviews" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9805ee71aa117dee3c3f60f527" ON "reviews" ("sellerId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "slug" character varying(100) NOT NULL, "name" jsonb NOT NULL, "parentId" uuid, "sort" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "categories" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."requests_condition_enum" AS ENUM('NEW', 'USED', 'ANY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."requests_budgetcurrency_enum" AS ENUM('KGS', 'USD', 'CNY', 'RUB')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."requests_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'HAS_OFFERS', 'OFFER_SELECTED', 'CLOSED', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "clientId" uuid NOT NULL, "vehicleId" uuid, "vin" character varying(17), "frameNumber" character varying(30), "make" character varying(80) NOT NULL, "model" character varying(120), "year" integer, "engine" character varying(120), "title" character varying(300) NOT NULL, "description" text, "oemNumber" character varying(80), "photos" text array NOT NULL DEFAULT '{}', "categoryId" uuid, "condition" "public"."requests_condition_enum" NOT NULL DEFAULT 'ANY', "originCountry" character varying(3) NOT NULL DEFAULT 'ANY', "budget" numeric(14,2), "budgetCurrency" "public"."requests_budgetcurrency_enum" NOT NULL DEFAULT 'KGS', "desiredDate" date, "country" character varying(2) NOT NULL DEFAULT 'KG', "city" character varying(100), "status" "public"."requests_status_enum" NOT NULL DEFAULT 'DRAFT', "publishedAt" TIMESTAMP WITH TIME ZONE, "expiresAt" TIMESTAMP WITH TIME ZONE, "offersCount" integer NOT NULL DEFAULT '0', "selectedOfferId" uuid, "closedReason" character varying(500), CONSTRAINT "PK_0428f484e96f9e6a55955f29b5f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_67e0190e8be8e182bc48fc55ad" ON "requests" ("clientId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c11d77a7f741014c880fea721" ON "requests" ("make") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a95e8393e257e96fbf0d1cae1" ON "requests" ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_59b85be6a3c16cbf27f8bdda1d" ON "requests" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7766c1b98bc6ed8bd4383500b5" ON "requests" ("status", "expiresAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."offers_currency_enum" AS ENUM('KGS', 'USD', 'CNY', 'RUB')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."offers_condition_enum" AS ENUM('NEW', 'USED')`);
    await queryRunner.query(
      `CREATE TYPE "public"."offers_origin_enum" AS ENUM('ORIGINAL', 'ANALOG')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."offers_status_enum" AS ENUM('SENT', 'VIEWED', 'SELECTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'REMOVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "requestId" uuid NOT NULL, "sellerId" uuid NOT NULL, "storeId" uuid NOT NULL, "partId" uuid, "title" character varying(300) NOT NULL, "price" numeric(14,2) NOT NULL, "currency" "public"."offers_currency_enum" NOT NULL DEFAULT 'KGS', "priceKgs" numeric(14,2) NOT NULL, "condition" "public"."offers_condition_enum" NOT NULL, "origin" "public"."offers_origin_enum" NOT NULL DEFAULT 'ORIGINAL', "brand" character varying(100), "deliveryDays" integer NOT NULL, "warrantyDays" integer NOT NULL DEFAULT '0', "photos" text array NOT NULL DEFAULT '{}', "comment" text, "weightKg" numeric(8,2), "shipFromCountry" character varying(2) NOT NULL, "status" "public"."offers_status_enum" NOT NULL DEFAULT 'SENT', "viewedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4c88e956195bba85977da21b8f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb79c9671239d9dae540eaa513" ON "offers" ("requestId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92de52b4c607bdf9b4f64f4001" ON "offers" ("sellerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_434239966cb60e2dbc6178f993" ON "offers" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_79e58b085f58a7c1393e430f5c" ON "offers" ("requestId", "sellerId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."exchange_rates_currency_enum" AS ENUM('KGS', 'USD', 'CNY', 'RUB')`,
    );
    await queryRunner.query(
      `CREATE TABLE "exchange_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "currency" "public"."exchange_rates_currency_enum" NOT NULL, "rateToKgs" numeric(14,6) NOT NULL, "setById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_33a614bad9e61956079d817ebe2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2badd7fe7d9fce6aa939a3f9d9" ON "exchange_rates" ("currency") `,
    );
    await queryRunner.query(
      `CREATE TABLE "car_makes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(80) NOT NULL, "sort" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_dc5d7e34799a27e68f5fdc7f910" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_03e3bbc223f0c5809fe385f846" ON "car_makes" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "car_models" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "makeId" uuid NOT NULL, "name" character varying(80) NOT NULL, CONSTRAINT "PK_ee4355345e0e1c18cb6efa2bd5c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5f78622238b307ad0acfcaefc2" ON "car_models" ("makeId", "name") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payouts_status_enum" AS ENUM('REQUESTED', 'PAID', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payouts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerId" uuid NOT NULL, "amount" numeric(14,2) NOT NULL, "status" "public"."payouts_status_enum" NOT NULL DEFAULT 'REQUESTED', "details" jsonb NOT NULL, "bankReference" character varying(120), "comment" character varying(500), "processedById" uuid, "processedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_76855dc4f0a6c18c72eea302e87" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6ca8230c219d7050caf7cb9aa1" ON "payouts" ("sellerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f32ee6d2385d9a8bc0cc92af5" ON "payouts" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_currency_enum" AS ENUM('KGS', 'USD', 'CNY', 'RUB')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_method_enum" AS ENUM('CARD', 'ELCART', 'ODENGI', 'MBANK', 'OPTIMA', 'QR', 'BANK_TRANSFER', 'CASH')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('CREATED', 'HOLD', 'CAPTURED', 'PAID_OUT', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "amount" numeric(14,2) NOT NULL, "currency" "public"."payments_currency_enum" NOT NULL DEFAULT 'KGS', "method" "public"."payments_method_enum" NOT NULL, "provider" character varying(30) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'CREATED', "providerTxId" character varying(120), "providerPayload" jsonb, "refundedAmount" numeric(14,2) NOT NULL DEFAULT '0', "heldAt" TIMESTAMP WITH TIME ZONE, "capturedAt" TIMESTAMP WITH TIME ZONE, "failureReason" character varying(500), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_af929a5f2a400fdb6913b4967e" ON "payments" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_32b41cdb985a296213e9a928b5" ON "payments" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2667fbadd3f5fb1c0fe65e8756" ON "payments" ("providerTxId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "txId" uuid NOT NULL, "account" character varying(80) NOT NULL, "amount" numeric(14,2) NOT NULL, "operation" character varying(40) NOT NULL, "orderId" uuid, "paymentId" uuid, "payoutId" uuid, "description" character varying(300), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92381598144e1b3cdaba4d7957" ON "ledger_entries" ("txId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6304897a90f01527b951762569" ON "ledger_entries" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1094b45bfb67870972c45d24da" ON "ledger_entries" ("account", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_status_history_fromstatus_enum" AS ENUM('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTE', 'RETURN', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_status_history_tostatus_enum" AS ENUM('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTE', 'RETURN', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "fromStatus" "public"."order_status_history_fromstatus_enum", "toStatus" "public"."order_status_history_tostatus_enum" NOT NULL, "actorId" uuid, "note" character varying(500), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e6c66d853f155531985fc4f6ec8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_689db3835e5550e68d26ca3267" ON "order_status_history" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_goodscurrency_enum" AS ENUM('KGS', 'USD', 'CNY', 'RUB')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_deliverymethod_enum" AS ENUM('PICKUP_POINT', 'COURIER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_shippingmethod_enum" AS ENUM('AIR', 'TRUCK', 'RAIL', 'LOCAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTE', 'RETURN', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "number" character varying(30) NOT NULL, "clientId" uuid NOT NULL, "sellerId" uuid NOT NULL, "storeId" uuid NOT NULL, "requestId" uuid, "offerId" uuid, "partId" uuid, "categoryId" uuid, "title" character varying(300) NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "goodsPrice" numeric(14,2) NOT NULL, "goodsCurrency" "public"."orders_goodscurrency_enum" NOT NULL, "exchangeRate" numeric(14,6) NOT NULL, "goodsAmount" numeric(14,2) NOT NULL, "shippingAmount" numeric(14,2) NOT NULL, "commissionAmount" numeric(14,2) NOT NULL, "commissionRuleId" uuid, "totalAmount" numeric(14,2) NOT NULL, "sellerPayoutAmount" numeric(14,2) NOT NULL, "refundedAmount" numeric(14,2) NOT NULL DEFAULT '0', "deliveryMethod" "public"."orders_deliverymethod_enum" NOT NULL, "shippingMethod" "public"."orders_shippingmethod_enum" NOT NULL, "pickupPointId" uuid, "deliveryAddress" jsonb NOT NULL, "shipFromCountry" character varying(2) NOT NULL, "weightKg" numeric(8,2), "status" "public"."orders_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "paidAt" TIMESTAMP WITH TIME ZONE, "deliveredAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, "cancelledAt" TIMESTAMP WITH TIME ZONE, "cancelReason" character varying(500), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4e174e347d448617acdf98fef0" ON "orders" ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1457f286d91f271313fded23e5" ON "orders" ("clientId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c382880db667beb75d26c5787" ON "orders" ("sellerId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_53ef7571b7e8e289476a18d588" ON "orders" ("offerId") WHERE "offerId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders" ("status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying(40) NOT NULL, "title" character varying(200) NOT NULL, "body" text NOT NULL, "data" jsonb, "channels" text array NOT NULL DEFAULT '{}', "readAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d8adc796dff8c73acd1eba656" ON "notifications" ("readAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_21e65af2f4f242d4c85a92aff4" ON "notifications" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_templates_language_enum" AS ENUM('ru', 'ky', 'en')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" character varying(40) NOT NULL, "language" "public"."notification_templates_language_enum" NOT NULL, "title" character varying(200) NOT NULL, "body" text NOT NULL, "channels" text array NOT NULL DEFAULT '{PUSH,TELEGRAM}', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_76f0fc48b8d057d2ae7f3a2848a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_55f9484397d17aa7478cec765b" ON "notification_templates" ("type", "language") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_blocks_appealstatus_enum" AS ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "blockedById" uuid, "reason" character varying(500) NOT NULL, "until" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "appealText" text, "appealStatus" "public"."user_blocks_appealstatus_enum" NOT NULL DEFAULT 'NONE', "appealResponse" text, CONSTRAINT "PK_0bae5f5cab7574a84889462187c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e5126385b30cad06ee18038ab6" ON "user_blocks" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_targettype_enum" AS ENUM('REQUEST', 'OFFER', 'MESSAGE', 'USER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_status_enum" AS ENUM('OPEN', 'RESOLVED', 'DISMISSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "targetType" "public"."reports_targettype_enum" NOT NULL, "targetId" uuid NOT NULL, "reporterId" uuid NOT NULL, "reason" character varying(500) NOT NULL, "status" "public"."reports_status_enum" NOT NULL DEFAULT 'OPEN', "resolvedById" uuid, "resolution" text, CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dab4d78b3be05c1ca4a626f57f" ON "reports" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_46366e52d27edeffdf052f992f" ON "reports" ("targetType", "targetId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."blacklist_type_enum" AS ENUM('PHONE', 'DEVICE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "blacklist" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."blacklist_type_enum" NOT NULL, "value" character varying(200) NOT NULL, "reason" character varying(500), "createdById" uuid, CONSTRAINT "PK_04dc42a96bf0914cda31b579702" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4df05e8251ce0015865291beac" ON "blacklist" ("type", "value") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."warehouses_type_enum" AS ENUM('SELLER', 'CONSOLIDATION', 'PICKUP_POINT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "warehouses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "type" "public"."warehouses_type_enum" NOT NULL, "country" character varying(2) NOT NULL, "city" character varying(100) NOT NULL, "address" character varying(300) NOT NULL, "workingHours" jsonb, "sellerId" uuid, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_56ae21ee2432b2270b48867e4be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_34c30bb27d534ba4104b414cab" ON "warehouses" ("type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipping_tariffs_method_enum" AS ENUM('AIR', 'TRUCK', 'RAIL', 'LOCAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipping_tariffs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fromCountry" character varying(2) NOT NULL, "toCountry" character varying(2) NOT NULL, "method" "public"."shipping_tariffs_method_enum" NOT NULL, "pricePerKg" numeric(14,2) NOT NULL, "minPrice" numeric(14,2) NOT NULL, "volumetricDivisor" integer NOT NULL DEFAULT '6000', "surchargePercent" numeric(5,2) NOT NULL DEFAULT '0', "daysMin" integer NOT NULL, "daysMax" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_97ac19a763a697f1df1370f7354" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ce3da9295bdf40d9a3ae5435b1" ON "shipping_tariffs" ("fromCountry", "toCountry", "method") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipment_events_status_enum" AS ENUM('PENDING', 'HANDED_BY_SELLER', 'AT_ORIGIN_WAREHOUSE', 'IN_TRANSIT', 'AT_CUSTOMS', 'AT_DESTINATION_WAREHOUSE', 'HANDED_TO_COURIER', 'DELIVERED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shipmentId" uuid NOT NULL, "status" "public"."shipment_events_status_enum" NOT NULL, "location" character varying(200), "note" character varying(1000), "photos" text array NOT NULL DEFAULT '{}', "actorId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_80a42a8d00d59cbfab38e1d0872" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e0d86c92942127971af5a1d982" ON "shipment_events" ("shipmentId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_method_enum" AS ENUM('AIR', 'TRUCK', 'RAIL', 'LOCAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_deliverymethod_enum" AS ENUM('PICKUP_POINT', 'COURIER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_status_enum" AS ENUM('PENDING', 'HANDED_BY_SELLER', 'AT_ORIGIN_WAREHOUSE', 'IN_TRANSIT', 'AT_CUSTOMS', 'AT_DESTINATION_WAREHOUSE', 'HANDED_TO_COURIER', 'DELIVERED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "trackingNumber" character varying(30) NOT NULL, "externalTrackingNumber" character varying(100), "carrier" character varying(100), "method" "public"."shipments_method_enum" NOT NULL, "fromCountry" character varying(2) NOT NULL, "toCountry" character varying(2) NOT NULL DEFAULT 'KG', "originWarehouseId" uuid, "destinationWarehouseId" uuid, "deliveryMethod" "public"."shipments_deliverymethod_enum" NOT NULL, "pickupPointId" uuid, "consolidationId" uuid, "weightKg" numeric(8,2), "dimensions" jsonb, "cost" numeric(14,2) NOT NULL, "status" "public"."shipments_status_enum" NOT NULL DEFAULT 'PENDING', CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13ba957bcb616719a0dc3fca82" ON "shipments" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3300d7adbd17fdb51bdfd8c951" ON "shipments" ("trackingNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_95f1b5e765ebbb2085873e065a" ON "shipments" ("externalTrackingNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4cc48418b81e68f3c9324bca52" ON "shipments" ("consolidationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a19baf6dd62cac42fbb40a518" ON "shipments" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."consolidations_method_enum" AS ENUM('AIR', 'TRUCK', 'RAIL', 'LOCAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."consolidations_status_enum" AS ENUM('PENDING', 'HANDED_BY_SELLER', 'AT_ORIGIN_WAREHOUSE', 'IN_TRANSIT', 'AT_CUSTOMS', 'AT_DESTINATION_WAREHOUSE', 'HANDED_TO_COURIER', 'DELIVERED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "consolidations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(30) NOT NULL, "originWarehouseId" uuid NOT NULL, "destinationWarehouseId" uuid NOT NULL, "method" "public"."consolidations_method_enum" NOT NULL, "carrier" character varying(100), "trackingNumber" character varying(100), "status" "public"."consolidations_status_enum" NOT NULL DEFAULT 'AT_ORIGIN_WAREHOUSE', "shippedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_649f5d0fd4afe223d04f1ba43a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1fe1be3f55baf928caf61ec3ee" ON "consolidations" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "url" character varying(500) NOT NULL, "key" character varying(300) NOT NULL, "mimeType" character varying(100) NOT NULL, "size" integer NOT NULL, "width" integer, "height" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a23484d1055e34d75b25f61679" ON "files" ("ownerId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2a26d04373d1dcc04c7f7aee21" ON "files" ("url") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."returns_status_enum" AS ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "returns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "clientId" uuid NOT NULL, "sellerId" uuid NOT NULL, "reason" character varying(30) NOT NULL, "description" text, "photos" text array NOT NULL DEFAULT '{}', "method" character varying(20) NOT NULL DEFAULT 'DROP_OFF', "cost" numeric(14,2) NOT NULL DEFAULT '0', "status" "public"."returns_status_enum" NOT NULL DEFAULT 'REQUESTED', "refundAmount" numeric(14,2), "adminComment" text, CONSTRAINT "PK_27a2f1895a71519ebfec7850361" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b3851bc6d0e2a7ddc7412806a0" ON "returns" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_586e9208b6ccacb7a2e81ba8e5" ON "returns" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_status_enum" AS ENUM('OPEN', 'SELLER_RESPONDED', 'IN_REVIEW', 'RESOLVED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_resolution_enum" AS ENUM('REFUND_FULL', 'REFUND_PARTIAL', 'PAYOUT_SELLER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_previousorderstatus_enum" AS ENUM('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTE', 'RETURN', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "disputes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "clientId" uuid NOT NULL, "sellerId" uuid NOT NULL, "initiatorId" uuid NOT NULL, "reason" character varying(30) NOT NULL, "description" text NOT NULL, "evidence" jsonb NOT NULL DEFAULT '[]', "status" "public"."disputes_status_enum" NOT NULL DEFAULT 'OPEN', "resolution" "public"."disputes_resolution_enum", "refundAmount" numeric(14,2), "resolutionComment" text, "assignedToId" uuid, "resolvedAt" TIMESTAMP WITH TIME ZONE, "chatId" uuid, "previousOrderStatus" "public"."disputes_previousorderstatus_enum" NOT NULL, CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8acbc1c3c0ba479dd4010eeb46" ON "disputes" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ea46f4f2225f38d127063c367" ON "disputes" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."commission_rules_scope_enum" AS ENUM('GLOBAL', 'COUNTRY', 'CATEGORY', 'SELLER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."commission_rules_type_enum" AS ENUM('PERCENT', 'FIXED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "commission_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "scope" "public"."commission_rules_scope_enum" NOT NULL, "categoryId" uuid, "sellerId" uuid, "country" character varying(2), "type" "public"."commission_rules_type_enum" NOT NULL, "value" numeric(10,2) NOT NULL, "validFrom" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "validTo" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "previousId" uuid, "createdById" uuid, "note" character varying(300), CONSTRAINT "PK_399c9fa57f7fd28dfc57acea3bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0b7405d738fd83176beed8b7e4" ON "commission_rules" ("scope", "isActive") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_status_enum" AS ENUM('SENT', 'BLOCKED', 'HIDDEN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "chatId" uuid NOT NULL, "senderId" uuid, "senderRole" character varying(10) NOT NULL, "text" text NOT NULL DEFAULT '', "photos" text array NOT NULL DEFAULT '{}', "status" "public"."messages_status_enum" NOT NULL DEFAULT 'SENT', "flags" text array NOT NULL DEFAULT '{}', "originalText" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_befd307485dbf0559d17e4a4d2" ON "messages" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_500d64127ca9df75640c19af40" ON "messages" ("chatId", "createdAt") `,
    );
    await queryRunner.query(`CREATE TYPE "public"."chats_type_enum" AS ENUM('REQUEST', 'DISPUTE')`);
    await queryRunner.query(
      `CREATE TABLE "chats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."chats_type_enum" NOT NULL DEFAULT 'REQUEST', "requestId" uuid, "offerId" uuid, "orderId" uuid, "disputeId" uuid, "clientId" uuid NOT NULL, "sellerId" uuid, "sellerUserId" uuid, "lastMessageAt" TIMESTAMP WITH TIME ZONE, "lastMessagePreview" character varying(200), "clientUnread" integer NOT NULL DEFAULT '0', "sellerUnread" integer NOT NULL DEFAULT '0', "isClosed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_0117647b3c4a4e5ff198aeb6206" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f86c9c1f5005868819354f0ae9" ON "chats" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_59279cb5c542a95d0f22a05d1a" ON "chats" ("clientId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f21ffee41930ee3810f48e46e" ON "chats" ("sellerUserId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9c8f34e3dfadd6ef7eefa2a965" ON "chats" ("requestId", "sellerId") WHERE "type" = 'REQUEST'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."price_history_currency_enum" AS ENUM('KGS', 'USD', 'CNY', 'RUB')`,
    );
    await queryRunner.query(
      `CREATE TABLE "price_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "partId" uuid, "offerId" uuid, "price" numeric(14,2) NOT NULL, "currency" "public"."price_history_currency_enum" NOT NULL, "rateToKgs" numeric(14,6) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e41e25472373d4b574b153229e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_928eaa658c2ff9018b52314ccd" ON "price_history" ("partId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cadaf5084ecdc0b704648d9877" ON "price_history" ("offerId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "part_compatibility" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "partId" uuid NOT NULL, "make" character varying(80) NOT NULL, "model" character varying(120), "yearFrom" integer, "yearTo" integer, "engine" character varying(120), "vinMask" character varying(17), CONSTRAINT "PK_80dfb7d8c3c5a2d353f09757b90" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_37960da417ea22a2dc041e9acb" ON "part_compatibility" ("partId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48cdf97e006152c3931c56c507" ON "part_compatibility" ("make", "model") `,
    );
    await queryRunner.query(`CREATE TYPE "public"."parts_condition_enum" AS ENUM('NEW', 'USED')`);
    await queryRunner.query(
      `CREATE TYPE "public"."parts_origin_enum" AS ENUM('ORIGINAL', 'ANALOG')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parts_currency_enum" AS ENUM('KGS', 'USD', 'CNY', 'RUB')`,
    );
    await queryRunner.query(
      `CREATE TABLE "parts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "storeId" uuid NOT NULL, "sellerId" uuid NOT NULL, "name" character varying(300) NOT NULL, "description" text, "categoryId" uuid, "oemNumbers" text array NOT NULL DEFAULT '{}', "brand" character varying(100), "condition" "public"."parts_condition_enum" NOT NULL DEFAULT 'NEW', "origin" "public"."parts_origin_enum" NOT NULL DEFAULT 'ORIGINAL', "photos" text array NOT NULL DEFAULT '{}', "price" numeric(14,2) NOT NULL, "currency" "public"."parts_currency_enum" NOT NULL DEFAULT 'KGS', "stock" integer NOT NULL DEFAULT '1', "weightKg" numeric(8,2), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_daa5595bb8933f49ac00c9ebc79" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e6025a94b1fadb4f2fd791b47" ON "parts" ("storeId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7cb5ef497cfc82670293206636" ON "parts" ("sellerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1224c46cb916eb9ea7f40c9e78" ON "parts" ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c7a5307b1c95a323ee2eb384a9" ON "parts" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE TABLE "oems" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "number" character varying(60) NOT NULL, "displayNumber" character varying(80) NOT NULL, "brand" character varying(100) NOT NULL, "name" character varying(300), "crossNumbers" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_9cc771e62dd9e90bd170c9998b7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_a8628bc1877472df7fb50bcd80" ON "oems" ("number") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f87ea486faf656113a8e1afaf6" ON "oems" ("number", "brand") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(128) NOT NULL, "deviceId" character varying(200), "userAgent" character varying(300), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9190032f6967b7971dca07d69f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_78744bff965517952df6c02da7" ON "refresh_sessions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying(20) NOT NULL, "codeHash" character varying(128) NOT NULL, "channel" character varying(20) NOT NULL DEFAULT 'SMS', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da14d5fd28d202557193fb3fdf" ON "otp_codes" ("phone") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorId" uuid, "action" character varying(100) NOT NULL, "entityType" character varying(50) NOT NULL, "entityId" character varying(64), "payload" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2dc33f7f3c22e2e7badafca1d1" ON "audit_logs" ("actorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON "audit_logs" ("entityType", "entityId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_documents" ADD CONSTRAINT "FK_7b6226f49a7dae7ff1b7a607b53" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stores" ADD CONSTRAINT "FK_88ed45f215d6ddb29c83d8d300f" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" ADD CONSTRAINT "FK_4c1c59db4ac1ed90a1a7c0ff3df" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_20f139b9d79f917ef735efacb00" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_8288ce015b69c5856cf54e07a67" FOREIGN KEY ("vin") REFERENCES "vins"("vin") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "FK_67e0190e8be8e182bc48fc55ade" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "FK_5a95e8393e257e96fbf0d1cae19" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_fb79c9671239d9dae540eaa5131" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_92de52b4c607bdf9b4f64f40017" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_22f5c1e69d5ba4dc2ebe4d268d1" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "car_models" ADD CONSTRAINT "FK_ff72b51a51d29375803946367fb" FOREIGN KEY ("makeId") REFERENCES "car_makes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_history" ADD CONSTRAINT "FK_689db3835e5550e68d26ca32676" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_1457f286d91f271313fded23e53" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_1c382880db667beb75d26c57873" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_e5126385b30cad06ee18038ab60" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_events" ADD CONSTRAINT "FK_e0d86c92942127971af5a1d9829" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_compatibility" ADD CONSTRAINT "FK_37960da417ea22a2dc041e9acb6" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" ADD CONSTRAINT "FK_1e6025a94b1fadb4f2fd791b471" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" ADD CONSTRAINT "FK_1224c46cb916eb9ea7f40c9e78b" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "parts" DROP CONSTRAINT "FK_1224c46cb916eb9ea7f40c9e78b"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP CONSTRAINT "FK_1e6025a94b1fadb4f2fd791b471"`);
    await queryRunner.query(
      `ALTER TABLE "part_compatibility" DROP CONSTRAINT "FK_37960da417ea22a2dc041e9acb6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_events" DROP CONSTRAINT "FK_e0d86c92942127971af5a1d9829"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_e5126385b30cad06ee18038ab60"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_1c382880db667beb75d26c57873"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_1457f286d91f271313fded23e53"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_history" DROP CONSTRAINT "FK_689db3835e5550e68d26ca32676"`,
    );
    await queryRunner.query(
      `ALTER TABLE "car_models" DROP CONSTRAINT "FK_ff72b51a51d29375803946367fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT "FK_22f5c1e69d5ba4dc2ebe4d268d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT "FK_92de52b4c607bdf9b4f64f40017"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT "FK_fb79c9671239d9dae540eaa5131"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" DROP CONSTRAINT "FK_5a95e8393e257e96fbf0d1cae19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" DROP CONSTRAINT "FK_67e0190e8be8e182bc48fc55ade"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_8288ce015b69c5856cf54e07a67"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_20f139b9d79f917ef735efacb00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" DROP CONSTRAINT "FK_4c1c59db4ac1ed90a1a7c0ff3df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stores" DROP CONSTRAINT "FK_88ed45f215d6ddb29c83d8d300f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_documents" DROP CONSTRAINT "FK_7b6226f49a7dae7ff1b7a607b53"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_13c69424c440a0e765053feb4b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2dc33f7f3c22e2e7badafca1d1"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_da14d5fd28d202557193fb3fdf"`);
    await queryRunner.query(`DROP TABLE "otp_codes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_78744bff965517952df6c02da7"`);
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f87ea486faf656113a8e1afaf6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a8628bc1877472df7fb50bcd80"`);
    await queryRunner.query(`DROP TABLE "oems"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c7a5307b1c95a323ee2eb384a9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1224c46cb916eb9ea7f40c9e78"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7cb5ef497cfc82670293206636"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1e6025a94b1fadb4f2fd791b47"`);
    await queryRunner.query(`DROP TABLE "parts"`);
    await queryRunner.query(`DROP TYPE "public"."parts_currency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."parts_origin_enum"`);
    await queryRunner.query(`DROP TYPE "public"."parts_condition_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_48cdf97e006152c3931c56c507"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_37960da417ea22a2dc041e9acb"`);
    await queryRunner.query(`DROP TABLE "part_compatibility"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cadaf5084ecdc0b704648d9877"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_928eaa658c2ff9018b52314ccd"`);
    await queryRunner.query(`DROP TABLE "price_history"`);
    await queryRunner.query(`DROP TYPE "public"."price_history_currency_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9c8f34e3dfadd6ef7eefa2a965"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4f21ffee41930ee3810f48e46e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_59279cb5c542a95d0f22a05d1a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f86c9c1f5005868819354f0ae9"`);
    await queryRunner.query(`DROP TABLE "chats"`);
    await queryRunner.query(`DROP TYPE "public"."chats_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_500d64127ca9df75640c19af40"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_befd307485dbf0559d17e4a4d2"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "public"."messages_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0b7405d738fd83176beed8b7e4"`);
    await queryRunner.query(`DROP TABLE "commission_rules"`);
    await queryRunner.query(`DROP TYPE "public"."commission_rules_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."commission_rules_scope_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0ea46f4f2225f38d127063c367"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8acbc1c3c0ba479dd4010eeb46"`);
    await queryRunner.query(`DROP TABLE "disputes"`);
    await queryRunner.query(`DROP TYPE "public"."disputes_previousorderstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."disputes_resolution_enum"`);
    await queryRunner.query(`DROP TYPE "public"."disputes_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_586e9208b6ccacb7a2e81ba8e5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b3851bc6d0e2a7ddc7412806a0"`);
    await queryRunner.query(`DROP TABLE "returns"`);
    await queryRunner.query(`DROP TYPE "public"."returns_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2a26d04373d1dcc04c7f7aee21"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a23484d1055e34d75b25f61679"`);
    await queryRunner.query(`DROP TABLE "files"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1fe1be3f55baf928caf61ec3ee"`);
    await queryRunner.query(`DROP TABLE "consolidations"`);
    await queryRunner.query(`DROP TYPE "public"."consolidations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."consolidations_method_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6a19baf6dd62cac42fbb40a518"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4cc48418b81e68f3c9324bca52"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_95f1b5e765ebbb2085873e065a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3300d7adbd17fdb51bdfd8c951"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_13ba957bcb616719a0dc3fca82"`);
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_deliverymethod_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_method_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e0d86c92942127971af5a1d982"`);
    await queryRunner.query(`DROP TABLE "shipment_events"`);
    await queryRunner.query(`DROP TYPE "public"."shipment_events_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ce3da9295bdf40d9a3ae5435b1"`);
    await queryRunner.query(`DROP TABLE "shipping_tariffs"`);
    await queryRunner.query(`DROP TYPE "public"."shipping_tariffs_method_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_34c30bb27d534ba4104b414cab"`);
    await queryRunner.query(`DROP TABLE "warehouses"`);
    await queryRunner.query(`DROP TYPE "public"."warehouses_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4df05e8251ce0015865291beac"`);
    await queryRunner.query(`DROP TABLE "blacklist"`);
    await queryRunner.query(`DROP TYPE "public"."blacklist_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_46366e52d27edeffdf052f992f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dab4d78b3be05c1ca4a626f57f"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_targettype_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e5126385b30cad06ee18038ab6"`);
    await queryRunner.query(`DROP TABLE "user_blocks"`);
    await queryRunner.query(`DROP TYPE "public"."user_blocks_appealstatus_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_55f9484397d17aa7478cec765b"`);
    await queryRunner.query(`DROP TABLE "notification_templates"`);
    await queryRunner.query(`DROP TYPE "public"."notification_templates_language_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_21e65af2f4f242d4c85a92aff4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9d8adc796dff8c73acd1eba656"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_775c9f06fc27ae3ff8fb26f2c4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_53ef7571b7e8e289476a18d588"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1c382880db667beb75d26c5787"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1457f286d91f271313fded23e5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4e174e347d448617acdf98fef0"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_shippingmethod_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_deliverymethod_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_goodscurrency_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_689db3835e5550e68d26ca3267"`);
    await queryRunner.query(`DROP TABLE "order_status_history"`);
    await queryRunner.query(`DROP TYPE "public"."order_status_history_tostatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_status_history_fromstatus_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1094b45bfb67870972c45d24da"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6304897a90f01527b951762569"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_92381598144e1b3cdaba4d7957"`);
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2667fbadd3f5fb1c0fe65e8756"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_32b41cdb985a296213e9a928b5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_af929a5f2a400fdb6913b4967e"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_currency_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3f32ee6d2385d9a8bc0cc92af5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6ca8230c219d7050caf7cb9aa1"`);
    await queryRunner.query(`DROP TABLE "payouts"`);
    await queryRunner.query(`DROP TYPE "public"."payouts_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5f78622238b307ad0acfcaefc2"`);
    await queryRunner.query(`DROP TABLE "car_models"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_03e3bbc223f0c5809fe385f846"`);
    await queryRunner.query(`DROP TABLE "car_makes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2badd7fe7d9fce6aa939a3f9d9"`);
    await queryRunner.query(`DROP TABLE "exchange_rates"`);
    await queryRunner.query(`DROP TYPE "public"."exchange_rates_currency_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_79e58b085f58a7c1393e430f5c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_434239966cb60e2dbc6178f993"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_92de52b4c607bdf9b4f64f4001"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fb79c9671239d9dae540eaa513"`);
    await queryRunner.query(`DROP TABLE "offers"`);
    await queryRunner.query(`DROP TYPE "public"."offers_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."offers_origin_enum"`);
    await queryRunner.query(`DROP TYPE "public"."offers_condition_enum"`);
    await queryRunner.query(`DROP TYPE "public"."offers_currency_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7766c1b98bc6ed8bd4383500b5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_59b85be6a3c16cbf27f8bdda1d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5a95e8393e257e96fbf0d1cae1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2c11d77a7f741014c880fea721"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_67e0190e8be8e182bc48fc55ad"`);
    await queryRunner.query(`DROP TABLE "requests"`);
    await queryRunner.query(`DROP TYPE "public"."requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."requests_budgetcurrency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."requests_condition_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_420d9f679d41281f282f5bc7d0"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9805ee71aa117dee3c3f60f527"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_53a68dc905777554b7f702791f"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TABLE "system_settings"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_20f139b9d79f917ef735efacb0"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e2dd77cb8a46c78d8ea34de039"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a000cca60bcf04454e72769949"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_language_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_roles_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a3699a8ee632fc3527fec16a7d"`);
    await queryRunner.query(`DROP TABLE "user_devices"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_90c322f4cf3a43b2914c38f1cb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4c1c59db4ac1ed90a1a7c0ff3d"`);
    await queryRunner.query(`DROP TABLE "sellers"`);
    await queryRunner.query(`DROP TYPE "public"."sellers_verificationstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."sellers_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b250aff4dbe94d29b286dcb537"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_88ed45f215d6ddb29c83d8d300"`);
    await queryRunner.query(`DROP TABLE "stores"`);
    await queryRunner.query(`DROP TABLE "seller_documents"`);
    await queryRunner.query(`DROP TABLE "vins"`);
  }
}
