import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateVehicleDto, DecodeVinDto } from './dto/vehicle.dto';
import { VehiclesService } from './vehicles.service';
import { VinDecoderService } from './vin-decoder.service';

@ApiTags('Garage & VIN')
@ApiBearerAuth()
@Controller()
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly decoder: VinDecoderService,
  ) {}

  /** Расшифровка VIN. recognized=false → показать форму ручного ввода */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('vin/decode')
  decode(@Body() dto: DecodeVinDto) {
    return this.decoder.decode(dto.vin);
  }

  @Get('garage')
  list(@CurrentUser() u: AuthUser) {
    return this.vehicles.list(u.id);
  }

  @Post('garage')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(u.id, dto);
  }

  @Get('garage/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.get(u.id, id);
  }

  @Patch('garage/:id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehicles.update(u.id, id, dto);
  }

  @Delete('garage/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.remove(u.id, id);
  }
}
