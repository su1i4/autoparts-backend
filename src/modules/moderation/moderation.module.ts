import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { BlacklistEntry } from './entities/blacklist-entry.entity';
import { Report } from './entities/report.entity';
import { UserBlock } from './entities/user-block.entity';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserBlock, BlacklistEntry, Report])],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
