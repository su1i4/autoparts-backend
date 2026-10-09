import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDeviceDto, UpdateMeDto } from './dto/update-me.dto';
import { UserDevice } from './entities/user-device.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserDevice) private readonly devices: Repository<UserDevice>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id }, relations: { seller: true } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  /** Для JwtStrategy: пользователь вместе с продавцом */
  findForAuth(id: string) {
    return this.users.findOne({ where: { id }, relations: { seller: true } });
  }

  findByPhone(phone: string) {
    return this.users.findOne({ where: { phone }, relations: { seller: true } });
  }

  async updateMe(id: string, dto: UpdateMeDto): Promise<User> {
    if (dto.email) {
      const taken = await this.users.findOne({ where: { email: dto.email.toLowerCase() } });
      if (taken && taken.id !== id) throw new ConflictException('Email уже используется');
      dto.email = dto.email.toLowerCase();
    }
    await this.users.update(id, dto);
    return this.findById(id);
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    await this.devices.upsert(
      {
        userId,
        deviceId: dto.deviceId,
        platform: dto.platform ?? 'web',
        pushToken: dto.pushToken ?? null,
      },
      ['userId', 'deviceId'],
    );
    return { ok: true };
  }

  pushTokens(userId: string) {
    return this.devices
      .find({ where: { userId } })
      .then((d) => d.map((x) => x.pushToken).filter(Boolean));
  }
}
