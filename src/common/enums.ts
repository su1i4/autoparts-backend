// Все перечисления в одном месте — удобно синхронизировать с фронтом.

export enum Role {
  CLIENT = 'CLIENT',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
  LOGISTICS = 'LOGISTICS', // менеджер логистики / склада
  SUPPORT = 'SUPPORT', // саппорт: споры, чаты, блокировки
}

export const STAFF_ROLES = [Role.ADMIN, Role.LOGISTICS, Role.SUPPORT];

export enum Language {
  RU = 'ru',
  KY = 'ky',
  EN = 'en',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  DELETED = 'DELETED',
}

export enum Currency {
  KGS = 'KGS',
  USD = 'USD',
  CNY = 'CNY',
  RUB = 'RUB',
}

export enum SellerType {
  SHOP = 'SHOP', // магазин
  SCRAPYARD = 'SCRAPYARD', // авторазборка
  PRIVATE = 'PRIVATE', // частник
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum PartCondition {
  NEW = 'NEW',
  USED = 'USED',
}

export enum PartOrigin {
  ORIGINAL = 'ORIGINAL',
  ANALOG = 'ANALOG',
}

export enum ConditionPreference {
  NEW = 'NEW',
  USED = 'USED',
  ANY = 'ANY',
}

export enum RequestStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HAS_OFFERS = 'HAS_OFFERS',
  OFFER_SELECTED = 'OFFER_SELECTED',
  CLOSED = 'CLOSED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum OfferStatus {
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  SELECTED = 'SELECTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  EXPIRED = 'EXPIRED',
  REMOVED = 'REMOVED', // удалён модератором
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  CONFIRMED = 'CONFIRMED', // подтверждён продавцом
  SHIPPED = 'SHIPPED', // передан продавцом в логистику
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTE = 'DISPUTE',
  RETURN = 'RETURN',
  REFUNDED = 'REFUNDED',
}

export enum DeliveryMethod {
  PICKUP_POINT = 'PICKUP_POINT',
  COURIER = 'COURIER',
}

export enum ShippingMethod {
  AIR = 'AIR',
  TRUCK = 'TRUCK',
  RAIL = 'RAIL',
  LOCAL = 'LOCAL', // продавец в КР — только последняя миля
}

export enum PaymentMethod {
  CARD = 'CARD',
  ELCART = 'ELCART',
  ODENGI = 'ODENGI',
  MBANK = 'MBANK',
  OPTIMA = 'OPTIMA',
  QR = 'QR',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}

export enum PaymentStatus {
  CREATED = 'CREATED',
  HOLD = 'HOLD',
  CAPTURED = 'CAPTURED',
  PAID_OUT = 'PAID_OUT',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  FAILED = 'FAILED',
}

export enum PayoutStatus {
  REQUESTED = 'REQUESTED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

export enum WarehouseType {
  SELLER = 'SELLER',
  CONSOLIDATION = 'CONSOLIDATION',
  PICKUP_POINT = 'PICKUP_POINT',
}

// Статусы из п.7 ТЗ
export enum ShipmentStatus {
  PENDING = 'PENDING', // заказ оплачен, ждём передачи
  HANDED_BY_SELLER = 'HANDED_BY_SELLER',
  AT_ORIGIN_WAREHOUSE = 'AT_ORIGIN_WAREHOUSE', // на складе в Китае
  IN_TRANSIT = 'IN_TRANSIT',
  AT_CUSTOMS = 'AT_CUSTOMS',
  AT_DESTINATION_WAREHOUSE = 'AT_DESTINATION_WAREHOUSE', // на складе КР
  HANDED_TO_COURIER = 'HANDED_TO_COURIER',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum ChatType {
  REQUEST = 'REQUEST', // клиент ↔ продавец в рамках запроса/оффера/заказа
  DISPUTE = 'DISPUTE', // клиент + продавец + саппорт
}

export enum MessageStatus {
  SENT = 'SENT',
  BLOCKED = 'BLOCKED', // содержит контакты — не доставлено
  HIDDEN = 'HIDDEN', // скрыто модератором
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  SELLER_RESPONDED = 'SELLER_RESPONDED',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
}

export enum DisputeResolution {
  REFUND_FULL = 'REFUND_FULL',
  REFUND_PARTIAL = 'REFUND_PARTIAL',
  PAYOUT_SELLER = 'PAYOUT_SELLER',
}

export enum ReturnStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RECEIVED = 'RECEIVED',
  REFUNDED = 'REFUNDED',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
}

export enum CommissionScope {
  GLOBAL = 'GLOBAL',
  COUNTRY = 'COUNTRY',
  CATEGORY = 'CATEGORY',
  SELLER = 'SELLER',
}

export enum CommissionType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum ReportTarget {
  REQUEST = 'REQUEST',
  OFFER = 'OFFER',
  MESSAGE = 'MESSAGE',
  USER = 'USER',
}

export enum ReportStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum BlacklistType {
  PHONE = 'PHONE',
  DEVICE = 'DEVICE',
}

export enum AppealStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
