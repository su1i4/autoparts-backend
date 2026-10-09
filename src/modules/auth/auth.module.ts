import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpCode } from './entities/otp-code.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { JwtStrategy } from './jwt.strategy';
import { ConsoleOtpSender, OtpSender } from './providers/sms.provider';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([OtpCode, RefreshSession]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, { provide: OtpSender, useClass: ConsoleOtpSender }],
})
export class AuthModule {}
