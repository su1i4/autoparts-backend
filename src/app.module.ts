import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { envValidationSchema } from './config/env.validation';
import { HealthController } from './health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChatModule } from './modules/chat/chat.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { FilesModule } from './modules/files/files.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { RequestsModule } from './modules/requests/requests.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT') ?? '5432', 10),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        // локально таблицы создаются сами; в production — только миграции
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('DB_LOGGING') === 'true',
      }),
    }),

    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),

    SettingsModule,
    AuditModule,
    ModerationModule,
    ReferenceModule,
    FilesModule,
    UsersModule,
    AuthModule,
    SellersModule,
    VehiclesModule,
    CatalogModule,
    RequestsModule,
    ChatModule,
    CommissionsModule,
    PaymentsModule,
    LogisticsModule,
    OrdersModule,
    DisputesModule,
    ReviewsModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}