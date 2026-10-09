import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AdminSystemController, AdminUsersController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AdminUsersController, AdminSystemController],
  providers: [AdminService],
})
export class AdminModule {}
